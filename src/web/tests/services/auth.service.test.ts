/**
 * @fileoverview Comprehensive test suite for AuthService security features
 * @version 1.0.0
 * @package @jest/globals ^29.0.0
 * @package @auth0/auth0-spa-js ^2.1.0
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Auth0Client } from '@auth0/auth0-spa-js';
import { AuthService } from '../../src/services/auth.service';
import { auth0Config } from '../../src/config/auth.config';
import { UserRole, AuthState, MFAConfig, SessionInfo } from '../../src/types/auth.types';

// Mock Auth0 client
jest.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    loginWithRedirect: jest.fn(),
    handleRedirectCallback: jest.fn(),
    getUser: jest.fn(),
    isAuthenticated: jest.fn(),
    getTokenSilently: jest.fn(),
    logout: jest.fn(),
    checkSession: jest.fn()
  })),
  createAuth0Client: jest.fn().mockImplementation(() => new Auth0Client({}))
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockAuth0Client: jest.Mocked<Auth0Client>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize AuthService
    authService = new AuthService();
    mockAuth0Client = new Auth0Client({}) as jest.Mocked<Auth0Client>;
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear intervals and timeouts
    jest.useRealTimers();
  });

  describe('Core Authentication', () => {
    it('should initialize Auth0 client with secure configuration', async () => {
      await authService.initialize();
      
      expect(mockAuth0Client).toHaveBeenCalledWith({
        ...auth0Config,
        cacheLocation: 'localstorage',
        useRefreshTokens: true,
        advancedOptions: {
          defaultScope: 'openid profile email'
        }
      });
    });

    it('should handle login with enterprise connections', async () => {
      await authService.initialize();
      
      await authService.loginWithRedirect({
        connection: 'enterprise-sso',
        acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'
      });

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith({
        connection: 'enterprise-sso',
        acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
        appState: {
          returnTo: '/'
        }
      });
    });

    it('should process callback with security validation', async () => {
      await authService.initialize();
      
      const mockUser = {
        sub: 'auth0|123',
        email: 'test@example.com',
        'https://auth0.com/mfa-enrollments': [{ name: 'authenticator' }]
      };

      mockAuth0Client.handleRedirectCallback.mockResolvedValue({ appState: {} });
      mockAuth0Client.getUser.mockResolvedValue(mockUser);
      mockAuth0Client.isAuthenticated.mockResolvedValue(true);

      const result = await authService.handleRedirectCallback();

      expect(result).toEqual({
        isAuthenticated: true,
        user: mockUser,
        error: null,
        isLoading: false,
        loadingState: 'succeeded'
      });
    });

    it('should handle logout with session cleanup', async () => {
      await authService.initialize();
      
      await authService.logout();

      expect(mockAuth0Client.logout).toHaveBeenCalledWith({
        returnTo: window.location.origin
      });
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should validate MFA enrollment status', async () => {
      await authService.initialize();
      
      const mockUser = {
        'https://auth0.com/mfa-enrollments': [
          { name: 'authenticator', enrolled_at: new Date().toISOString() }
        ]
      };

      mockAuth0Client.getUser.mockResolvedValue(mockUser);

      const mfaStatus = await authService.checkMfaStatus();

      expect(mfaStatus).toEqual({
        required: true,
        preferredMethod: 'authenticator',
        backupCodes: undefined
      });
    });

    it('should enforce MFA requirement on login', async () => {
      await authService.initialize();
      
      await authService.loginWithRedirect();

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'
        })
      );
    });

    it('should handle MFA challenge during authentication', async () => {
      await authService.initialize();
      
      const mockMfaChallenge = {
        type: 'oob',
        oob_code: '123456'
      };

      mockAuth0Client.handleRedirectCallback.mockRejectedValue({
        error: 'mfa_required',
        error_description: 'MFA is required'
      });

      await expect(authService.handleRedirectCallback()).rejects.toThrow('MFA is required');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should retrieve and validate user role', async () => {
      await authService.initialize();
      
      const mockUser = {
        [`${auth0Config.audience}/roles`]: ['healthcare_provider']
      };

      mockAuth0Client.getUser.mockResolvedValue(mockUser);

      const role = await authService.getUserRole();

      expect(role).toBe(UserRole.HEALTHCARE_PROVIDER);
    });

    it('should enforce role hierarchy', async () => {
      await authService.initialize();
      
      const mockUser = {
        [`${auth0Config.audience}/roles`]: ['system_admin']
      };

      mockAuth0Client.getUser.mockResolvedValue(mockUser);

      const role = await authService.getUserRole();

      expect(role).toBe(UserRole.SYSTEM_ADMIN);
    });

    it('should handle invalid roles', async () => {
      await authService.initialize();
      
      const mockUser = {
        [`${auth0Config.audience}/roles`]: ['invalid_role']
      };

      mockAuth0Client.getUser.mockResolvedValue(mockUser);

      await expect(authService.getUserRole()).rejects.toThrow('Invalid user role');
    });
  });

  describe('Security Compliance', () => {
    it('should validate session security', async () => {
      await authService.initialize();
      
      const mockUser = {
        sub: 'auth0|123',
        updated_at: new Date().toISOString(),
        'https://auth0.com/ip': '127.0.0.1'
      };

      mockAuth0Client.getUser.mockResolvedValue(mockUser);

      const session = await authService.getSessionInfo();

      expect(session).toMatchObject({
        id: 'auth0|123',
        ipAddress: '127.0.0.1',
        userAgent: expect.any(String)
      });
    });

    it('should handle token refresh securely', async () => {
      jest.useFakeTimers();
      await authService.initialize();
      
      // Fast-forward time to trigger token refresh
      jest.advanceTimersByTime(3600000);

      expect(mockAuth0Client.getTokenSilently).toHaveBeenCalledWith({
        timeoutInSeconds: 60,
        cacheMode: 'on'
      });
    });

    it('should monitor session activity', async () => {
      jest.useFakeTimers();
      await authService.initialize();
      
      mockAuth0Client.isAuthenticated.mockResolvedValue(false);

      // Fast-forward time to trigger session check
      jest.advanceTimersByTime(60000);

      // Verify session expiration handling
      expect(mockAuth0Client.isAuthenticated).toHaveBeenCalled();
    });
  });
});