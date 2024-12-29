# Core Terraform functionality
# terraform ~> 1.5

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Must be sufficiently large for healthcare workloads."
  type        = string
  
  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/([16-20])$", var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block in the range /16 to /20 for healthcare workloads."
  }
}

variable "environment" {
  description = "Deployment environment identifier"
  type        = string
  
  validation {
    condition     = contains(["development", "staging", "production", "dr"], var.environment)
    error_message = "Environment must be one of: development, staging, production, dr."
  }
}

variable "region" {
  description = "AWS region for network resources deployment"
  type        = string
  
  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-9][a-z]?$", var.region))
    error_message = "Must be a valid AWS region identifier."
  }
}

variable "availability_zones" {
  description = "List of AWS Availability Zones for high-availability deployment"
  type        = list(string)
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones are required for high availability."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (application tier)"
  type        = list(string)
  
  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "At least 2 private subnets are required for high availability."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (load balancer tier)"
  type        = list(string)
  
  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "At least 2 public subnets are required for high availability."
  }
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for isolated database subnets"
  type        = list(string)
  
  validation {
    condition     = length(var.database_subnet_cidrs) >= 2
    error_message = "At least 2 database subnets are required for high availability."
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnet internet access"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway for cost optimization in non-production environments"
  type        = bool
  default     = false
}

variable "enable_vpn_gateway" {
  description = "Enable VPN Gateway for secure remote access"
  type        = bool
  default     = false
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs for network monitoring and security"
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "Number of days to retain VPC Flow Logs"
  type        = number
  default     = 90
  
  validation {
    condition     = var.flow_logs_retention_days >= 90
    error_message = "Flow logs retention must be at least 90 days for healthcare compliance."
  }
}

variable "tags" {
  description = "Resource tags including required healthcare compliance tags"
  type        = map(string)
  
  validation {
    condition     = contains(keys(var.tags), "HIPAA") && contains(keys(var.tags), "Environment") && contains(keys(var.tags), "DataClassification")
    error_message = "Tags must include HIPAA, Environment, and DataClassification for healthcare compliance."
  }
}