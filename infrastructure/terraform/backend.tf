# Backend configuration for Enhanced Prior Authorization System
# Version: ~> 1.5
# Purpose: Defines HIPAA-compliant Terraform state management using AWS S3 and DynamoDB

terraform {
  # Enforce minimum Terraform version for security and feature compatibility
  required_version = ">= 1.5.0"

  backend "s3" {
    # S3 bucket configuration for state storage
    bucket = "${var.project}-${var.environment}-terraform-state"
    key    = "${var.environment}/terraform.tfstate"
    region = var.aws_region

    # Enable mandatory encryption for HIPAA compliance
    encrypt        = true
    kms_key_id    = "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:key/terraform-state-key"
    
    # Configure server-side encryption with AWS KMS
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm     = "aws:kms"
          kms_master_key_id = "terraform-state-key"
        }
      }
    }

    # Enable versioning for state file history and recovery
    versioning = true
    
    # Configure DynamoDB table for state locking
    dynamodb_table = "${var.project}-${var.environment}-terraform-lock"
    
    # Workspace management for multiple environments
    workspace_key_prefix = "workspaces"

    # Access control and security settings
    acl           = "private"
    force_destroy = false

    # Configure access logging for audit trail
    logging {
      target_bucket = "${var.project}-${var.environment}-terraform-logs"
      target_prefix = "terraform-state-access-logs/"
    }

    # Configure lifecycle rules for compliance
    lifecycle_rule {
      enabled = true

      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }

      noncurrent_version_transition {
        days          = 60
        storage_class = "GLACIER"
      }

      noncurrent_version_expiration {
        days = 2555  # 7 years retention for HIPAA compliance
      }
    }

    # Enable cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-state-replication"

      rules {
        id     = "terraform-state-replication"
        status = "Enabled"

        destination {
          bucket        = "arn:aws:s3:::${var.project}-${var.environment}-terraform-state-dr"
          storage_class = "STANDARD"
          
          replica_kms_key_id = "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:key/terraform-state-dr-key"
          
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:key/terraform-state-dr-key"
          }
        }

        source_selection_criteria {
          sse_kms_encrypted_objects {
            enabled = true
          }
        }
      }
    }

    # Configure DynamoDB global tables for HA state locking
    dynamodb_endpoint = "dynamodb.${var.aws_region}.amazonaws.com"
    
    # Tags for resource management and compliance
    tags = merge(var.tags, {
      Name        = "${var.project}-${var.environment}-terraform-state"
      Environment = var.environment
      Purpose     = "Terraform State Management"
      Encryption  = "AES256"
      Compliance  = "HIPAA"
    })
  }
}

# Data source for current AWS account information
data "aws_caller_identity" "current" {}