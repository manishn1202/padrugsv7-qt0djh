# Terraform ~> 1.5

# Project identification variable
variable "project_name" {
  description = "Name of the healthcare project used for resource naming and tagging"
  type        = string
  
  validation {
    condition     = length(var.project_name) > 0 && can(regex("^[a-zA-Z0-9-]+$", var.project_name))
    error_message = "Project name must be non-empty and contain only alphanumeric characters and hyphens"
  }
}

# Environment specification
variable "environment" {
  description = "Deployment environment for the S3 bucket (dev, staging, prod, dr)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

# Versioning configuration
variable "enable_versioning" {
  description = "Enable versioning for the S3 bucket to maintain document history and prevent accidental deletions"
  type        = bool
  default     = true
}

# Lifecycle management configuration
variable "lifecycle_glacier_transition_days" {
  description = "Number of days after which objects transition to Glacier storage for cost optimization"
  type        = number
  default     = 90
  
  validation {
    condition     = var.lifecycle_glacier_transition_days >= 30 && var.lifecycle_glacier_transition_days <= 180
    error_message = "Glacier transition must be between 30 and 180 days for operational efficiency"
  }
}

variable "lifecycle_expiration_days" {
  description = "Number of days after which objects are deleted (minimum 7 years for HIPAA compliance)"
  type        = number
  default     = 2555  # 7 years
  
  validation {
    condition     = var.lifecycle_expiration_days >= 2555
    error_message = "Expiration must be at least 7 years (2555 days) for HIPAA compliance"
  }
}

# KMS key configuration
variable "kms_key_deletion_window" {
  description = "Waiting period before KMS key deletion for security protection"
  type        = number
  default     = 30
  
  validation {
    condition     = var.kms_key_deletion_window >= 7 && var.kms_key_deletion_window <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days per AWS requirements"
  }
}

# Bucket destruction safeguard
variable "force_destroy" {
  description = "Allow destruction of non-empty bucket (disabled by default for data protection)"
  type        = bool
  default     = false
}

# Encryption configuration
variable "enable_encryption" {
  description = "Enable server-side encryption using KMS (required for HIPAA compliance)"
  type        = bool
  default     = true
  
  validation {
    condition     = var.enable_encryption == true
    error_message = "Encryption must be enabled for HIPAA compliance"
  }
}

# Resource tagging
variable "tags" {
  description = "Tags to be applied to all resources for organization and compliance tracking"
  type        = map(string)
  default = {
    Compliance        = "HIPAA"
    DataClassification = "PHI"
  }
}