# Terraform configuration for Enhanced Prior Authorization System - Staging Environment
# Version: 1.0.0

terraform {
  required_version = ">= 1.5.0"

  # Backend configuration for staging environment state management
  backend "s3" {
    bucket         = "epa-terraform-state-staging"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "epa-terraform-locks-staging"
  }

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
}

# Local variables for staging environment
locals {
  environment = "staging"
  common_tags = {
    Environment        = "staging"
    Project           = "EPA System"
    ManagedBy         = "Terraform"
    SecurityLevel     = "HIPAA"
    DataClassification = "PHI"
    CostCenter        = "IT-Staging"
  }
}

# VPC and Networking configuration for staging
module "networking" {
  source = "../../modules/networking"

  vpc_cidr = "10.1.0.0/16"  # Staging-specific CIDR range
  environment = local.environment
  azs = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnets  = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]

  # HIPAA-compliant network configurations
  enable_vpc_flow_logs = true
  flow_logs_retention_days = 365
  enable_network_firewall = true
  
  tags = local.common_tags
}

# EKS cluster configuration for staging workloads
module "eks" {
  source = "../../modules/eks"

  cluster_name    = "epa-staging-cluster"
  cluster_version = "1.27"
  vpc_id          = module.networking.vpc_id
  subnet_ids      = module.networking.private_subnet_ids

  # Node group configuration optimized for staging
  node_groups = {
    general = {
      instance_types = ["t3.xlarge"]
      scaling_config = {
        desired_size = 3
        min_size     = 2
        max_size     = 5
      }
    }
  }

  # HIPAA-compliant cluster configurations
  encryption_config = {
    provider = "aws"
    resources = ["secrets"]
  }
  
  enable_logging = {
    api_server         = true
    audit             = true
    authenticator     = true
    controller_manager = true
    scheduler         = true
  }

  tags = local.common_tags
}

# RDS PostgreSQL configuration for staging database
module "rds" {
  source = "../../modules/rds"

  identifier          = "epa-staging-db"
  instance_class      = "db.r6g.xlarge"
  allocated_storage   = 100
  storage_encrypted   = true
  multi_az           = true
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.private_subnet_ids

  # HIPAA-compliant database configurations
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  deletion_protection    = true
  
  parameter_group_family = "postgres14"
  parameters = [
    {
      name  = "log_statement"
      value = "all"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  ]

  tags = local.common_tags
}

# Outputs for staging environment
output "vpc_id" {
  description = "The ID of the staging VPC"
  value       = module.networking.vpc_id
}

output "eks_cluster_endpoint" {
  description = "The endpoint for the staging EKS cluster"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "database_endpoint" {
  description = "The endpoint for the staging RDS instance"
  value       = module.rds.endpoint
  sensitive   = true
}