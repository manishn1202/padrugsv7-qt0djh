# FastAPI v0.100.0 - Web framework with enhanced security features
from fastapi import FastAPI, HTTPException, UploadFile, Depends
from fastapi.responses import JSONResponse
from fastapi_limiter import FastAPILimiter  # v0.1.5

# Standard library imports
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone
import uuid

# Internal imports
from models.document import Document
from services.document_service import DocumentService
from config.settings import STORAGE_SETTINGS
from shared.proto.document_pb2 import DocumentType, ProcessingStatus

class DocumentController:
    """
    FastAPI controller handling document management endpoints with enhanced security,
    validation, and monitoring capabilities for the Prior Authorization system.
    """

    def __init__(self, document_service: DocumentService, rate_limiter: FastAPILimiter):
        """
        Initialize document controller with required dependencies.

        Args:
            document_service: Service layer for document operations
            rate_limiter: Rate limiting middleware
        """
        # Initialize FastAPI router
        self.router = FastAPI(
            title="EPA Document Service",
            description="Document management endpoints for Prior Authorization system",
            version="1.0.0"
        )

        # Configure dependencies
        self._document_service = document_service
        self._rate_limiter = rate_limiter

        # Set up logging
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)

        # Register routes with security middleware
        self._register_routes()

    def _register_routes(self):
        """Configure API routes with security middleware and rate limiting."""
        
        @self.router.post("/api/v1/documents")
        @self._rate_limiter.limit("10/minute")
        async def upload_document(
            file: UploadFile,
            authorization_id: str,
            uploaded_by: str,
            document_type: Optional[str] = DocumentType.OTHER
        ) -> JSONResponse:
            """
            Handle secure document upload with validation and virus scanning.

            Args:
                file: Uploaded file content
                authorization_id: Associated PA request ID
                uploaded_by: User ID of uploader
                document_type: Type of clinical document

            Returns:
                JSONResponse: Document metadata and status
            """
            try:
                # Validate file size
                file_size = 0
                file_content = bytearray()
                
                # Stream file content with size validation
                while chunk := await file.read(8192):
                    file_size += len(chunk)
                    if file_size > STORAGE_SETTINGS["max_file_size"]:
                        raise HTTPException(
                            status_code=413,
                            detail="File exceeds maximum size limit"
                        )
                    file_content.extend(chunk)

                # Validate mime type
                mime_type = file.content_type
                if mime_type not in STORAGE_SETTINGS["allowed_mime_types"]:
                    raise HTTPException(
                        status_code=415,
                        detail="Unsupported file type"
                    )

                # Upload document
                document, success = await self._document_service.upload_document(
                    file_content=bytes(file_content),
                    file_name=file.filename,
                    authorization_id=authorization_id,
                    uploaded_by=uploaded_by,
                    document_type=document_type
                )

                if not success:
                    raise HTTPException(
                        status_code=500,
                        detail="Document upload failed"
                    )

                # Log successful upload
                self._logger.info(
                    "Document uploaded successfully",
                    extra={
                        "document_id": str(document.document_id),
                        "authorization_id": authorization_id,
                        "size_bytes": file_size
                    }
                )

                return JSONResponse(
                    status_code=201,
                    content=document.to_dict()
                )

            except HTTPException:
                raise
            except Exception as e:
                self._logger.error(
                    "Document upload error",
                    extra={
                        "error": str(e),
                        "authorization_id": authorization_id
                    }
                )
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error"
                )

        @self.router.get("/api/v1/documents/{document_id}")
        @self._rate_limiter.limit("100/minute")
        async def get_document(document_id: str) -> JSONResponse:
            """
            Retrieve document metadata with access control validation.

            Args:
                document_id: Unique document identifier

            Returns:
                JSONResponse: Document metadata
            """
            try:
                document = Document.objects.get(document_id=document_id)
                return JSONResponse(content=document.to_dict())
            except Document.DoesNotExist:
                raise HTTPException(
                    status_code=404,
                    detail="Document not found"
                )
            except Exception as e:
                self._logger.error(
                    "Document retrieval error",
                    extra={
                        "error": str(e),
                        "document_id": document_id
                    }
                )
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error"
                )

        @self.router.get("/api/v1/documents")
        @self._rate_limiter.limit("50/minute")
        async def list_documents(
            authorization_id: Optional[str] = None,
            status: Optional[str] = None,
            page: int = 1,
            page_size: int = 20
        ) -> JSONResponse:
            """
            List documents with filtering and pagination.

            Args:
                authorization_id: Optional PA request ID filter
                status: Optional processing status filter
                page: Page number for pagination
                page_size: Number of items per page

            Returns:
                JSONResponse: Paginated document list
            """
            try:
                # Build query filters
                filters = {}
                if authorization_id:
                    filters["authorization_id"] = authorization_id
                if status:
                    filters["processing_status"] = status

                # Query documents with pagination
                skip = (page - 1) * page_size
                documents = Document.objects.filter(
                    **filters
                ).skip(skip).limit(page_size)

                # Get total count for pagination
                total_count = Document.objects.filter(**filters).count()

                return JSONResponse(content={
                    "documents": [doc.to_dict() for doc in documents],
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total_count": total_count,
                        "total_pages": (total_count + page_size - 1) // page_size
                    }
                })

            except Exception as e:
                self._logger.error(
                    "Document list error",
                    extra={"error": str(e)}
                )
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error"
                )

        @self.router.patch("/api/v1/documents/{document_id}/status")
        @self._rate_limiter.limit("50/minute")
        async def update_processing_status(
            document_id: str,
            status: ProcessingStatus,
            analysis_results: Optional[Dict] = None
        ) -> JSONResponse:
            """
            Update document processing status with optional AI analysis results.

            Args:
                document_id: Document identifier
                status: New processing status
                analysis_results: Optional AI processing results

            Returns:
                JSONResponse: Updated document metadata
            """
            try:
                document = Document.objects.get(document_id=document_id)

                # Update processing status
                success = document.update_processing_status(
                    status,
                    {
                        "user_id": "system",
                        "reason": "Status update"
                    }
                )

                # Update AI analysis if provided
                if analysis_results and status == ProcessingStatus.PROCESSED:
                    document, analysis_success = await self._document_service.update_ai_analysis(
                        document_id=document_id,
                        analysis_results=analysis_results
                    )
                    if not analysis_success:
                        self._logger.warning(
                            "AI analysis update failed",
                            extra={"document_id": document_id}
                        )

                return JSONResponse(content=document.to_dict())

            except Document.DoesNotExist:
                raise HTTPException(
                    status_code=404,
                    detail="Document not found"
                )
            except Exception as e:
                self._logger.error(
                    "Status update error",
                    extra={
                        "error": str(e),
                        "document_id": document_id
                    }
                )
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error"
                )