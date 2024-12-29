# Core Terraform configuration for DR environment
terraform {
  required_version = ">= 1.5.0"
  
  # S3 backend configuration for state management
  backend "s3" {
    bucket         = "epa-system-terraform-state"
    key            = "dr/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    
    # Enhanced security settings for HIPAA compliance
    kms_key_id     = "arn:aws:kms:us-east-1:${data.aws_caller_identity.current.account_id}:key/terraform-state"
    
    # Versioning and logging for compliance
    versioning {
      enabled = true
    }
    logging {
      target_bucket = "epa-system-audit-logs"
      target_prefix = "terraform-state-logs/"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# Local variables for DR environment
locals {
  dr_region = "us-east-1"
  environment = "dr"
  
  # Common tags for HIPAA compliance
  common_tags = {
    Project             = "EPA System"
    Environment         = "DR"
    ManagedBy          = "Terraform"
    SecurityLevel       = "HIPAA"
    ComplianceScope    = "PHI"
    DataClassification = "Sensitive"
    BackupRetention    = "7Years"
  }
}

# Data source for current AWS region
data "aws_region" "current" {}

# Networking module for DR environment
module "networking" {
  source = "../../modules/networking"

  vpc_cidr            = "10.1.0.0/16"  # Different CIDR from primary region
  availability_zones  = ["us-east-1a", "us-east-1b", "us-east-1c"]
  environment         = local.environment
  
  # Enhanced security group rules for DR
  security_group_rules = {
    ingress_rules = [
      {
        description = "VPC peering from primary region"
        from_port   = 0
        to_port     = 65535
        protocol    = "tcp"
        cidr_blocks = ["10.0.0.0/16"]  # Primary region VPC CIDR
      }
    ]
  }

  tags = merge(local.common_tags, {
    NetworkTier = "DR"
  })
}

# EKS module for DR environment
module "eks" {
  source = "../../modules/eks"

  cluster_name        = "epa-system-dr-eks"
  kubernetes_version  = var.eks_cluster_version
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.private_subnet_ids
  
  # Node group configuration for DR
  node_groups = {
    general = {
      desired_size = 3
      min_size     = 3
      max_size     = 6
      instance_types = ["m6i.2xlarge"]
    }
  }

  # Enhanced monitoring and logging
  cluster_logging = {
    enable_api_logging             = true
    enable_audit_logging           = true
    enable_authenticator_logging   = true
    enable_controller_logging      = true
    enable_scheduler_logging       = true
  }

  tags = merge(local.common_tags, {
    ClusterType = "DR"
  })
}

# RDS module for DR (read replica)
module "rds" {
  source = "../../modules/rds"

  identifier          = "epa-system-dr-rds"
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_storage
  
  # Read replica configuration
  replicate_source_db = "arn:aws:rds:us-west-2:${data.aws_caller_identity.current.account_id}:db:epa-system-prod-rds"
  
  # Enhanced backup and security settings
  backup_retention_period = var.backup_retention_days
  multi_az               = true
  storage_encrypted      = true
  
  tags = merge(local.common_tags, {
    DatabaseType = "DR-Replica"
  })
}

# DocumentDB module for DR
module "documentdb" {
  source = "../../modules/documentdb"

  cluster_identifier  = "epa-system-dr-docdb"
  instance_class     = "db.r6g.2xlarge"
  
  # Replication configuration
  replicate_source_db = "arn:aws:docdb:us-west-2:${data.aws_caller_identity.current.account_id}:cluster:epa-system-prod-docdb"
  
  # Enhanced security settings
  storage_encrypted   = true
  kms_key_id         = aws_kms_key.docdb.id

  tags = merge(local.common_tags, {
    DatabaseType = "DR-DocumentDB"
  })
}

# ElastiCache module for DR
module "elasticache" {
  source = "../../modules/elasticache"

  cluster_id         = "epa-system-dr-cache"
  node_type         = "cache.r6g.xlarge"
  num_cache_nodes   = 3
  
  # Enhanced security and replication
  automatic_failover_enabled = true
  multi_az_enabled          = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = merge(local.common_tags, {
    CacheType = "DR-Redis"
  })
}

# S3 module for DR (cross-region replication)
module "s3" {
  source = "../../modules/s3"

  bucket_name = "epa-system-dr-storage"
  
  # Replication configuration
  replication_configuration = {
    role = aws_iam_role.replication.arn
    rules = [{
      id       = "DocumentReplication"
      status   = "Enabled"
      priority = 1
      
      source_selection_criteria = {
        sse_kms_encrypted_objects = {
          enabled = true
        }
      }
      
      destination = {
        bucket        = "arn:aws:s3:::epa-system-prod-storage"
        storage_class = "STANDARD_IA"
      }
    }]
  }

  # Enhanced security settings
  versioning_enabled     = true
  encryption_enabled     = true
  block_public_access    = true
  logging_enabled        = true

  tags = merge(local.common_tags, {
    StorageType = "DR-S3"
  })
}

# Outputs for DR environment
output "dr_vpc_id" {
  description = "DR VPC ID"
  value       = module.networking.vpc_id
}

output "dr_eks_cluster_endpoint" {
  description = "DR EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "dr_rds_endpoint" {
  description = "DR RDS endpoint"
  value       = module.rds.endpoint
}

output "dr_documentdb_endpoint" {
  description = "DR DocumentDB endpoint"
  value       = module.documentdb.endpoint
}