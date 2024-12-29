# Production Environment Terraform Configuration
# Version: 1.0.0
# Purpose: HIPAA-compliant infrastructure deployment with multi-AZ setup

# Local variables for environment-specific configuration
locals {
  environment = "prod"
  common_tags = {
    Environment        = "Production"
    Project           = "EPA System"
    ManagedBy         = "Terraform"
    SecurityLevel     = "HIPAA"
    DataClassification = "PHI"
    ComplianceScope   = "Healthcare"
    BackupFrequency   = "Daily"
    DisasterRecovery  = "Enabled"
  }
}

# KMS key for encryption at rest
resource "aws_kms_key" "main" {
  description             = "KMS key for EPA System production environment encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region           = true

  tags = merge(local.common_tags, {
    Name = "epa-prod-encryption-key"
  })
}

# Networking module for multi-AZ VPC setup
module "networking" {
  source = "../../modules/networking"

  project      = var.project
  environment  = local.environment
  vpc_cidr     = "10.0.0.0/16"
  
  # Multi-AZ subnet configuration
  availability_zones = [
    "us-west-2a",
    "us-west-2b",
    "us-west-2c"
  ]

  # Enhanced security settings
  enable_flow_logs      = true
  flow_logs_retention   = 365
  enable_vpc_endpoints  = true
  enable_nat_gateway    = true
  single_nat_gateway    = false  # Use multiple NAT gateways for HA

  tags = local.common_tags
}

# EKS cluster with enhanced security controls
module "eks" {
  source = "../../modules/eks"

  project               = var.project
  environment          = local.environment
  vpc_id               = module.networking.vpc_id
  subnet_ids           = module.networking.private_subnet_ids
  
  # Production cluster configuration
  cluster_version      = "1.27"
  enable_irsa         = true
  
  # Node group configuration
  node_groups = {
    general = {
      instance_types  = ["m6i.2xlarge"]
      min_size       = 3
      max_size       = 10
      desired_size   = 5
    }
    secured = {
      instance_types  = ["m6i.4xlarge"]
      min_size       = 2
      max_size       = 8
      desired_size   = 4
      taints         = ["SecurityWorkload=true:NoSchedule"]
    }
  }

  # Security configurations
  encryption_config = {
    provider_key_arn = aws_kms_key.main.arn
    resources        = ["secrets"]
  }

  tags = local.common_tags
}

# RDS module for HIPAA-compliant database
module "rds" {
  source = "../../modules/rds"

  project              = var.project
  environment         = local.environment
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.database_subnet_ids
  
  # Production database configuration
  instance_class      = "db.r6g.2xlarge"
  allocated_storage   = 1000
  storage_encrypted   = true
  kms_key_id         = aws_kms_key.main.arn
  
  # High availability configuration
  multi_az           = true
  backup_retention_period = 35
  backup_window      = "03:00-04:00"
  maintenance_window = "Mon:04:00-Mon:05:00"

  # Enhanced security settings
  deletion_protection = true
  skip_final_snapshot = false
  
  tags = local.common_tags
}

# DocumentDB module for HIPAA-compliant document storage
module "documentdb" {
  source = "../../modules/documentdb"

  project             = var.project
  environment        = local.environment
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.database_subnet_ids
  
  # Production cluster configuration
  instance_class     = "db.r6g.2xlarge"
  instance_count     = 3
  
  # Security configuration
  storage_encrypted  = true
  kms_key_id        = aws_kms_key.main.arn
  
  # Backup configuration
  backup_retention_period = 35
  preferred_backup_window = "02:00-03:00"
  
  tags = local.common_tags
}

# Monitoring module for comprehensive observability
module "monitoring" {
  source = "../../modules/monitoring"

  project            = var.project
  environment       = local.environment
  
  # Enhanced monitoring configuration
  enable_detailed_monitoring = true
  retention_in_days        = 365
  
  # Alerting configuration
  alert_endpoints = {
    email = ["security-team@example.com", "ops-team@example.com"]
    sns   = ["arn:aws:sns:us-west-2:${data.aws_caller_identity.current.account_id}:critical-alerts"]
  }

  # Compliance monitoring
  enable_config_rules    = true
  enable_guardduty      = true
  enable_security_hub   = true
  
  # Log aggregation
  cloudwatch_log_groups = {
    application = "/aws/applicationlogs"
    security    = "/aws/securitylogs"
    audit       = "/aws/auditlogs"
  }

  tags = local.common_tags
}

# Security outputs for dependent modules
output "security_outputs" {
  value = {
    kms_key_ids = {
      main = aws_kms_key.main.id
    }
    security_group_ids = {
      eks = module.eks.cluster_security_group_id
      rds = module.rds.security_group_id
      documentdb = module.documentdb.security_group_id
    }
  }
  description = "Security configuration outputs for dependent modules"
}

# Monitoring outputs for operational use
output "monitoring_outputs" {
  value = {
    cloudwatch_log_groups = module.monitoring.log_group_names
    alarm_arns = module.monitoring.alarm_arns
  }
  description = "Monitoring configuration outputs for operational use"
}