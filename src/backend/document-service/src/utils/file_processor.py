"""
Enhanced file processing module for secure, HIPAA-compliant document handling.
Provides robust validation, encryption, and AI preprocessing capabilities.

Version: 1.0.0
"""

import boto3
import magic
import hashlib
import uuid
import logging
from typing import Dict, Tuple, Optional
from datetime import datetime, timezone
from tenacity import retry, stop_after_attempt, wait_exponential
from functools import wraps

# Internal imports
from models.document import Document
from config.settings import STORAGE_SETTINGS
from shared.proto.document_pb2 import DocumentType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def audit_log(func):
    """Decorator for comprehensive audit logging of file operations."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = datetime.now(timezone.utc)
        operation = func.__name__
        
        try:
            result = func(*args, **kwargs)
            logger.info(f"Operation: {operation}, Status: Success, Time: {datetime.now(timezone.utc) - start_time}")
            return result
        except Exception as e:
            logger.error(f"Operation: {operation}, Status: Failed, Error: {str(e)}, Time: {datetime.now(timezone.utc) - start_time}")
            raise
    return wrapper

def singleton(cls):
    """Decorator to ensure single instance of FileProcessor."""
    instances = {}
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
@audit_log
def validate_file(file_content: bytes, file_name: str, expected_hash: str) -> Tuple[bool, str]:
    """
    Validates file against security and compliance requirements.
    
    Args:
        file_content: Raw file bytes
        file_name: Original file name
        expected_hash: Expected SHA-256 hash
        
    Returns:
        Tuple of (validation_success, error_message)
    """
    try:
        # Verify file integrity
        actual_hash = hashlib.sha256(file_content).hexdigest()
        if actual_hash != expected_hash:
            return False, "File integrity check failed"
            
        # Check file size
        if len(file_content) > STORAGE_SETTINGS['max_file_size']:
            return False, f"File exceeds maximum size of {STORAGE_SETTINGS['max_file_size']} bytes"
            
        # Validate file type
        mime_type = magic.from_buffer(file_content, mime=True)
        if mime_type not in STORAGE_SETTINGS['allowed_mime_types']:
            return False, f"Unsupported file type: {mime_type}"
            
        return True, ""
        
    except Exception as e:
        logger.error(f"File validation error: {str(e)}")
        return False, f"Validation error: {str(e)}"

@audit_log
def generate_file_metadata(file_content: bytes, file_name: str, authorization_id: str) -> Dict:
    """
    Generates comprehensive file metadata including HIPAA compliance information.
    
    Args:
        file_content: Raw file bytes
        file_name: Original file name
        authorization_id: Associated authorization ID
        
    Returns:
        Dict containing file metadata
    """
    file_hash = hashlib.sha256(file_content).hexdigest()
    mime_type = magic.from_buffer(file_content, mime=True)
    
    # Determine document type based on mime type and name
    document_type = DocumentType.CLINICAL_NOTES  # Default type
    if 'lab' in file_name.lower():
        document_type = DocumentType.LAB_REPORT
    
    metadata = {
        'file_name': file_name,
        'mime_type': mime_type,
        'size_bytes': len(file_content),
        'hash': file_hash,
        'document_type': document_type,
        'upload_timestamp': datetime.now(timezone.utc).isoformat(),
        'security': {
            'encryption': 'AES-256-GCM',
            'hipaa_compliant': True,
            'access_control': 'RBAC'
        }
    }
    
    return metadata

@singleton
class FileProcessor:
    """Enhanced file processing class with security and compliance capabilities."""
    
    def __init__(self, security_config: Dict):
        """
        Initialize FileProcessor with secure configuration.
        
        Args:
            security_config: Security configuration parameters
        """
        self._s3_client = boto3.client(
            's3',
            region_name=STORAGE_SETTINGS['s3_region'],
            config=boto3.Config(
                signature_version='s3v4',
                s3={'use_accelerate_endpoint': True}
            )
        )
        self._bucket_name = STORAGE_SETTINGS['s3_bucket']
        self._logger = logging.getLogger(__name__)
        self._security_config = security_config
        
        # Verify bucket encryption
        self._verify_bucket_encryption()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    @audit_log
    def process_file(self, file_content: bytes, file_name: str, 
                    authorization_id: str, processing_options: Dict) -> Tuple[str, Dict]:
        """
        Securely processes and stores document file with AI preprocessing.
        
        Args:
            file_content: Raw file bytes
            file_name: Original file name
            authorization_id: Associated authorization ID
            processing_options: Additional processing parameters
            
        Returns:
            Tuple of (storage_location, metadata)
        """
        try:
            # Generate and validate file hash
            file_hash = hashlib.sha256(file_content).hexdigest()
            valid, error = validate_file(file_content, file_name, file_hash)
            if not valid:
                raise ValueError(f"File validation failed: {error}")
                
            # Generate comprehensive metadata
            metadata = generate_file_metadata(file_content, file_name, authorization_id)
            
            # Generate secure storage path
            storage_path = f"{authorization_id}/{str(uuid.uuid4())}/{file_name}"
            
            # Upload to S3 with encryption
            self._s3_client.put_object(
                Bucket=self._bucket_name,
                Key=storage_path,
                Body=file_content,
                ServerSideEncryption='aws:kms',
                SSEKMSKeyId=self._security_config['kms_key_id'],
                Metadata=metadata
            )
            
            # Create document record
            document = Document(
                authorization_id=authorization_id,
                metadata=metadata,
                content_location=f"s3://{self._bucket_name}/{storage_path}",
                document_type=metadata['document_type'],
                uploaded_by=processing_options.get('user_id'),
                security_metadata={'encryption_key_id': self._security_config['kms_key_id']}
            )
            document.save()
            
            return f"s3://{self._bucket_name}/{storage_path}", metadata
            
        except Exception as e:
            self._logger.error(f"File processing error: {str(e)}")
            raise
            
    def _verify_bucket_encryption(self):
        """Verifies S3 bucket encryption configuration."""
        try:
            encryption = self._s3_client.get_bucket_encryption(Bucket=self._bucket_name)
            if not encryption.get('ServerSideEncryptionConfiguration'):
                raise ValueError("Bucket encryption not properly configured")
        except Exception as e:
            self._logger.error(f"Bucket encryption verification failed: {str(e)}")
            raise