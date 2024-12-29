# AWS Provider configuration
# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for RDS configuration
locals {
  db_name                              = "epa_db"
  engine                               = "postgres"
  engine_version                       = "15.4"
  port                                 = 5432
  storage_type                         = "gp3"
  max_allocated_storage                = 1000
  monitoring_interval                  = 60
  performance_insights_retention_period = 7
  backup_window                        = "03:00-04:00"
  maintenance_window                   = "Mon:04:00-Mon:05:00"
}

# DB Subnet Group for Multi-AZ deployment
resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = format("%s-subnet-group", var.environment)
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name        = format("%s-rds-subnet-group", var.environment)
    Environment = var.environment
  })
}

# Security Group for RDS instance
resource "aws_security_group" "rds_sg" {
  name_prefix = format("%s-rds-sg", var.environment)
  vpc_id      = var.vpc_id

  # Inbound rule for PostgreSQL access
  ingress {
    from_port       = local.port
    to_port         = local.port
    protocol        = "tcp"
    security_groups = []  # To be populated with application security group IDs
    description     = "PostgreSQL access from application layer"
  }

  # Outbound rule for updates and monitoring
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow outbound traffic for updates and monitoring"
  }

  tags = merge(var.tags, {
    Name        = format("%s-rds-security-group", var.environment)
    Environment = var.environment
  })

  lifecycle {
    create_before_destroy = true
  }
}

# RDS Parameter Group for HIPAA compliance
resource "aws_db_parameter_group" "rds_param_group" {
  name_prefix = format("%s-pg15-params", var.environment)
  family      = "postgres15"

  parameter {
    name  = "ssl"
    value = "1"
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = merge(var.tags, {
    Name        = format("%s-rds-parameter-group", var.environment)
    Environment = var.environment
  })

  lifecycle {
    create_before_destroy = true
  }
}

# RDS Instance
resource "aws_db_instance" "rds_instance" {
  identifier     = format("%s-rds", var.environment)
  engine         = local.engine
  engine_version = local.engine_version
  
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = local.storage_type
  
  db_name  = local.db_name
  username = "admin"  # Actual password should be managed through AWS Secrets Manager
  port     = local.port

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  parameter_group_name   = aws_db_parameter_group.rds_param_group.name

  # Storage Auto Scaling
  max_allocated_storage = local.max_allocated_storage

  # Backup Configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = local.backup_window
  maintenance_window     = local.maintenance_window

  # Enhanced Monitoring
  monitoring_interval = local.monitoring_interval
  monitoring_role_arn = aws_iam_role.rds_monitoring_role.arn

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = local.performance_insights_retention_period
  performance_insights_kms_key_id      = var.encryption_key_arn

  # Encryption Configuration
  storage_encrypted = true
  kms_key_id       = var.encryption_key_arn

  # Network Configuration
  publicly_accessible = false

  # Additional Configuration
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = format("%s-rds-final-snapshot", var.environment)

  tags = merge(var.tags, {
    Name        = format("%s-rds-instance", var.environment)
    Environment = var.environment
  })

  depends_on = [
    aws_db_subnet_group.rds_subnet_group,
    aws_security_group.rds_sg,
    aws_db_parameter_group.rds_param_group
  ]
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name_prefix = format("%s-rds-monitoring-role", var.environment)

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = format("%s-rds-monitoring-role", var.environment)
    Environment = var.environment
  })
}

# Attach Enhanced Monitoring Policy
resource "aws_iam_role_policy_attachment" "rds_monitoring_policy" {
  role       = aws_iam_role.rds_monitoring_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "db_instance_endpoint" {
  description = "RDS instance endpoint for application connections"
  value       = aws_db_instance.rds_instance.endpoint
}

output "db_instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.rds_instance.id
}

output "db_security_group_id" {
  description = "Security group ID for RDS instance"
  value       = aws_security_group.rds_sg.id
}