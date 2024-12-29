/**
 * @fileoverview Authentication type definitions and interfaces
 * @version 1.0.0
 * @package @auth0/auth0-spa-js ^2.1.0
 */

import { User } from '@auth0/auth0-spa-js';
import { LoadingState } from './common.types';

/**
 * Enumeration of all possible user roles in the system
 */
export enum UserRole {
  HEALTHCARE_PROVIDER = 'HEALTHCARE_PROVIDER',
  INSURANCE_REVIEWER = 'INSURANCE_REVIEWER',
  ADMIN_STAFF = 'ADMIN_STAFF',
  PHARMACY_STAFF = 'PHARMACY_STAFF',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN'
}

/**
 * Enumeration of all granular permissions available in the system
 */
export enum Permission {
  VIEW_REQUESTS = 'VIEW_REQUESTS',
  SUBMIT_REQUESTS = 'SUBMIT_REQUESTS',
  APPROVE_DENY = 'APPROVE_DENY',
  ADMIN_FUNCTIONS = 'ADMIN_FUNCTIONS',
  VIEW_CLINICAL_DATA = 'VIEW_CLINICAL_DATA',
  MANAGE_USERS = 'MANAGE_USERS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS'
}

/**
 * Maps user roles to their default permissions
 */
export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.HEALTHCARE_PROVIDER]: [
    Permission.VIEW_REQUESTS,
    Permission.SUBMIT_REQUESTS,
    Permission.VIEW_CLINICAL_DATA
  ],
  [UserRole.INSURANCE_REVIEWER]: [
    Permission.VIEW_REQUESTS,
    Permission.APPROVE_DENY,
    Permission.VIEW_CLINICAL_DATA
  ],
  [UserRole.ADMIN_STAFF]: [
    Permission.VIEW_REQUESTS,
    Permission.SUBMIT_REQUESTS
  ],
  [UserRole.PHARMACY_STAFF]: [
    Permission.VIEW_REQUESTS,
    Permission.SUBMIT_REQUESTS
  ],
  [UserRole.SYSTEM_ADMIN]: [
    Permission.VIEW_REQUESTS,
    Permission.SUBMIT_REQUESTS,
    Permission.APPROVE_DENY,
    Permission.ADMIN_FUNCTIONS,
    Permission.VIEW_CLINICAL_DATA,
    Permission.MANAGE_USERS,
    Permission.VIEW_ANALYTICS
  ]
};

/**
 * Interface representing the authentication state
 */
export interface AuthState {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether authentication is in progress */
  isLoading: boolean;
  /** The authenticated user object or null if not authenticated */
  user: User | null;
  /** Any authentication error that occurred */
  error: string | null;
  /** Current loading state of authentication operations */
  loadingState: LoadingState;
}

/**
 * Extended user profile interface with complete user information
 */
export interface UserProfile {
  /** Unique identifier for the user */
  id: string;
  /** User's email address */
  email: string;
  /** User's assigned role */
  role: UserRole;
  /** User's granted permissions */
  permissions: Permission[];
  /** ID of the user's organization */
  organizationId: string;
  /** Timestamp of last login */
  lastLogin: Date;
  /** Whether MFA is enabled for the user */
  mfaEnabled: boolean;
  /** Additional profile metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Type definition for authentication errors
 */
export type AuthError = {
  /** Error code for categorization */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error context */
  details: Record<string, unknown>;
};

/**
 * Type guard to check if a user has a specific permission
 */
export function hasPermission(user: UserProfile, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/**
 * Type guard to check if a user has a specific role
 */
export function hasRole(user: UserProfile, role: UserRole): boolean {
  return user.role === role;
}

/**
 * Interface for MFA configuration
 */
export interface MFAConfig {
  /** Whether MFA is required for the user */
  required: boolean;
  /** Preferred MFA method */
  preferredMethod: 'authenticator' | 'sms' | 'email';
  /** Backup codes for MFA */
  backupCodes?: string[];
}

/**
 * Interface for authentication configuration
 */
export interface AuthConfig {
  /** Auth0 domain */
  domain: string;
  /** Auth0 client ID */
  clientId: string;
  /** Redirect URI after login */
  redirectUri: string;
  /** Audience for the API */
  audience: string;
  /** Scope of access */
  scope: string;
  /** MFA configuration */
  mfa?: MFAConfig;
  /** Session timeout in minutes */
  sessionTimeout: number;
}

/**
 * Type for authentication events
 */
export type AuthEvent = {
  /** Type of authentication event */
  type: 'login' | 'logout' | 'mfa_required' | 'session_expired';
  /** Timestamp of the event */
  timestamp: Date;
  /** Additional event data */
  data?: Record<string, unknown>;
};

/**
 * Type for session management
 */
export interface SessionInfo {
  /** Session ID */
  id: string;
  /** Session start time */
  startTime: Date;
  /** Session expiry time */
  expiresAt: Date;
  /** Last activity timestamp */
  lastActivity: Date;
  /** IP address of the session */
  ipAddress: string;
  /** User agent string */
  userAgent: string;
}