/**
 * @fileoverview Auth0 configuration and RBAC settings for the Enhanced PA System
 * @version 1.0.0
 * @package @auth0/auth0-spa-js ^2.1.0
 * @package zod ^3.22.0
 */

import { Auth0ClientOptions } from '@auth0/auth0-spa-js';
import { z } from 'zod';
import { UserRole } from '../types/auth.types';

// Validation schemas for configuration values
const domainSchema = z.string()
  .url()
  .regex(/^https:\/\/[a-zA-Z0-9-]+\.auth0\.com$/, 'Domain must be a valid Auth0 domain with HTTPS');

const clientIdSchema = z.string()
  .min(32, 'Client ID must be at least 32 characters')
  .regex(/^[a-zA-Z0-9]{32,}$/, 'Invalid client ID format');

const audienceSchema = z.string()
  .url()
  .startsWith('https://', 'Audience must use HTTPS');

const redirectUriSchema = z.string()
  .url()
  .startsWith('https://', 'Redirect URI must use HTTPS');

const scopeSchema = z.string()
  .min(1)
  .regex(/^[a-zA-Z0-9\s]+$/, 'Invalid scope format');

// Environment variables validation
const requiredEnvVars = {
  domain: process.env.VITE_AUTH0_DOMAIN,
  clientId: process.env.VITE_AUTH0_CLIENT_ID,
  audience: process.env.VITE_AUTH0_AUDIENCE,
  scope: process.env.VITE_AUTH0_SCOPE || 'openid profile email',
  roleNamespace: process.env.VITE_ROLE_NAMESPACE || 'https://api.epa.com/roles'
};

/**
 * Interface for Auth0 configuration with strict typing
 */
interface Auth0Config extends Auth0ClientOptions {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
  scope: string;
  cacheLocation: 'memory' | 'localstorage';
  useRefreshTokens: boolean;
}

/**
 * Interface for role configuration with hierarchy support
 */
interface RoleConfig {
  namespace: string;
  defaultRole: UserRole;
  roleHierarchy: Map<UserRole, UserRole[]>;
}

/**
 * Validates and retrieves Auth0 configuration
 * @throws {Error} If configuration validation fails
 * @returns {Auth0Config} Validated Auth0 configuration
 */
function getAuth0Config(): Auth0Config {
  try {
    // Validate required environment variables
    Object.entries(requiredEnvVars).forEach(([key, value]) => {
      if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    });

    // Validate configuration values
    const domain = domainSchema.parse(requiredEnvVars.domain);
    const clientId = clientIdSchema.parse(requiredEnvVars.clientId);
    const audience = audienceSchema.parse(requiredEnvVars.audience);
    const scope = scopeSchema.parse(requiredEnvVars.scope);

    // Construct and validate redirect URI
    const redirectUri = redirectUriSchema.parse(
      `${window.location.origin}/callback`
    );

    // Return validated configuration
    return {
      domain,
      clientId,
      audience,
      redirectUri,
      scope,
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      advancedOptions: {
        defaultScope: scope
      },
      // HIPAA-compliant security settings
      httpTimeoutInSeconds: 60,
      sessionCheckExpiryDays: 1,
      allowedWebOrigins: [window.location.origin],
      leeway: 60, // 60 seconds clock skew allowance
      useCookiesForTransactions: false // Prevent XSS
    };
  } catch (error) {
    console.error('Auth0 configuration validation failed:', error);
    throw error;
  }
}

/**
 * Role hierarchy configuration with inheritance
 */
const roleHierarchy = new Map<UserRole, UserRole[]>([
  [UserRole.SYSTEM_ADMIN, [
    UserRole.HEALTHCARE_PROVIDER,
    UserRole.INSURANCE_REVIEWER,
    UserRole.ADMIN_STAFF
  ]],
  [UserRole.HEALTHCARE_PROVIDER, []],
  [UserRole.INSURANCE_REVIEWER, []],
  [UserRole.ADMIN_STAFF, []]
]);

/**
 * Validates role configuration
 * @param {RoleConfig} config Role configuration to validate
 * @returns {boolean} Validation result
 */
function validateRoleConfig(config: RoleConfig): boolean {
  try {
    // Validate role namespace
    if (!config.namespace.startsWith('https://')) {
      throw new Error('Role namespace must use HTTPS');
    }

    // Validate default role exists in hierarchy
    if (!config.roleHierarchy.has(config.defaultRole)) {
      throw new Error('Default role must exist in role hierarchy');
    }

    // Check for circular dependencies
    const visited = new Set<UserRole>();
    const checkCircular = (role: UserRole): void => {
      if (visited.has(role)) {
        throw new Error('Circular dependency detected in role hierarchy');
      }
      visited.add(role);
      config.roleHierarchy.get(role)?.forEach(checkCircular);
      visited.delete(role);
    };

    Array.from(config.roleHierarchy.keys()).forEach(checkCircular);

    return true;
  } catch (error) {
    console.error('Role configuration validation failed:', error);
    return false;
  }
}

// Export validated configurations
export const auth0Config = getAuth0Config();

export const roleConfig: RoleConfig = {
  namespace: requiredEnvVars.roleNamespace,
  defaultRole: UserRole.ADMIN_STAFF,
  roleHierarchy
};

// Validate role configuration on initialization
if (!validateRoleConfig(roleConfig)) {
  throw new Error('Invalid role configuration');
}

/**
 * Constants for Auth0 rules and hooks configuration
 */
export const AUTH0_RULES = {
  REQUIRE_MFA: true,
  SESSION_TIMEOUT: 30, // minutes
  PASSWORD_POLICY: {
    min_length: 12,
    require_symbols: true,
    require_numbers: true,
    require_uppercase: true,
    require_lowercase: true
  },
  BRUTE_FORCE_PROTECTION: {
    max_attempts: 5,
    block_duration: 3600 // seconds
  }
};