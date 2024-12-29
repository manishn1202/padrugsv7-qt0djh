# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming
locals {
  bucket_name     = "${var.project_name}-${var.environment}-documents"
  kms_alias       = "alias/${var.project_name}-${var.environment}-s3-key"
  log_bucket_name = "${var.project_name}-${var.environment}-s3-logs"
}

# KMS key for S3 bucket encryption
resource "aws_kms_key" "this" {
  description             = "KMS key for ${local.bucket_name} encryption"
  deletion_window_in_days = var.kms_key_deletion_window
  enable_key_rotation     = true
  
  # Required for HIPAA compliance
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
  
  tags = merge(var.tags, {
    Name = local.kms_alias
  })
}

# KMS alias for easier key management
resource "aws_kms_alias" "this" {
  name          = local.kms_alias
  target_key_id = aws_kms_key.this.key_id
}

# Log bucket for S3 access logging
resource "aws_s3_bucket" "logs" {
  bucket = local.log_bucket_name
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Name = local.log_bucket_name
  })
}

# Main document storage bucket
resource "aws_s3_bucket" "this" {
  bucket = local.bucket_name
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Name = local.bucket_name
  })
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for document history
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

# Configure server-side encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.this.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Configure lifecycle rules for data retention
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "document-lifecycle"
    status = "Enabled"

    # Transition to Glacier after 90 days
    transition {
      days          = var.lifecycle_glacier_transition_days
      storage_class = "GLACIER"
    }

    # Delete after 7 years (HIPAA requirement)
    expiration {
      days = var.lifecycle_expiration_days
    }

    # Clean up old versions after 90 days
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Enable access logging
resource "aws_s3_bucket_logging" "this" {
  bucket = aws_s3_bucket.this.id

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "logs/"
}

# Bucket policy for enforcing SSL/TLS
resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSLOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.this.arn,
          "${aws_s3_bucket.this.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport": "false"
          }
        }
      }
    ]
  })
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Outputs for reference by other modules
output "bucket" {
  description = "The S3 bucket details"
  value = {
    id   = aws_s3_bucket.this.id
    arn  = aws_s3_bucket.this.arn
    name = aws_s3_bucket.this.bucket
  }
}

output "kms_key" {
  description = "The KMS key details"
  value = {
    id   = aws_kms_key.this.id
    arn  = aws_kms_key.this.arn
    alias = aws_kms_alias.this.name
  }
}