"""
Model Configuration Module for Enhanced Prior Authorization System AI Service

This module provides comprehensive configuration management for AI models including GPT-4
and clinical NLP models with built-in security, validation, and monitoring capabilities.

Version: 1.0.0
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, SecretStr, validator
import logging
import os
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class GPTConfig(BaseModel):
    """Configuration settings for GPT-4 model with security and monitoring features."""
    
    model_name: str = Field(
        default="gpt-4",
        description="GPT model version identifier"
    )
    api_version: str = Field(
        default="2023-05-15",
        description="OpenAI API version"
    )
    api_key: SecretStr = Field(
        default_factory=lambda: SecretStr(os.getenv("OPENAI_API_KEY", "")),
        description="OpenAI API key (secured)"
    )
    max_tokens: int = Field(
        default=8192,
        ge=1,
        le=8192,
        description="Maximum tokens per request"
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Model temperature for response randomness"
    )
    max_retries: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Maximum retry attempts"
    )
    timeout_seconds: float = Field(
        default=30.0,
        ge=1.0,
        le=60.0,
        description="Request timeout in seconds"
    )
    max_inference_time: float = Field(
        default=1.0,
        ge=0.1,
        le=5.0,
        description="Maximum inference time in seconds"
    )
    model_metrics: Dict[str, Any] = Field(
        default_factory=lambda: {
            "requests_count": 0,
            "average_latency": 0.0,
            "error_rate": 0.0,
            "last_updated": datetime.now().isoformat()
        },
        description="Model performance metrics"
    )
    security_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "rate_limit": 100,
            "require_encryption": True,
            "allowed_ips": [],
            "audit_logging": True
        },
        description="Security configuration"
    )

    @validator("api_key")
    def validate_api_key(cls, v):
        """Validate API key is properly set and secured."""
        if not v.get_secret_value():
            raise ValueError("OpenAI API key must be set")
        return v

@dataclass
class ClinicalModelConfig(BaseModel):
    """Configuration for clinical NLP model with validation and monitoring."""
    
    model_path: str = Field(
        default="/models/clinical_nlp",
        description="Path to clinical NLP model"
    )
    tokenizer_path: str = Field(
        default="/models/clinical_tokenizer",
        description="Path to clinical tokenizer"
    )
    confidence_threshold: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold"
    )
    batch_size: int = Field(
        default=32,
        ge=1,
        le=128,
        description="Processing batch size"
    )
    model_parameters: Dict[str, Any] = Field(
        default_factory=lambda: {
            "embedding_dim": 768,
            "num_heads": 12,
            "dropout_rate": 0.1,
            "max_sequence_length": 512
        },
        description="Model architecture parameters"
    )
    supported_document_types: List[str] = Field(
        default_factory=lambda: [
            "clinical_notes",
            "lab_results",
            "medication_history",
            "diagnostic_reports"
        ],
        description="Supported clinical document types"
    )
    performance_metrics: Dict[str, Any] = Field(
        default_factory=lambda: {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0,
            "last_updated": datetime.now().isoformat()
        },
        description="Model performance metrics"
    )
    validation_rules: Dict[str, Any] = Field(
        default_factory=lambda: {
            "required_fields": ["diagnosis", "medication", "dosage"],
            "max_document_size": 10485760,  # 10MB
            "allowed_formats": ["pdf", "txt", "hl7", "fhir"]
        },
        description="Input validation rules"
    )

@dataclass
class ModelConfig(BaseModel):
    """Main configuration class for all AI models with comprehensive validation."""
    
    gpt_config: GPTConfig = Field(
        default_factory=GPTConfig,
        description="GPT model configuration"
    )
    clinical_config: ClinicalModelConfig = Field(
        default_factory=ClinicalModelConfig,
        description="Clinical NLP model configuration"
    )
    feature_flags: Dict[str, bool] = Field(
        default_factory=lambda: {
            "use_gpt4": True,
            "enable_batch_processing": True,
            "enable_monitoring": True,
            "enable_audit_logging": True
        },
        description="Feature flags"
    )
    monitoring_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "enable_metrics": True,
            "metrics_interval": 60,
            "alert_thresholds": {
                "error_rate": 0.01,
                "latency": 1000,
                "memory_usage": 0.9
            }
        },
        description="Monitoring configuration"
    )
    audit_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "log_level": "INFO",
            "retention_days": 90,
            "include_request_data": True,
            "audit_file_path": "/logs/model_audit.log"
        },
        description="Audit logging configuration"
    )
    config_version: str = Field(
        default="1.0.0",
        description="Configuration version"
    )

    def validate_config(self) -> bool:
        """Validate the complete configuration with security checks."""
        try:
            # Validate GPT configuration
            if not self.gpt_config.api_key.get_secret_value():
                raise ValueError("GPT API key not configured")

            # Validate Clinical model paths
            if not os.path.exists(self.clinical_config.model_path):
                raise ValueError(f"Clinical model path not found: {self.clinical_config.model_path}")

            # Validate feature flags consistency
            if self.feature_flags["use_gpt4"] and self.gpt_config.model_name != "gpt-4":
                raise ValueError("GPT-4 feature flag enabled but model not configured")

            logger.info("Configuration validation successful")
            return True

        except Exception as e:
            logger.error(f"Configuration validation failed: {str(e)}")
            return False

    def update_config(self, new_settings: Dict[str, Any]) -> bool:
        """Securely update configuration with validation and logging."""
        try:
            # Create backup of current config
            current_config = self.dict()
            
            # Update settings
            for key, value in new_settings.items():
                if hasattr(self, key):
                    setattr(self, key, value)

            # Validate new configuration
            if not self.validate_config():
                # Rollback to previous configuration
                for key, value in current_config.items():
                    setattr(self, key, value)
                raise ValueError("New configuration validation failed")

            # Log configuration change
            logger.info(f"Configuration updated successfully: {new_settings.keys()}")
            return True

        except Exception as e:
            logger.error(f"Configuration update failed: {str(e)}")
            return False