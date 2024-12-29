# Core Terraform configuration with required providers and versions
# Version: 1.0.0
terraform {
  required_version = ">= 1.0.0"

  required_providers {
    # AWS Provider v5.0+ for HIPAA-compliant infrastructure
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Kubernetes Provider v2.23+ for EKS management
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }

    # Helm Provider v2.11+ for application deployment
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# AWS Provider configuration with HIPAA-compliant settings
provider "aws" {
  region = var.aws_region

  # Enhanced security defaults
  default_tags {
    tags = {
      Environment       = var.environment
      ManagedBy        = "Terraform"
      SecurityLevel    = "HIPAA"
      ComplianceScope  = "PHI"
    }
  }

  # Assume role configuration for enhanced security
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole"
    session_name = "TerraformHIPAADeployment"
  }
}

# Data source for current AWS account information
data "aws_caller_identity" "current" {}

# Data source for EKS cluster configuration
data "aws_eks_cluster" "cluster" {
  name = module.eks.cluster_name

  depends_on = [
    module.eks
  ]
}

# Data source for EKS cluster authentication
data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name

  depends_on = [
    module.eks
  ]
}

# Kubernetes Provider configuration for EKS
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token

  # Enhanced security settings
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name,
      "--region",
      var.aws_region
    ]
  }
}

# Helm Provider configuration for secure application deployment
provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token

    # Enhanced security settings
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.eks.cluster_name,
        "--region",
        var.aws_region
      ]
    }
  }

  # Helm repository configuration
  registry {
    url = "https://charts.helm.sh/stable"
    username = "chart-service-account"
    password = data.aws_secretsmanager_secret_version.helm_password.secret_string
  }
}

# Data source for Helm registry password from AWS Secrets Manager
data "aws_secretsmanager_secret_version" "helm_password" {
  secret_id = "helm-registry-password"
}