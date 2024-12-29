# Standard library imports
import uuid
import json
from datetime import datetime, timezone
from typing import Dict, Optional

# Third-party imports - versions specified in comments
import pytest  # v7.4.0
import mongomock  # v4.1.2
from moto import mock_s3  # v4.1.12
from freezegun import freeze_time  # v1.2.0
from cryptography.fernet import Fernet  # v41.0.0

# Internal imports
from services.document_service import DocumentService
from models.document import Document
from shared.proto.document_pb2 import DocumentType, ProcessingStatus

class TestDocumentService:
    """
    Comprehensive test suite for DocumentService including security, compliance,
    and document processing validation.
    """

    @pytest.fixture(autouse=True)
    def setup(self, mongo_mock, s3_mock):
        """Set up test environment with mocked dependencies."""
        self._service = DocumentService({
            's3_bucket': 'test-bucket',
            'aws_region': 'us-east-1',
            'encryption_key_id': 'test-key-id',
            'max_file_size': 10 * 1024 * 1024,  # 10MB
            'allowed_mime_types': ['application/pdf', 'image/jpeg', 'image/png']
        })
        
        # Test data setup
        self._test_file_content = b'test document content'
        self._test_file_name = 'test_document.pdf'
        self._test_auth_id = uuid.uuid4()
        self._test_user_id = uuid.uuid4()

    @pytest.fixture
    def mongo_mock(self):
        """Configure MongoDB mock for testing."""
        return mongomock.patch(servers=(('mongodb://localhost', 27017),))

    @pytest.fixture
    def s3_mock(self):
        """Configure S3 mock for testing."""
        with mock_s3():
            yield

    @pytest.fixture
    def sample_document(self) -> Document:
        """Create a sample document for testing."""
        return Document(
            document_id=uuid.uuid4(),
            authorization_id=self._test_auth_id,
            metadata={
                'mime_type': 'application/pdf',
                'filename': self._test_file_name,
                'size_bytes': len(self._test_file_content),
                'hash': 'test_hash'
            },
            content_location=f's3://test-bucket/{self._test_auth_id}/test.pdf',
            document_type=DocumentType.CLINICAL_NOTES,
            processing_status=ProcessingStatus.PENDING,
            uploaded_by=self._test_user_id,
            encryption_key_id='test-key-id'
        ).save()

    async def test_upload_document_success(self):
        """Test successful document upload with security validation."""
        document, success = await self._service.upload_document(
            file_content=self._test_file_content,
            file_name=self._test_file_name,
            authorization_id=str(self._test_auth_id),
            uploaded_by=str(self._test_user_id),
            document_type=DocumentType.CLINICAL_NOTES
        )

        assert success is True
        assert document.document_id is not None
        assert document.authorization_id == self._test_auth_id
        assert document.processing_status == ProcessingStatus.PENDING
        assert document.security_metadata['encryption_algorithm'] == 'AES-256-GCM'
        assert document.compliance_metadata['hipaa_compliant'] is True

    async def test_upload_document_size_limit(self):
        """Test file size limit enforcement."""
        large_content = b'x' * (10 * 1024 * 1024 + 1)  # Exceeds 10MB limit
        
        with pytest.raises(ValueError, match="File exceeds maximum size limit"):
            await self._service.upload_document(
                file_content=large_content,
                file_name=self._test_file_name,
                authorization_id=str(self._test_auth_id),
                uploaded_by=str(self._test_user_id)
            )

    async def test_upload_document_mime_type_validation(self):
        """Test MIME type validation for uploads."""
        invalid_content = b'invalid file content'
        
        with pytest.raises(ValueError, match="Unsupported file type"):
            await self._service.upload_document(
                file_content=invalid_content,
                file_name='test.exe',
                authorization_id=str(self._test_auth_id),
                uploaded_by=str(self._test_user_id)
            )

    @freeze_time("2024-01-15 12:00:00")
    async def test_document_audit_trail(self, sample_document):
        """Test comprehensive audit trail logging."""
        # Update document status
        await self._service.update_processing_status(
            str(sample_document.document_id),
            ProcessingStatus.PROCESSING,
            {'user_id': str(self._test_user_id), 'reason': 'Started processing'}
        )

        updated_doc = Document.objects.get(document_id=sample_document.document_id)
        latest_audit = updated_doc.audit_trail[-1]

        assert latest_audit['timestamp'] == '2024-01-15T12:00:00+00:00'
        assert latest_audit['action'] == 'status_update'
        assert latest_audit['user_id'] == str(self._test_user_id)
        assert latest_audit['previous_status'] == ProcessingStatus.PENDING
        assert latest_audit['new_status'] == ProcessingStatus.PROCESSING

    async def test_ai_analysis_update(self, sample_document):
        """Test AI analysis results update with validation."""
        analysis_results = {
            'confidence_score': 0.95,
            'extracted_fields': {
                'diagnosis': 'Hypertension',
                'medication': 'Lisinopril'
            },
            'analysis_version': '1.0.0'
        }

        document, success = await self._service.update_ai_analysis(
            str(sample_document.document_id),
            analysis_results,
            {'validation_score': 0.98, 'validator_version': '1.0.0'}
        )

        assert success is True
        assert document.ai_analysis['confidence_score'] == 0.95
        assert document.processing_status == ProcessingStatus.COMPLETED
        assert 'validated_at' in document.ai_analysis

    async def test_hipaa_compliance_validation(self, sample_document):
        """Test HIPAA compliance requirements."""
        # Verify encryption
        assert sample_document.security_metadata['encryption_algorithm'] == 'AES-256-GCM'
        assert sample_document.encryption_key_id is not None
        
        # Verify compliance metadata
        assert sample_document.compliance_metadata['hipaa_compliant'] is True
        assert sample_document.compliance_metadata['retention_policy'] == 'P7Y'
        assert sample_document.compliance_metadata['data_classification'] == 'PHI'
        
        # Verify audit logging
        assert len(sample_document.audit_trail) > 0
        assert all('timestamp' in entry for entry in sample_document.audit_trail)

    async def test_document_access_control(self, sample_document):
        """Test document access control and security."""
        # Test authorized access
        doc_dict = sample_document.to_dict(include_sensitive=True)
        assert 'content_location' in doc_dict
        assert 'security_metadata' in doc_dict
        
        # Test unauthorized access
        doc_dict = sample_document.to_dict(include_sensitive=False)
        assert 'content_location' not in doc_dict
        assert 'security_metadata' not in doc_dict

    async def test_invalid_status_transition(self, sample_document):
        """Test invalid document status transitions."""
        with pytest.raises(ValueError, match="Invalid status transition"):
            await self._service.update_processing_status(
                str(sample_document.document_id),
                ProcessingStatus.COMPLETED,
                {'user_id': str(self._test_user_id), 'reason': 'Invalid transition'}
            )

    @pytest.mark.parametrize("invalid_analysis", [
        {},  # Empty analysis
        {'confidence_score': 1.5},  # Invalid confidence score
        {'confidence_score': 0.9, 'extracted_fields': {}}  # Missing version
    ])
    async def test_invalid_ai_analysis(self, sample_document, invalid_analysis):
        """Test validation of AI analysis results."""
        with pytest.raises(ValueError):
            await self._service.update_ai_analysis(
                str(sample_document.document_id),
                invalid_analysis,
                {}
            )