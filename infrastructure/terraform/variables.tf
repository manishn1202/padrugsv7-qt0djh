# Core Terraform functionality for variable definition and validation
terraform {
  required_version = "~> 1.5"
}

# Project name variable with HIPAA compliance considerations
variable "project" {
  description = "Project name for resource naming and tagging with HIPAA compliance"
  type        = string
  default     = "epa-system"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens for consistent resource naming"
  }
}

# Environment variable with strict validation for compliance
variable "environment" {
  description = "Deployment environment with strict validation for compliance"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr for proper resource isolation"
  }
}

# AWS region variable with HIPAA compliance restrictions
variable "aws_region" {
  description = "AWS region for resource deployment with HIPAA compliance consideration"
  type        = string
  default     = "us-west-2"

  validation {
    condition     = can(regex("^us-[a-z]+-[1-2]$", var.aws_region))
    error_message = "AWS region must be a valid US region for HIPAA compliance"
  }
}

# VPC CIDR variable with security validation
variable "vpc_cidr" {
  description = "CIDR block for VPC with security validation"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && can(regex("^10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/16$", var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block in the 10.x.x.x/16 range"
  }
}

# Availability zones variable for multi-AZ deployment
variable "availability_zones" {
  description = "List of availability zones for multi-AZ deployment"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]

  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "At least 3 availability zones required for high availability"
  }
}

# EKS cluster version variable with security compliance
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster with security compliance"
  type        = string
  default     = "1.27"

  validation {
    condition     = can(regex("^1\\.(2[7-9]|[3-9][0-9])$", var.eks_cluster_version))
    error_message = "EKS cluster version must be 1.27 or higher for security compliance"
  }
}

# RDS instance class variable for HIPAA-compliant database deployment
variable "db_instance_class" {
  description = "RDS instance type for HIPAA-compliant database deployment"
  type        = string
  default     = "db.r6g.xlarge"

  validation {
    condition     = can(regex("^db\\.(r6g|r6i|r7g)\\.(xlarge|2xlarge|4xlarge)$", var.db_instance_class))
    error_message = "RDS instance must be a valid memory-optimized instance type for performance requirements"
  }
}

# RDS storage variable with minimum size enforcement
variable "db_storage" {
  description = "RDS storage allocation in GB with minimum size enforcement"
  type        = number
  default     = 100

  validation {
    condition     = var.db_storage >= 100 && var.db_storage <= 16384
    error_message = "RDS storage must be between 100 GB and 16384 GB"
  }
}

# Common resource tags including HIPAA compliance markers
variable "tags" {
  description = "Common resource tags including HIPAA compliance markers"
  type        = map(string)
  default = {
    Project            = "EPA System"
    ManagedBy         = "Terraform"
    SecurityLevel     = "HIPAA"
    ComplianceScope   = "PHI"
    DataClassification = "Sensitive"
    BackupRetention   = "7Years"
  }
}