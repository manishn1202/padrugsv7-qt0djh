# AWS ElastiCache Redis Cluster Configuration
# Provider version: ~> 5.0
# Terraform version: >= 1.5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Common tags for resource management and compliance tracking
locals {
  common_tags = {
    Environment         = var.environment
    Project            = "EPA"
    ManagedBy          = "Terraform"
    SecurityCompliance = "HIPAA"
    Encryption         = "Required"
  }
}

# Subnet group for Redis cluster placement in private subnets
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.cluster_name}-subnet-group"
  subnet_ids = var.private_subnet_ids
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.cluster_name}-subnet-group"
    }
  )
}

# Parameter group for Redis configuration optimization
resource "aws_elasticache_parameter_group" "main" {
  family = var.parameter_family
  name   = "${var.cluster_name}-params"
  
  # Performance and security optimizations
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "timeout"
    value = "300"
  }
  
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.cluster_name}-params"
    }
  )
}

# Security group for Redis cluster access control
resource "aws_security_group" "redis" {
  name        = "${var.cluster_name}-redis-sg"
  description = "Security group for Redis cluster access"
  vpc_id      = var.vpc_id

  # Inbound rule for Redis access from private subnets only
  ingress {
    description = "Redis access from private subnets"
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidrs
  }

  # Outbound rule for Redis cluster
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.cluster_name}-redis-sg"
    }
  )
}

# Redis replication group with enhanced security and HA
resource "aws_elasticache_replication_group" "main" {
  replication_group_id          = var.cluster_name
  description                   = "HIPAA-compliant Redis cluster for EPA system"
  node_type                     = var.node_type
  num_cache_clusters           = var.num_cache_nodes
  port                         = var.port
  parameter_group_name         = aws_elasticache_parameter_group.main.name
  subnet_group_name            = aws_elasticache_subnet_group.main.name
  security_group_ids           = [aws_security_group.redis.id]
  
  # High availability configuration
  automatic_failover_enabled   = var.automatic_failover_enabled
  multi_az_enabled            = var.multi_az_enabled
  
  # Encryption configuration for HIPAA compliance
  at_rest_encryption_enabled  = var.at_rest_encryption_enabled
  transit_encryption_enabled  = var.transit_encryption_enabled
  
  # Maintenance and backup configuration
  maintenance_window          = var.maintenance_window
  snapshot_retention_limit    = var.snapshot_retention_limit
  snapshot_window            = "00:00-03:00"  # Non-overlapping with maintenance window
  
  # Notification configuration
  notification_topic_arn      = var.notification_topic_arn

  tags = merge(
    local.common_tags,
    {
      Name = var.cluster_name
    }
  )
}

# Output values for other modules
output "redis_endpoint" {
  description = "Redis cluster endpoints"
  value = {
    primary = aws_elasticache_replication_group.main.primary_endpoint_address
    reader  = aws_elasticache_replication_group.main.reader_endpoint_address
  }
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "redis_configuration" {
  description = "Redis cluster configuration details"
  value = {
    port                = var.port
    parameter_group     = aws_elasticache_parameter_group.main.name
    encryption_at_rest  = var.at_rest_encryption_enabled
    encryption_transit  = var.transit_encryption_enabled
  }
}