# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources for AZs and KMS key
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_kms_key" "docdb" {
  key_id = "alias/aws/docdb"
}

# Local variables for enhanced configuration
locals {
  cluster_identifier = "${var.environment}-${var.cluster_name}"
  
  common_tags = merge(var.tags, {
    Name        = local.cluster_identifier
    Service     = "DocumentDB"
    CreatedBy   = "Terraform"
    CreatedDate = timestamp()
  })

  # Enhanced monitoring settings
  monitoring_settings = {
    enhanced_monitoring_role_enabled = true
    monitoring_interval             = 30
    performance_insights_enabled    = true
    retention_period               = 7
  }
}

# Security group for DocumentDB cluster
resource "aws_security_group" "docdb" {
  name_prefix = "${local.cluster_identifier}-sg"
  vpc_id      = var.vpc_id
  description = "Security group for DocumentDB cluster ${local.cluster_identifier}"

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "DocumentDB port access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

# Subnet group for multi-AZ deployment
resource "aws_docdb_subnet_group" "main" {
  name        = "${local.cluster_identifier}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for DocumentDB cluster ${local.cluster_identifier}"

  tags = local.common_tags
}

# Custom parameter group for enhanced configuration
resource "aws_docdb_cluster_parameter_group" "main" {
  family      = "docdb5.0"
  name        = "${local.cluster_identifier}-params"
  description = "Custom parameter group for DocumentDB cluster ${local.cluster_identifier}"

  parameter {
    name  = "tls"
    value = "enabled"
  }

  parameter {
    name  = "audit_logs"
    value = "enabled"
  }

  parameter {
    name  = "profiler"
    value = "enabled"
  }

  parameter {
    name  = "ttl_monitor"
    value = "enabled"
  }

  tags = local.common_tags
}

# DocumentDB cluster with enhanced security
resource "aws_docdb_cluster" "main" {
  cluster_identifier              = local.cluster_identifier
  engine                         = "docdb"
  engine_version                 = "5.0.0"
  master_username                = var.master_username
  master_password                = var.master_password
  backup_retention_period        = var.backup_retention_period
  preferred_backup_window        = var.preferred_backup_window
  preferred_maintenance_window   = "sun:04:00-sun:05:00"
  skip_final_snapshot           = false
  final_snapshot_identifier     = "${local.cluster_identifier}-final-${formatdate("YYYYMMDD", timestamp())}"
  storage_encrypted             = true
  kms_key_id                    = data.aws_kms_key.docdb.arn
  vpc_security_group_ids        = [aws_security_group.docdb.id]
  db_subnet_group_name          = aws_docdb_subnet_group.main.name
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.main.name
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]
  deletion_protection           = true
  apply_immediately            = false
  auto_minor_version_upgrade   = true

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      master_password
    ]
  }
}

# DocumentDB cluster instances with AZ distribution
resource "aws_docdb_cluster_instance" "main" {
  count                           = var.instance_count
  identifier                      = "${local.cluster_identifier}-${count.index + 1}"
  cluster_identifier              = aws_docdb_cluster.main.id
  instance_class                  = var.instance_class
  auto_minor_version_upgrade      = true
  preferred_maintenance_window    = "sun:04:00-sun:05:00"
  promotion_tier                 = count.index
  availability_zone              = element(data.aws_availability_zones.available.names, count.index % length(data.aws_availability_zones.available.names))

  # Enhanced monitoring configuration
  enable_performance_insights     = local.monitoring_settings.performance_insights_enabled
  performance_insights_retention_period = local.monitoring_settings.retention_period

  tags = merge(local.common_tags, {
    "NodeIndex" = count.index + 1
  })
}

# Outputs for cluster endpoints and monitoring
output "cluster_endpoint" {
  description = "The cluster endpoint for write operations"
  value       = aws_docdb_cluster.main.endpoint
}

output "cluster_reader_endpoint" {
  description = "The cluster reader endpoint for read operations"
  value       = aws_docdb_cluster.main.reader_endpoint
}

output "cluster_resource_id" {
  description = "The DocumentDB cluster resource ID"
  value       = aws_docdb_cluster.main.cluster_resource_id
}

output "cluster_instances" {
  description = "List of cluster instance identifiers"
  value       = aws_docdb_cluster_instance.main[*].identifier
}

output "security_group_id" {
  description = "The security group ID for the DocumentDB cluster"
  value       = aws_security_group.docdb.id
}