# mongoengine v0.24.0 - MongoDB ODM with enhanced security features
from mongoengine import (
    Document as MongoDocument,
    StringField,
    DateTimeField,
    DictField,
    UUIDField,
    EnumField,
    EmbeddedDocumentField
)
from datetime import datetime, timezone
from typing import Dict, Optional
import uuid

# Internal imports from proto definitions
from shared.proto.document_pb2 import (
    DocumentType,
    ProcessingStatus
)

class Document(MongoDocument):
    """
    Enhanced MongoDB document model for clinical documents with security, AI capabilities,
    and HIPAA compliance features.
    
    This model handles secure storage and processing of clinical documentation for
    prior authorization requests with comprehensive audit logging and encryption.
    """
    
    # Collection configuration and indexing strategy
    meta = {
        'collection': 'documents',
        'indexes': [
            'document_id',
            'authorization_id',
            ('document_id', 'authorization_id'),
            ('processing_status', 'created_at'),
            'uploaded_by'
        ],
        'ordering': ['-created_at']
    }

    # Primary fields
    document_id = UUIDField(
        required=True, 
        unique=True, 
        default=uuid.uuid4,
        binary=False
    )
    authorization_id = UUIDField(
        required=True,
        binary=False
    )
    metadata = DictField(
        required=True,
        validation={
            'mime_type': str,
            'filename': str,
            'size_bytes': int,
            'hash': str
        }
    )
    content_location = StringField(
        required=True,
        encryption_required=True
    )
    document_type = EnumField(
        DocumentType,
        required=True
    )
    processing_status = EnumField(
        ProcessingStatus,
        required=True,
        default=ProcessingStatus.PENDING
    )
    
    # AI analysis and tracking
    ai_analysis = DictField(
        default=dict,
        validation={
            'confidence_score': float,
            'extracted_fields': dict,
            'detected_conditions': list,
            'relevant_criteria': list,
            'analysis_version': str,
            'analyzed_at': datetime
        }
    )
    
    # Security and audit fields
    uploaded_by = UUIDField(
        required=True,
        binary=False
    )
    created_at = DateTimeField(
        required=True,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at = DateTimeField(
        required=True,
        default=lambda: datetime.now(timezone.utc)
    )
    security_metadata = DictField(
        required=True,
        default=lambda: {
            'encryption_algorithm': 'AES-256-GCM',
            'key_rotation_date': datetime.now(timezone.utc).isoformat(),
            'compliance_version': '1.0'
        }
    )
    audit_trail = DictField(
        required=True,
        default=list
    )
    encryption_key_id = StringField(
        required=True,
        encryption_required=True
    )
    compliance_metadata = DictField(
        required=True,
        default=lambda: {
            'hipaa_compliant': True,
            'retention_policy': 'P7Y',  # 7 years retention
            'data_classification': 'PHI',
            'access_controls': 'RBAC'
        }
    )

    def __init__(self, **kwargs):
        """
        Initialize a new document instance with enhanced security and compliance features.
        
        Args:
            **kwargs: Document field values
        """
        super(Document, self).__init__(**kwargs)
        
        # Initialize security metadata if not provided
        if not self.security_metadata:
            self.security_metadata = {
                'encryption_algorithm': 'AES-256-GCM',
                'key_rotation_date': datetime.now(timezone.utc).isoformat(),
                'compliance_version': '1.0'
            }
        
        # Initialize compliance metadata if not provided
        if not self.compliance_metadata:
            self.compliance_metadata = {
                'hipaa_compliant': True,
                'retention_policy': 'P7Y',
                'data_classification': 'PHI',
                'access_controls': 'RBAC'
            }
        
        # Initialize audit trail if not provided
        if not self.audit_trail:
            self.audit_trail = []
        
        # Set default processing status if not provided
        if not self.processing_status:
            self.processing_status = ProcessingStatus.PENDING
        
        # Ensure timestamps are in UTC
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc)
        if not self.updated_at:
            self.updated_at = datetime.now(timezone.utc)

    def update_processing_status(self, status: ProcessingStatus, audit_info: Dict) -> bool:
        """
        Update document processing status with comprehensive audit logging.
        
        Args:
            status: New processing status
            audit_info: Additional audit information
            
        Returns:
            bool: Update success status
        """
        try:
            # Validate status transition
            if not self._is_valid_status_transition(status):
                raise ValueError(f"Invalid status transition from {self.processing_status} to {status}")
            
            # Update status and timestamp
            self.processing_status = status
            self.updated_at = datetime.now(timezone.utc)
            
            # Record audit information
            audit_entry = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'action': 'status_update',
                'previous_status': self.processing_status,
                'new_status': status,
                'user_id': audit_info.get('user_id'),
                'reason': audit_info.get('reason')
            }
            self.audit_trail.append(audit_entry)
            
            self.save()
            return True
            
        except Exception as e:
            # Log error but don't expose internal details
            print(f"Error updating processing status: {str(e)}")
            return False

    def update_ai_analysis(self, analysis_results: Dict, validation_info: Dict) -> bool:
        """
        Update document with AI analysis results including validation.
        
        Args:
            analysis_results: AI processing results
            validation_info: Analysis validation metadata
            
        Returns:
            bool: Update success status
        """
        try:
            # Validate analysis results schema
            required_fields = {'confidence_score', 'extracted_fields', 'analysis_version'}
            if not all(field in analysis_results for field in required_fields):
                raise ValueError("Missing required AI analysis fields")
            
            # Update AI analysis with validation metadata
            analysis_results['validated_at'] = datetime.now(timezone.utc).isoformat()
            analysis_results['validation_score'] = validation_info.get('validation_score')
            analysis_results['validator_version'] = validation_info.get('validator_version')
            
            self.ai_analysis = analysis_results
            self.updated_at = datetime.now(timezone.utc)
            
            # Record analysis update in audit trail
            audit_entry = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'action': 'ai_analysis_update',
                'analysis_version': analysis_results['analysis_version'],
                'confidence_score': analysis_results['confidence_score']
            }
            self.audit_trail.append(audit_entry)
            
            self.save()
            return True
            
        except Exception as e:
            print(f"Error updating AI analysis: {str(e)}")
            return False

    def to_dict(self, include_sensitive: bool = False) -> Dict:
        """
        Convert document to dictionary format with security filtering.
        
        Args:
            include_sensitive: Whether to include sensitive fields
            
        Returns:
            Dict: Filtered document data
        """
        base_dict = {
            'document_id': str(self.document_id),
            'authorization_id': str(self.authorization_id),
            'document_type': self.document_type,
            'processing_status': self.processing_status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        # Include non-sensitive metadata
        base_dict['metadata'] = {
            'mime_type': self.metadata.get('mime_type'),
            'filename': self.metadata.get('filename'),
            'size_bytes': self.metadata.get('size_bytes')
        }
        
        # Include AI analysis if available
        if self.ai_analysis:
            base_dict['ai_analysis'] = {
                'confidence_score': self.ai_analysis.get('confidence_score'),
                'analysis_version': self.ai_analysis.get('analysis_version'),
                'analyzed_at': self.ai_analysis.get('analyzed_at')
            }
        
        # Include sensitive information if authorized
        if include_sensitive:
            base_dict.update({
                'content_location': self.content_location,
                'uploaded_by': str(self.uploaded_by),
                'security_metadata': self.security_metadata,
                'compliance_metadata': self.compliance_metadata,
                'audit_trail': self.audit_trail
            })
        
        return base_dict

    def _is_valid_status_transition(self, new_status: ProcessingStatus) -> bool:
        """
        Validate status transition based on allowed state machine.
        
        Args:
            new_status: Proposed new status
            
        Returns:
            bool: Whether the transition is valid
        """
        # Define allowed transitions
        allowed_transitions = {
            ProcessingStatus.PENDING: {ProcessingStatus.PROCESSING},
            ProcessingStatus.PROCESSING: {ProcessingStatus.PROCESSED, ProcessingStatus.FAILED},
            ProcessingStatus.PROCESSED: {ProcessingStatus.PROCESSING},  # Allow reprocessing
            ProcessingStatus.FAILED: {ProcessingStatus.PROCESSING}  # Allow retry
        }
        
        return new_status in allowed_transitions.get(self.processing_status, set())