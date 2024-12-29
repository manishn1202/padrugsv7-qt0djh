# Main Terraform configuration for Enhanced Prior Authorization System
# Version: 1.0.0

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"  # v5.0
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"  # v2.23
      version = "~> 2.23"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket         = "epa-system-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "epa-system-terraform-locks"
  }
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "${var.project}-${var.environment}"
  
  common_tags = merge(var.tags, {
    Environment       = var.environment
    Project          = var.project
    ManagedBy        = "Terraform"
    SecurityLevel    = "HIPAA"
    ComplianceScope  = "PHI"
    DataEncryption   = "AES256"
    BackupEnabled    = "true"
    MultiAZ          = var.multi_az_enabled
  })

  # HIPAA compliance configurations
  hipaa_config = {
    encryption_enabled     = true
    audit_logging_enabled  = true
    backup_retention_days = var.backup_retention_days
    ssl_enforcement       = true
    deletion_protection   = true
  }
}

# VPC and Networking Module
module "networking" {
  source = "./modules/networking"

  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  environment          = var.environment
  project              = var.project
  
  tags = local.common_tags
}

# EKS Cluster Module
module "eks" {
  source = "./modules/eks"

  cluster_name         = "${local.name_prefix}-cluster"
  cluster_version      = var.eks_cluster_version
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.private_subnet_ids
  environment         = var.environment
  
  # HIPAA-compliant configurations
  encryption_config = {
    provider = "aws"
    resources = ["secrets"]
  }
  
  logging_config = {
    api_server         = true
    audit             = true
    authenticator     = true
    controller_manager = true
    scheduler         = true
  }

  tags = local.common_tags
}

# RDS PostgreSQL Module
module "rds" {
  source = "./modules/rds"

  identifier          = "${local.name_prefix}-db"
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_storage
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.database_subnet_ids
  
  # HIPAA-compliant configurations
  storage_encrypted   = local.hipaa_config.encryption_enabled
  backup_retention_period = local.hipaa_config.backup_retention_days
  multi_az            = var.multi_az_enabled
  deletion_protection = local.hipaa_config.deletion_protection
  
  tags = local.common_tags
}

# DocumentDB Module
module "documentdb" {
  source = "./modules/documentdb"

  cluster_identifier  = "${local.name_prefix}-docdb"
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.database_subnet_ids
  
  # HIPAA-compliant configurations
  storage_encrypted   = local.hipaa_config.encryption_enabled
  backup_retention_period = local.hipaa_config.backup_retention_days
  tls_enabled         = local.hipaa_config.ssl_enforcement
  
  tags = local.common_tags
}

# ElastiCache Redis Module
module "elasticache" {
  source = "./modules/elasticache"

  cluster_id          = "${local.name_prefix}-redis"
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.cache_subnet_ids
  
  # HIPAA-compliant configurations
  transit_encryption_enabled = local.hipaa_config.encryption_enabled
  at_rest_encryption_enabled = local.hipaa_config.encryption_enabled
  auth_token_enabled = true
  multi_az_enabled   = var.multi_az_enabled
  
  tags = local.common_tags
}

# S3 Buckets Module
module "s3" {
  source = "./modules/s3"

  bucket_prefix       = local.name_prefix
  
  # HIPAA-compliant configurations
  versioning_enabled = true
  encryption_enabled = local.hipaa_config.encryption_enabled
  logging_enabled    = local.hipaa_config.audit_logging_enabled
  lifecycle_rules    = {
    transition_glacier_days = 90
    expiration_days        = 2555  # 7 years retention
  }
  
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID with enhanced security configurations"
  value       = module.networking.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Secure EKS cluster endpoint with private access"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "Encrypted RDS endpoint with failover capability"
  value       = module.rds.endpoint
  sensitive   = true
}

output "documentdb_endpoint" {
  description = "Secure DocumentDB endpoint with TLS enforcement"
  value       = module.documentdb.endpoint
  sensitive   = true
}

output "elasticache_endpoint" {
  description = "Encrypted ElastiCache endpoint with auth token"
  value       = module.elasticache.endpoint
  sensitive   = true
}