# Terraform variables definition file for EKS module
# Required Terraform version: >=1.5.0

variable "cluster_name" {
  description = "Name of the EKS cluster for the Enhanced PA System"
  type        = string

  validation {
    condition     = length(var.cluster_name) > 0 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must start with a letter and only contain alphanumeric characters and hyphens"
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "kubernetes_version" {
  description = "Kubernetes version for the EKS cluster (must be 1.27 or higher)"
  type        = string
  default     = "1.27"

  validation {
    condition     = can(regex("^1\\.(2[7-9]|[3-9][0-9])$", var.kubernetes_version))
    error_message = "Kubernetes version must be 1.27 or higher"
  }
}

variable "vpc_id" {
  description = "ID of the VPC where EKS cluster will be deployed"
  type        = string

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be valid and start with 'vpc-'"
  }
}

variable "private_subnets" {
  description = "List of private subnet IDs for EKS node groups (minimum 2 for high availability)"
  type        = list(string)

  validation {
    condition     = length(var.private_subnets) >= 2
    error_message = "At least 2 private subnets must be provided for high availability"
  }
}

variable "node_groups" {
  description = "Configuration for EKS node groups including general purpose, CPU optimized, and GPU nodes"
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    min_size      = number
    max_size      = number
    disk_size     = number
    labels        = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
    capacity_type = string
  }))

  validation {
    condition     = length(var.node_groups) > 0
    error_message = "At least one node group must be defined"
  }
}

variable "cluster_addons" {
  description = "Map of EKS cluster add-ons to enable with versions"
  type = map(object({
    version           = string
    resolve_conflicts = string
  }))

  default = {
    vpc-cni = {
      version           = "v1.12.0"
      resolve_conflicts = "OVERWRITE"
    }
    coredns = {
      version           = "v1.9.3"
      resolve_conflicts = "OVERWRITE"
    }
    kube-proxy = {
      version           = "v1.27.1"
      resolve_conflicts = "OVERWRITE"
    }
  }
}

variable "tags" {
  description = "Tags to apply to all resources created for the EKS cluster"
  type        = map(string)
  default = {
    ManagedBy    = "terraform"
    Application  = "enhanced-pa-system"
  }
}