# AWS ElastiCache Redis Cluster Variables
# Terraform Version: ~> 1.5

variable "cluster_name" {
  description = "Name of the ElastiCache Redis cluster"
  type        = string
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.cluster_name))
    error_message = "Cluster name must contain only lowercase letters, numbers, and hyphens"
  }
}

variable "node_type" {
  description = "Instance type for Redis nodes (r6g recommended for production)"
  type        = string
  default     = "cache.r6g.xlarge"
  
  validation {
    condition     = can(regex("^cache\\.(r6g|r6gd|r5|t3)\\.(micro|small|medium|large|xlarge|2xlarge)$", var.node_type))
    error_message = "Node type must be a valid Redis instance type"
  }
}

variable "num_cache_nodes" {
  description = "Number of cache nodes in the Redis cluster (minimum 2 for HA)"
  type        = number
  default     = 2
  
  validation {
    condition     = var.num_cache_nodes >= 2
    error_message = "At least 2 nodes required for high availability"
  }
}

variable "parameter_family" {
  description = "Redis parameter group family version"
  type        = string
  default     = "redis6.x"
  
  validation {
    condition     = contains(["redis6.x", "redis5.0"], var.parameter_family)
    error_message = "Parameter family must be redis6.x or redis5.0"
  }
}

variable "port" {
  description = "Port number for Redis connections (default: 6379)"
  type        = number
  default     = 6379
  
  validation {
    condition     = var.port >= 1024 && var.port <= 65535
    error_message = "Port must be between 1024 and 65535"
  }
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover for Redis cluster (recommended for production)"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ deployment for Redis cluster (recommended for production)"
  type        = bool
  default     = true
}

variable "at_rest_encryption_enabled" {
  description = "Enable encryption at rest for Redis cluster (required for compliance)"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "Enable encryption in transit for Redis cluster (required for compliance)"
  type        = bool
  default     = true
}

variable "maintenance_window" {
  description = "Weekly time range for maintenance operations (UTC)"
  type        = string
  default     = "sun:05:00-sun:09:00"
  
  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]-(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in the format day:HH:MM-day:HH:MM"
  }
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain Redis snapshots"
  type        = number
  default     = 7
  
  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days"
  }
}

variable "private_subnet_cidrs" {
  description = "List of private subnet CIDRs allowed to access Redis"
  type        = list(string)
  
  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All subnet CIDRs must be valid CIDR blocks"
  }
}