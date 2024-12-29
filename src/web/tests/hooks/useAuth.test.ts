/**
 * @fileoverview Comprehensive test suite for useAuth hook
 * @version 1.0.0
 * @package @testing-library/react-hooks ^8.0.1
 * @package @testing-library/react ^14.0.0
 * @package @auth0/auth0-react ^2.0.0
 * @package @jest/globals ^29.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { useAuth } from '../../src/hooks/useAuth';
import { UserRole, Permission, AuthEvent } from '../../src/types/auth.types';
import { LoadingState } from '../../src/types/common.types';

// Mock Redux store
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  useSelector: jest.fn()
}));

// Mock Auth0 client
jest.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: jest.fn()
}));

// Mock configuration
const mockAuth0Config = {
  domain: 'test.auth0.com',
  clientId: 'test-client-id',
  audience: 'https://api.test.com',
  redirectUri: 'https://test.com/callback'
};

// Mock user data
const mockUser = {
  sub: 'auth0|123',
  email: 'test@example.com',
  'https://api.test.com/roles': [UserRole.HEALTHCARE_PROVIDER],
  'https://api.test.com/permissions': [Permission.VIEW_REQUESTS, Permission.SUBMIT_REQUESTS],
  'https://auth0.com/mfa-enrollments': [{ name: 'authenticator' }]
};

describe('useAuth Hook', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock initial auth state
    (useSelector as jest.Mock).mockImplementation((selector) => ({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
      loadingState: 'idle' as LoadingState
    }));
  });

  afterEach(() => {
    // Clean up event listeners
    window.removeEventListener('auth_event', expect.any(Function));
  });

  describe('Authentication Flow', () => {
    it('should handle successful login with OAuth flow', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle login failure gracefully', async () => {
      const { result } = renderHook(() => useAuth());
      const mockError = new Error('Login failed');

      await act(async () => {
        try {
          await result.current.login();
        } catch (error) {
          expect(error).toEqual(mockError);
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Authentication failed. Please try again.');
    });

    it('should handle logout successfully', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should verify MFA enrollment status', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const mfaStatus = await result.current.checkMfaStatus();
        expect(mfaStatus.required).toBe(true);
        expect(mfaStatus.preferredMethod).toBe('authenticator');
      });
    });

    it('should handle MFA challenge response', async () => {
      const { result } = renderHook(() => useAuth());
      const mockMFAResponse = { success: true, sessionToken: 'mfa-token' };

      await act(async () => {
        const response = await result.current.verifyMFA('123456');
        expect(response).toEqual(mockMFAResponse);
      });
    });

    it('should handle MFA timeout', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.verifyMFA('123456', { timeout: 1 });
        } catch (error) {
          expect(error.message).toBe('MFA verification timeout');
        }
      });
    });
  });

  describe('Enterprise SSO Integration', () => {
    it('should validate enterprise connection', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const isEnterprise = await result.current.validateEnterpriseConnection();
        expect(isEnterprise).toBe(true);
      });
    });

    it('should handle enterprise SSO login', async () => {
      const { result } = renderHook(() => useAuth());
      const mockEnterpriseConfig = {
        connection: 'enterprise-sso',
        organization: 'test-org'
      };

      await act(async () => {
        await result.current.login({ ...mockEnterpriseConfig });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.organizationId).toBe('test-org');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should validate user roles correctly', async () => {
      const { result } = renderHook(() => useAuth());

      // Mock authenticated user with role
      (useSelector as jest.Mock).mockImplementation(() => ({
        ...mockUser,
        isAuthenticated: true
      }));

      expect(result.current.checkRole(UserRole.HEALTHCARE_PROVIDER)).toBe(true);
      expect(result.current.checkRole(UserRole.SYSTEM_ADMIN)).toBe(false);
    });

    it('should check permissions correctly', async () => {
      const { result } = renderHook(() => useAuth());

      // Mock authenticated user with permissions
      (useSelector as jest.Mock).mockImplementation(() => ({
        ...mockUser,
        isAuthenticated: true
      }));

      expect(result.current.hasPermission(Permission.VIEW_REQUESTS)).toBe(true);
      expect(result.current.hasPermission(Permission.ADMIN_FUNCTIONS)).toBe(false);
    });
  });

  describe('Token Management', () => {
    it('should handle token refresh successfully', async () => {
      const { result } = renderHook(() => useAuth());
      const mockToken = 'new-access-token';

      await act(async () => {
        const token = await result.current.getToken();
        expect(token).toBe(mockToken);
      });
    });

    it('should handle token expiration', async () => {
      const { result } = renderHook(() => useAuth());

      // Simulate token expiration event
      const expirationEvent: AuthEvent = {
        type: 'session_expired',
        timestamp: new Date()
      };

      await act(async () => {
        window.dispatchEvent(new CustomEvent('auth_event', { detail: expirationEvent }));
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Your session has expired. Please login again.');
    });
  });

  describe('Security Event Monitoring', () => {
    it('should log security events', async () => {
      const mockLogEvent = jest.fn();
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        // Simulate login attempt
        await result.current.login();
        expect(mockLogEvent).toHaveBeenCalledWith({
          type: 'login',
          timestamp: expect.any(Date),
          data: expect.any(Object)
        });
      });
    });

    it('should handle security violations', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          // Attempt unauthorized action
          await result.current.checkRole(UserRole.SYSTEM_ADMIN);
        } catch (error) {
          expect(error.message).toBe('User does not have required role.');
        }
      });
    });
  });
});