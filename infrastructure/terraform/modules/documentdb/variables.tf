# Required Terraform version
terraform {
  required_version = "~> 1.5"
}

# Cluster name with validation for naming conventions
variable "cluster_name" {
  description = "Name of the DocumentDB cluster"
  type        = string
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must start with a letter and can contain only letters, numbers, and hyphens."
  }
}

# Instance class with validation for supported types
variable "instance_class" {
  description = "Instance class for DocumentDB nodes"
  type        = string
  
  validation {
    condition     = can(regex("^db\\.r[56]\\.((large)|(xlarge)|(2xlarge)|(4xlarge)|(8xlarge)|(12xlarge)|(16xlarge)|(24xlarge))$", var.instance_class))
    error_message = "Instance class must be a valid DocumentDB instance type (e.g., db.r5.large, db.r6.xlarge)."
  }
}

# Number of instances with minimum requirements
variable "instance_count" {
  description = "Number of instances in the DocumentDB cluster"
  type        = number
  
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 16
    error_message = "Instance count must be between 1 and 16."
  }
}

# Master username with character validation
variable "master_username" {
  description = "Master username for DocumentDB cluster"
  type        = string
  sensitive   = true
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.master_username)) && length(var.master_username) >= 1 && length(var.master_username) <= 63
    error_message = "Master username must start with a letter, contain only alphanumeric characters or underscores, and be 1-63 characters long."
  }
}

# Master password with complexity requirements
variable "master_password" {
  description = "Master password for DocumentDB cluster"
  type        = string
  sensitive   = true
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9_@#$%^&*()-+=]{8,100}$", var.master_password)) && can(regex("[A-Z]", var.master_password)) && can(regex("[a-z]", var.master_password)) && can(regex("[0-9]", var.master_password)) && can(regex("[@#$%^&*()-+=]", var.master_password))
    error_message = "Master password must be 8-100 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
  }
}

# Backup retention period validation
variable "backup_retention_period" {
  description = "Number of days to retain automated backups (1-35 days)"
  type        = number
  default     = 7
  
  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# Backup window format validation
variable "preferred_backup_window" {
  description = "Daily time range in UTC for automated backups (e.g., 02:00-03:00)"
  type        = string
  default     = "03:00-04:00"
  
  validation {
    condition     = can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.preferred_backup_window))
    error_message = "Preferred backup window must be in the format HH:MM-HH:MM in UTC."
  }
}

# VPC ID format validation
variable "vpc_id" {
  description = "VPC ID where DocumentDB cluster will be deployed"
  type        = string
  
  validation {
    condition     = can(regex("^vpc-[a-f0-9]{8,17}$", var.vpc_id))
    error_message = "VPC ID must be a valid vpc-* identifier."
  }
}

# Subnet IDs list validation
variable "subnet_ids" {
  description = "List of subnet IDs for multi-AZ DocumentDB cluster deployment"
  type        = list(string)
  
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs are required for high availability."
  }
}

# CIDR blocks format validation
variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access DocumentDB"
  type        = list(string)
  
  validation {
    condition     = alltrue([for cidr in var.allowed_cidr_blocks : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/([0-9]|[1-2][0-9]|3[0-2])$", cidr))])
    error_message = "All CIDR blocks must be in valid IPv4 CIDR notation (e.g., 10.0.0.0/16)."
  }
}

# Environment validation
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Required tags validation
variable "tags" {
  description = "Resource tags for DocumentDB components"
  type        = map(string)
  
  validation {
    condition     = contains(keys(var.tags), "Project") && contains(keys(var.tags), "Environment") && contains(keys(var.tags), "ManagedBy")
    error_message = "Tags must include at minimum: Project, Environment, and ManagedBy."
  }
}