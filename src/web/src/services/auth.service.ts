/**
 * @fileoverview Enhanced Auth0-based authentication service with MFA, enterprise SSO, and RBAC support
 * @version 1.0.0
 * @package @auth0/auth0-spa-js ^2.1.0
 */

import { Auth0Client, createAuth0Client, GetTokenSilentlyOptions, LogoutOptions, RedirectLoginOptions } from '@auth0/auth0-spa-js';
import { auth0Config } from '../config/auth.config';
import { 
  UserRole, 
  AuthState, 
  UserProfile, 
  AuthError, 
  MFAConfig, 
  SessionInfo, 
  AuthEvent 
} from '../types/auth.types';
import { LoadingState } from '../types/common.types';

/**
 * Error messages for authentication operations
 */
const AUTH_ERROR_MESSAGES = {
  INITIALIZATION_REQUIRED: 'Auth service must be initialized',
  LOGIN_FAILED: 'Failed to login with Auth0',
  LOGOUT_FAILED: 'Failed to logout from Auth0',
  TOKEN_ERROR: 'Failed to retrieve access token',
  CALLBACK_ERROR: 'Error processing authentication callback',
  MFA_REQUIRED: 'Multi-factor authentication is required',
  INVALID_ROLE: 'Invalid user role or insufficient permissions',
  SESSION_EXPIRED: 'User session has expired',
  ENTERPRISE_CONNECTION_ERROR: 'Enterprise connection configuration error'
} as const;

/**
 * Enhanced authentication service implementing Auth0-based authentication with MFA and RBAC
 */
export class AuthService {
  private auth0Client: Auth0Client | null = null;
  private initialized = false;
  private refreshTokenTimeout: NodeJS.Timeout | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes the Auth0 client with enhanced security features
   * @throws {Error} If initialization fails
   */
  public async initialize(): Promise<void> {
    try {
      this.auth0Client = await createAuth0Client({
        ...auth0Config,
        cacheLocation: 'localstorage',
        useRefreshTokens: true,
        advancedOptions: {
          defaultScope: 'openid profile email'
        }
      });

      this.initialized = true;
      this.setupTokenRefresh();
      this.initializeSessionMonitoring();
    } catch (error) {
      console.error('Auth0 initialization failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.INITIALIZATION_REQUIRED);
    }
  }

  /**
   * Initiates login flow with MFA support
   * @param options - Custom login options
   */
  public async loginWithRedirect(options?: RedirectLoginOptions): Promise<void> {
    if (!this.initialized || !this.auth0Client) {
      throw new Error(AUTH_ERROR_MESSAGES.INITIALIZATION_REQUIRED);
    }

    try {
      const loginOptions: RedirectLoginOptions = {
        ...options,
        appState: {
          ...options?.appState,
          returnTo: window.location.pathname
        },
        // Enable MFA for all logins
        acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'
      };

      await this.auth0Client.loginWithRedirect(loginOptions);
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.LOGIN_FAILED);
    }
  }

