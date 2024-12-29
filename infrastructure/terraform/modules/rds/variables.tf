# Core Terraform configuration for variable definitions
terraform {
  required_version = "~> 1.5"
}

# VPC Configuration
variable "vpc_id" {
  description = "VPC ID where RDS instance will be deployed"
  type        = string

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier starting with 'vpc-'"
  }
}

# Subnet Configuration
variable "subnet_ids" {
  description = "List of subnet IDs for RDS multi-AZ deployment across availability zones"
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnets required for Multi-AZ deployment"
  }

  validation {
    condition     = can([for s in var.subnet_ids : regex("^subnet-", s)])
    error_message = "All subnet IDs must be valid AWS subnet identifiers starting with 'subnet-'"
  }
}

# Instance Configuration
variable "instance_class" {
  description = "RDS instance class for compute and memory resources, must be HIPAA-eligible instance type"
  type        = string
  default     = "db.r6g.2xlarge"

  validation {
    condition     = can(regex("^db\\.(r6g|r5|m6g|m5)", var.instance_class))
    error_message = "Instance class must be a valid HIPAA-eligible type (db.r6g, r5, m6g, or m5 series)"
  }
}

# Storage Configuration
variable "allocated_storage" {
  description = "Allocated storage size in GB for RDS instance with high-performance SSD storage"
  type        = number
  default     = 100

  validation {
    condition     = var.allocated_storage >= 100 && var.allocated_storage <= 65536
    error_message = "Storage must be between 100 and 65536 GB for production workloads"
  }
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain automated backups for compliance and disaster recovery"
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_period >= 30 && var.backup_retention_period <= 35
    error_message = "Backup retention must be between 30 and 35 days for compliance"
  }
}

# High Availability Configuration
variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability and automatic failover"
  type        = bool
  default     = true

  validation {
    condition     = var.multi_az == true
    error_message = "Multi-AZ must be enabled for production deployments"
  }
}

# Environment Configuration
variable "environment" {
  description = "Environment name for resource tagging and configuration selection"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Encryption Configuration
variable "encryption_key_arn" {
  description = "ARN of KMS key for RDS storage encryption"
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^arn:aws:kms:", var.encryption_key_arn))
    error_message = "Encryption key ARN must be a valid AWS KMS key ARN"
  }
}

# Tagging Configuration
variable "tags" {
  description = "Additional tags for RDS resources including compliance and security markers"
  type        = map(string)
  default = {
    ManagedBy           = "terraform"
    SecurityCompliance  = "hipaa"
    DataClassification = "phi"
  }

  validation {
    condition     = contains(keys(var.tags), "SecurityCompliance")
    error_message = "Tags must include SecurityCompliance marker"
  }
}

# Performance Configuration
variable "performance_insights_enabled" {
  description = "Enable Performance Insights for enhanced monitoring and diagnostics"
  type        = bool
  default     = true
}

# Maintenance Configuration
variable "preferred_maintenance_window" {
  description = "Preferred maintenance window for RDS instance updates"
  type        = string
  default     = "sun:03:00-sun:04:00"

  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-9]{2}:[0-9]{2}-(mon|tue|wed|thu|fri|sat|sun):[0-9]{2}:[0-9]{2}$", var.preferred_maintenance_window))
    error_message = "Maintenance window must be in the format day:hour:minute-day:hour:minute"
  }
}

# Parameter Group Configuration
variable "parameter_group_family" {
  description = "PostgreSQL parameter group family for RDS instance"
  type        = string
  default     = "postgres14"

  validation {
    condition     = can(regex("^postgres[0-9]{2}$", var.parameter_group_family))
    error_message = "Parameter group family must be a valid PostgreSQL version (e.g., postgres14)"
  }
}