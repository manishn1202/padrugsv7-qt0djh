# Output configuration for Enhanced Prior Authorization System Infrastructure
# Version: 1.0.0

# Local variables for output configuration
locals {
  # List of outputs that should be marked as sensitive
  sensitive_outputs = [
    "database_endpoints",
    "security_outputs",
    "cluster_credentials"
  ]

  # Output descriptions with security classifications
  output_descriptions = {
    vpc_outputs = {
      description = "Network infrastructure configuration outputs"
      security_level = "INTERNAL"
    }
    database_endpoints = {
      description = "Secure database connection endpoints"
      security_level = "RESTRICTED"
    }
    cluster_info = {
      description = "Kubernetes cluster configuration"
      security_level = "RESTRICTED"
    }
    security_outputs = {
      description = "Security-related infrastructure outputs"
      security_level = "RESTRICTED"
    }
  }
}

# Network Infrastructure Outputs
output "vpc_outputs" {
  description = "VPC configuration details for network infrastructure"
  value = {
    vpc_id = module.networking.vpc_id
    private_subnet_ids = module.networking.private_subnet_ids
    public_subnet_ids = module.networking.public_subnet_ids
    availability_zones = var.availability_zones
  }
}

# Database Connection Endpoints
output "database_endpoints" {
  description = "Secure database connection endpoints for application services"
  sensitive = true
  value = {
    rds = {
      endpoint = module.rds.endpoint
      port = module.rds.port
      database_name = module.rds.database_name
    }
    documentdb = {
      endpoint = module.documentdb.endpoint
      port = module.documentdb.port
      cluster_members = module.documentdb.cluster_members
    }
    elasticache = {
      primary_endpoint = module.elasticache.endpoint
      reader_endpoint = module.elasticache.reader_endpoint
      port = module.elasticache.port
    }
  }
}

# Kubernetes Cluster Information
output "cluster_info" {
  description = "EKS cluster configuration and access information"
  value = {
    cluster_name = module.eks.cluster_name
    cluster_version = module.eks.cluster_version
    cluster_endpoint = module.eks.cluster_endpoint
    cluster_security_group_id = module.eks.cluster_security_group_id
  }
}

# Security-Related Outputs
output "security_outputs" {
  description = "Security configuration and access control outputs"
  sensitive = true
  value = {
    kms_keys = {
      rds_key_id = module.security.rds_kms_key_id
      eks_key_id = module.security.eks_kms_key_id
      s3_key_id = module.security.s3_kms_key_id
    }
    security_groups = {
      database_security_group_id = module.security.database_security_group_id
      application_security_group_id = module.security.application_security_group_id
      monitoring_security_group_id = module.security.monitoring_security_group_id
    }
    iam_roles = {
      eks_node_role_arn = module.security.eks_node_role_arn
      eks_service_role_arn = module.security.eks_service_role_arn
    }
  }
}

# Storage Configuration
output "storage_outputs" {
  description = "Storage infrastructure configuration and endpoints"
  value = {
    s3_buckets = {
      documents_bucket = module.s3.documents_bucket_name
      audit_logs_bucket = module.s3.audit_logs_bucket_name
      backup_bucket = module.s3.backup_bucket_name
    }
    backup_config = {
      retention_period = var.backup_retention_days
      backup_window = module.rds.backup_window
    }
  }
}

# Monitoring and Logging
output "monitoring_outputs" {
  description = "Monitoring and logging configuration endpoints"
  value = {
    cloudwatch_log_groups = module.monitoring.log_group_names
    metrics_endpoints = module.monitoring.metrics_endpoints
    alerting_topics = module.monitoring.sns_topic_arns
  }
}

# HIPAA Compliance Status
output "compliance_status" {
  description = "HIPAA compliance configuration status"
  value = {
    encryption_enabled = local.hipaa_config.encryption_enabled
    audit_logging_enabled = local.hipaa_config.audit_logging_enabled
    backup_retention_compliant = local.hipaa_config.backup_retention_days >= 2555
    ssl_enforcement = local.hipaa_config.ssl_enforcement
  }
}

# Load Balancer Outputs
output "load_balancer_outputs" {
  description = "Load balancer configuration and endpoints"
  value = {
    internal_lb_dns = module.networking.internal_lb_dns
    external_lb_dns = module.networking.external_lb_dns
    lb_security_group_id = module.networking.lb_security_group_id
  }
}