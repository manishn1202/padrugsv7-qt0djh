# FastAPI v0.100.0 - Web framework for building APIs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Standard library imports - Python 3.11+
import logging
import sys
from typing import Dict
import uvicorn

# Internal imports
from config.settings import APP_SETTINGS, SECURITY_SETTINGS
from controllers.document_controller import DocumentController
from services.document_service import DocumentService
from fastapi_limiter import FastAPILimiter

# Initialize FastAPI application with metadata
app = FastAPI(
    title=APP_SETTINGS['app_name'],
    version=APP_SETTINGS['version'],
    description="Document management service for Enhanced Prior Authorization System",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize logger
logger = logging.getLogger(__name__)

def configure_logging() -> None:
    """
    Configure application logging with appropriate handlers and formatters.
    Implements structured logging for production monitoring.
    """
    # Set log level from configuration
    log_level = getattr(logging, APP_SETTINGS['log_level'].upper())
    
    # Create formatter for structured logging
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Configure console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Configure file handler for error logs
    file_handler = logging.FileHandler('error.log')
    file_handler.setLevel(logging.ERROR)
    file_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    logger.info(
        "Logging configured",
        extra={"log_level": APP_SETTINGS['log_level']}
    )

def configure_middleware() -> None:
    """
    Configure FastAPI middleware including CORS, security headers,
    and request tracking.
    """
    # Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=SECURITY_SETTINGS['cors_origins'],
        allow_methods=SECURITY_SETTINGS['cors_methods'],
        allow_headers=SECURITY_SETTINGS['cors_headers'],
        allow_credentials=True,
        max_age=3600
    )
    
    # Add security headers middleware
    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response
    
    # Add request ID middleware for tracking
    @app.middleware("http")
    async def add_request_id(request, call_next):
        request_id = request.headers.get(
            APP_SETTINGS['request_id_header'],
            f"req_{uuid.uuid4().hex}"
        )
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[APP_SETTINGS['request_id_header']] = request_id
        return response
    
    # Add logging middleware
    @app.middleware("http")
    async def log_requests(request, call_next):
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "client_ip": request.client.host
            }
        )
        response = await call_next(request)
        logger.info(
            f"Request completed: {response.status_code}",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "status_code": response.status_code
            }
        )
        return response

def configure_routes() -> None:
    """
    Configure API routes and dependencies including document controller
    and health check endpoint.
    """
    # Initialize document service with configuration
    document_service = DocumentService(config={
        's3_bucket': APP_SETTINGS.get('s3_bucket'),
        'aws_region': APP_SETTINGS.get('aws_region'),
        'encryption_key_id': SECURITY_SETTINGS.get('encryption_key_id'),
        'max_file_size': APP_SETTINGS.get('max_file_size', 104857600),  # 100MB default
        'allowed_mime_types': APP_SETTINGS.get('allowed_mime_types', [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/tiff'
        ])
    })
    
    # Initialize rate limiter
    rate_limiter = FastAPILimiter()
    
    # Initialize and include document controller routes
    document_controller = DocumentController(document_service, rate_limiter)
    app.include_router(
        document_controller.router,
        prefix="/api/v1",
        tags=["documents"]
    )
    
    # Add health check endpoint
    @app.get(
        APP_SETTINGS['health_check_endpoint'],
        tags=["health"],
        summary="Service health check"
    )
    async def health_check() -> Dict:
        """Health check endpoint for monitoring."""
        return {
            "status": "healthy",
            "version": APP_SETTINGS['version'],
            "environment": APP_SETTINGS['environment']
        }

@logger.catch
def main() -> None:
    """
    Main application entry point configuring and starting the service.
    Implements error handling and graceful shutdown.
    """
    try:
        # Configure application components
        configure_logging()
        configure_middleware()
        configure_routes()
        
        # Start application server
        if __name__ == "__main__":
            uvicorn.run(
                "main:app",
                host="0.0.0.0",
                port=8000,
                reload=APP_SETTINGS['debug'],
                workers=4,
                log_level=APP_SETTINGS['log_level'].lower(),
                ssl_keyfile=SECURITY_SETTINGS.get('ssl_key_file'),
                ssl_certfile=SECURITY_SETTINGS.get('ssl_cert_file')
            )
    except Exception as e:
        logger.error(
            "Application startup failed",
            extra={"error": str(e)},
            exc_info=True
        )
        sys.exit(1)

# Start application
main()