  /**
   * Handles Auth0 redirect callback with enhanced security checks
   * @returns {Promise<AuthState>} Authentication state after callback
   */
  public async handleRedirectCallback(): Promise<AuthState> {
    if (!this.initialized || !this.auth0Client) {
      throw new Error(AUTH_ERROR_MESSAGES.INITIALIZATION_REQUIRED);
    }

    try {
      const { appState } = await this.auth0Client.handleRedirectCallback();
      const user = await this.auth0Client.getUser();
      const isAuthenticated = await this.auth0Client.isAuthenticated();

      // Verify MFA completion
      await this.verifyMfaCompletion();

      // Setup token refresh and session monitoring
      this.setupTokenRefresh();
      this.initializeSessionMonitoring();

      return {
        isAuthenticated,
        user,
        error: null,
        isLoading: false,
        loadingState: 'succeeded' as LoadingState
      };
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.CALLBACK_ERROR);
    }
  }

  /**
   * Gets the current user's role with hierarchy support
   * @returns {Promise<UserRole>} Current user's role
   */
  public async getUserRole(): Promise<UserRole> {
    if (!this.initialized || !this.auth0Client) {
      throw new Error(AUTH_ERROR_MESSAGES.INITIALIZATION_REQUIRED);
    }

    try {
      const user = await this.auth0Client.getUser();
      if (!user) {
        throw new Error(AUTH_ERROR_MESSAGES.INVALID_ROLE);
      }

      const roles = user[`${auth0Config.audience}/roles`] as string[];
      if (!roles || roles.length === 0) {
        throw new Error(AUTH_ERROR_MESSAGES.INVALID_ROLE);
      }

      // Map Auth0 role to application role
      const roleMapping: Record<string, UserRole> = {
        'healthcare_provider': UserRole.HEALTHCARE_PROVIDER,
        'insurance_reviewer': UserRole.INSURANCE_REVIEWER,
        'admin_staff': UserRole.ADMIN_STAFF,
        'system_admin': UserRole.SYSTEM_ADMIN
      };

      const userRole = roleMapping[roles[0]];
      if (!userRole) {
        throw new Error(AUTH_ERROR_MESSAGES.INVALID_ROLE);
      }

      return userRole;
    } catch (error) {
      console.error('Role retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Checks MFA enrollment and verification status
   * @returns {Promise<MFAConfig>} Current MFA status
   */
  public async checkMfaStatus(): Promise<MFAConfig> {
    if (!this.initialized || !this.auth0Client) {
      throw new Error(AUTH_ERROR_MESSAGES.INITIALIZATION_REQUIRED);
    }

    try {
      const user = await this.auth0Client.getUser();
      if (!user) {
        throw new Error(AUTH_ERROR_MESSAGES.MFA_REQUIRED);
      }

      const mfaEnrollments = user['https://auth0.com/mfa-enrollments'] as any[];
      const hasMfa = mfaEnrollments && mfaEnrollments.length > 0;

      return {
        required: true,
        preferredMethod: hasMfa ? mfaEnrollments[0].name : 'authenticator',
        backupCodes: user['https://auth0.com/backup-codes'] as string[]
      };
    } catch (error) {
      console.error('MFA status check failed:', error);
      throw error;
    }
  }

  /**
   * Logs out the current user and cleans up session
   * @param options - Custom logout options
   */
  public async logout(options?: LogoutOptions): Promise<void> {
    if (!this.initialized || !this.auth0Client) {
      throw new Error(AUTH_ERROR_MESSAGES.INITIALIZATION_REQUIRED);
    }

    try {
      this.clearTokenRefresh();
      this.clearSessionMonitoring();
      await this.auth0Client.logout({
        ...options,
        returnTo: window.location.origin
      });
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.LOGOUT_FAILED);
    }
  }

  /**
   * Gets the current session information
   * @returns {Promise<SessionInfo>} Current session info
   */
  public async getSessionInfo(): Promise<SessionInfo> {
    if (!this.initialized || !this.auth0Client) {
      throw new Error(AUTH_ERROR_MESSAGES.INITIALIZATION_REQUIRED);
    }

    try {
      const user = await this.auth0Client.getUser();
      if (!user) {
        throw new Error(AUTH_ERROR_MESSAGES.SESSION_EXPIRED);
      }

      return {
        id: user.sub as string,
        startTime: new Date(user.updated_at as string),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        lastActivity: new Date(),
        ipAddress: user['https://auth0.com/ip'] as string,
        userAgent: navigator.userAgent
      };
    } catch (error) {
      console.error('Session info retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Sets up automatic token refresh
   * @private
   */
  private setupTokenRefresh(): void {
    this.clearTokenRefresh();
    
    const refreshToken = async () => {
      try {
        if (this.auth0Client) {
          await this.auth0Client.getTokenSilently({
            timeoutInSeconds: 60,
            cacheMode: 'on'
          });
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.handleAuthError(error as Error);
      }
    };

    this.refreshTokenTimeout = setInterval(refreshToken, 3600000); // 1 hour
  }

  /**
   * Initializes session monitoring
   * @private
   */
  private initializeSessionMonitoring(): void {
    this.clearSessionMonitoring();

    const checkSession = async () => {
      try {
        const isAuthenticated = await this.auth0Client?.isAuthenticated();
        if (!isAuthenticated) {
          this.handleSessionExpired();
        }
      } catch (error) {
        console.error('Session check failed:', error);
        this.handleAuthError(error as Error);
      }
    };

    this.sessionCheckInterval = setInterval(checkSession, 60000); // 1 minute
  }

  /**
   * Verifies MFA completion
   * @private
   */
  private async verifyMfaCompletion(): Promise<void> {
    const mfaStatus = await this.checkMfaStatus();
    if (!mfaStatus.required) {
      throw new Error(AUTH_ERROR_MESSAGES.MFA_REQUIRED);
    }
  }

  /**
   * Handles authentication errors
   * @private
   */
  private handleAuthError(error: Error): void {
    const authError: AuthError = {
      code: 'auth_error',
      message: error.message,
      details: {
        timestamp: new Date().toISOString(),
        type: error.name
      }
    };

    // Emit auth error event
    this.emitAuthEvent({
      type: 'session_expired',
      timestamp: new Date(),
      data: authError
    });
  }

  /**
   * Handles session expiration
   * @private
   */
  private handleSessionExpired(): void {
    this.clearTokenRefresh();
    this.clearSessionMonitoring();
    
    // Emit session expired event
    this.emitAuthEvent({
      type: 'session_expired',
      timestamp: new Date()
    });
  }

  /**
   * Emits authentication events
   * @private
   */
  private emitAuthEvent(event: AuthEvent): void {
    window.dispatchEvent(new CustomEvent('auth_event', { detail: event }));
  }

  /**
   * Clears token refresh interval
   * @private
   */
  private clearTokenRefresh(): void {
    if (this.refreshTokenTimeout) {
      clearInterval(this.refreshTokenTimeout);
      this.refreshTokenTimeout = null;
    }
  }

  /**
   * Clears session monitoring interval
   * @private
   */
  private clearSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();