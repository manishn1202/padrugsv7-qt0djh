"""
Configuration settings for the Enhanced Prior Authorization System's Document Service.
This module provides centralized configuration management with secure defaults and 
environment variable overrides for the document processing microservice.

Version: 1.0.0
"""

import os
from typing import Dict, List, Optional, Union, Any

# Application Settings
APP_SETTINGS: Dict[str, Union[str, bool]] = {
    'app_name': 'EPA Document Service',
    'version': '1.0.0',
    'environment': os.getenv('APP_ENV', 'development'),
    'debug': os.getenv('APP_DEBUG', 'False').lower() == 'true',
    'log_level': os.getenv('LOG_LEVEL', 'INFO'),
    'request_id_header': 'X-Request-ID',
    'health_check_endpoint': '/health'
}

# MongoDB Configuration with High Availability Settings
MONGODB_SETTINGS: Dict[str, Any] = {
    'uri': os.getenv('MONGODB_URI', 'mongodb://localhost:27017'),
    'database': os.getenv('MONGODB_DATABASE', 'epa_documents'),
    'collection': os.getenv('MONGODB_COLLECTION', 'documents'),
    'max_pool_size': int(os.getenv('MONGODB_MAX_POOL_SIZE', '100')),
    'min_pool_size': int(os.getenv('MONGODB_MIN_POOL_SIZE', '10')),
    'max_idle_time_ms': int(os.getenv('MONGODB_MAX_IDLE_TIME_MS', '10000')),
    'server_selection_timeout_ms': int(os.getenv('MONGODB_SERVER_SELECTION_TIMEOUT_MS', '5000')),
    'replica_set': os.getenv('MONGODB_REPLICA_SET', None),
    'write_concern': {'w': 'majority', 'j': True},
    'read_preference': 'primary',
    'retry_writes': True,
    'retry_reads': True,
    'connect_timeout_ms': 5000,
    'socket_timeout_ms': 10000
}

# S3 Storage Configuration with Enhanced Security
STORAGE_SETTINGS: Dict[str, Any] = {
    's3_bucket': os.getenv('S3_BUCKET', 'epa-documents'),
    's3_region': os.getenv('AWS_REGION', 'us-east-1'),
    'max_file_size': int(os.getenv('MAX_FILE_SIZE', '104857600')),  # 100MB
    'allowed_mime_types': [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/tiff'
    ],
    'encryption_enabled': os.getenv('STORAGE_ENCRYPTION_ENABLED', 'True').lower() == 'true',
    'kms_key_id': os.getenv('STORAGE_KMS_KEY_ID', ''),
    'versioning_enabled': True,
    'lifecycle_rules': {
        'archive_days': 90,  # Archive after 90 days
        'delete_days': 2555  # Delete after 7 years (regulatory compliance)
    },
    'backup_bucket': os.getenv('S3_BACKUP_BUCKET', ''),
    'compression_enabled': True,
    'storage_class': 'STANDARD_IA',
    'multipart_threshold': 1024 * 1024 * 100,  # 100MB
    'multipart_chunksize': 1024 * 1024 * 10,  # 10MB
}

# Enhanced Security Settings with HIPAA Compliance
SECURITY_SETTINGS: Dict[str, Any] = {
    'jwt_secret': os.getenv('JWT_SECRET'),
    'jwt_algorithm': os.getenv('JWT_ALGORITHM', 'RS256'),
    'jwt_issuer': os.getenv('JWT_ISSUER', 'epa-auth-service'),
    'jwt_audience': os.getenv('JWT_AUDIENCE', 'document-service'),
    'token_expiry': int(os.getenv('TOKEN_EXPIRY', '3600')),
    'cors_origins': os.getenv('CORS_ORIGINS', '*').split(','),
    'cors_methods': ['GET', 'POST', 'PUT', 'DELETE'],
    'cors_headers': ['Authorization', 'Content-Type', 'X-Request-ID'],
    'rate_limit_enabled': True,
    'rate_limit_requests': 100,
    'rate_limit_window': 60,
    'ip_whitelist': os.getenv('IP_WHITELIST', '').split(','),
    'tls_version': 'TLSv1.2',
    'minimum_key_length': 2048,
    'session_timeout': 1800,  # 30 minutes
    'max_login_attempts': 5,
    'password_policy': {
        'min_length': 12,
        'require_uppercase': True,
        'require_lowercase': True,
        'require_numbers': True,
        'require_special': True
    }
}

# AI Service Integration Settings with Circuit Breaker
AI_SERVICE_SETTINGS: Dict[str, Any] = {
    'service_url': os.getenv('AI_SERVICE_URL', 'http://ai-service:8080'),
    'timeout_seconds': int(os.getenv('AI_SERVICE_TIMEOUT', '30')),
    'max_retries': int(os.getenv('AI_SERVICE_MAX_RETRIES', '3')),
    'retry_backoff_factor': float(os.getenv('AI_SERVICE_RETRY_BACKOFF', '1.5')),
    'batch_size': int(os.getenv('AI_SERVICE_BATCH_SIZE', '10')),
    'circuit_breaker_enabled': True,
    'circuit_breaker_threshold': 5,
    'circuit_breaker_timeout': 30,
    'error_threshold': 0.15,
    'model_version': os.getenv('AI_MODEL_VERSION', 'v1'),
    'confidence_threshold': float(os.getenv('AI_CONFIDENCE_THRESHOLD', '0.85')),
    'max_document_size': 1024 * 1024 * 50,  # 50MB for AI processing
    'supported_languages': ['en'],
    'fallback_enabled': True,
    'monitoring_enabled': True,
    'cache_results': True,
    'cache_ttl': 3600  # 1 hour
}

def validate_settings() -> bool:
    """
    Validates all configuration settings and their dependencies.
    Performs comprehensive checks for security, connectivity, and compliance requirements.
    
    Returns:
        bool: True if all validations pass
        
    Raises:
        ConfigurationError: If any validation fails
    """
    # Required environment variables validation
    required_vars = ['JWT_SECRET', 'MONGODB_URI', 'S3_BUCKET']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise ConfigurationError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    # MongoDB connection string validation
    if not MONGODB_SETTINGS['uri'].startswith(('mongodb://', 'mongodb+srv://')):
        raise ConfigurationError("Invalid MongoDB connection string format")
    
    # S3 bucket name validation
    if not STORAGE_SETTINGS['s3_bucket'].strip():
        raise ConfigurationError("S3 bucket name cannot be empty")
    
    # Security settings validation
    if SECURITY_SETTINGS['jwt_algorithm'] not in ['RS256', 'ES256', 'PS256']:
        raise ConfigurationError("Invalid JWT algorithm specified")
    
    # CORS validation
    if '*' in SECURITY_SETTINGS['cors_origins'] and APP_SETTINGS['environment'] == 'production':
        raise ConfigurationError("Wildcard CORS origin not allowed in production")
    
    # AI service URL validation
    if not AI_SERVICE_SETTINGS['service_url'].startswith(('http://', 'https://')):
        raise ConfigurationError("Invalid AI service URL format")
    
    # File size limits validation
    if STORAGE_SETTINGS['max_file_size'] > 104857600:  # 100MB
        raise ConfigurationError("Maximum file size exceeds allowed limit")
    
    # Encryption validation
    if STORAGE_SETTINGS['encryption_enabled'] and not STORAGE_SETTINGS['kms_key_id']:
        raise ConfigurationError("KMS key ID required when encryption is enabled")
    
    return True

class ConfigurationError(Exception):
    """Custom exception for configuration validation errors."""
    pass

# Validate settings on module import
validate_settings()