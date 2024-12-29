# Provider and Terraform configuration
# AWS Provider version ~> 5.0
# Kubernetes Provider version ~> 2.23
terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "epa-terraform-dev-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "epa-terraform-dev-locks"
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

# AWS Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Local variables for development environment
locals {
  environment = "dev"
  common_tags = {
    Environment      = "Development"
    Project          = "EPA System"
    ManagedBy       = "Terraform"
    CostCenter      = "Development"
    AutoShutdown    = "true"
    Debug           = "enabled"
  }
}

# Development VPC and Networking Configuration
module "networking" {
  source = "../../modules/networking"

  vpc_cidr              = "10.0.0.0/16"
  environment           = local.environment
  enable_vpc_flow_logs  = true
  enable_debug_endpoints = true

  # Development-specific network configurations
  subnet_configuration = {
    public_subnets = {
      cidr_blocks = ["10.0.0.0/20", "10.0.16.0/20", "10.0.32.0/20"]
      tags = {
        Type = "Public"
      }
    }
    private_subnets = {
      cidr_blocks = ["10.0.48.0/20", "10.0.64.0/20", "10.0.80.0/20"]
      tags = {
        Type = "Private"
      }
    }
  }

  # Enhanced logging for development debugging
  flow_log_config = {
    traffic_type = "ALL"
    log_format   = "parquet"
  }

  tags = local.common_tags
}

# Development EKS Cluster Configuration
module "eks" {
  source = "../../modules/eks"

  cluster_name    = "epa-dev-cluster"
  cluster_version = "1.27"

  # Development-optimized node groups
  node_groups = {
    default = {
      instance_types  = ["t3.medium"]
      desired_size    = 2
      min_size       = 1
      max_size       = 4
      disk_size      = 50
      capacity_type  = "ON_DEMAND"

      labels = {
        Environment = "development"
        Workload    = "general"
      }

      taints = []
    }
  }

  # Enhanced monitoring for development
  enable_detailed_monitoring = true
  
  # Development-specific cluster configurations
  cluster_config = {
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs    = ["0.0.0.0/0"]  # Restrict in production
  }

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnets

  tags = local.common_tags
}

# Development environment outputs
output "vpc_id" {
  description = "Development VPC ID"
  value       = module.networking.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Development EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "debug_endpoints" {
  description = "Development environment debug endpoints"
  value = {
    vpc_flow_logs = module.networking.flow_log_config
    eks_logging   = module.eks.cluster_logging
    monitoring    = module.eks.monitoring_endpoints
  }
  sensitive = false
}

# Additional development-specific security group rules
resource "aws_security_group_rule" "dev_debug_access" {
  type              = "ingress"
  from_port         = 9090
  to_port           = 9090
  protocol          = "tcp"
  cidr_blocks       = [module.networking.vpc_cidr]
  security_group_id = module.eks.cluster_security_group_id
  description       = "Development debug port access"
}

# Development environment specific CloudWatch alarms
resource "aws_cloudwatch_metric_alarm" "dev_cluster_health" {
  alarm_name          = "dev-cluster-health"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "cluster_failed_node_count"
  namespace           = "AWS/EKS"
  period             = "300"
  statistic          = "Maximum"
  threshold          = "2"
  alarm_description  = "Development cluster health monitoring"
  alarm_actions      = []  # Add SNS topic ARN for notifications

  dimensions = {
    ClusterName = module.eks.cluster_name
  }

  tags = local.common_tags
}