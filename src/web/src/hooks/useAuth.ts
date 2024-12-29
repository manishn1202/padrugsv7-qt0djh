/**
 * @fileoverview Enhanced React hook for managing authentication state and operations
 * @version 1.0.0
 * @package react ^18.2.0
 * @package react-redux ^8.1.0
 * @package @auth0/auth0-spa-js ^2.1.0
 */

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AuthState, UserRole, AuthService } from '../services/auth.service';

// Error messages for authentication operations
const AUTH_ERROR_MESSAGES = {
  LOGIN_FAILED: 'Authentication failed. Please try again.',
  LOGOUT_FAILED: 'Failed to logout. Please try again.',
  TOKEN_ERROR: 'Failed to retrieve access token.',
  MFA_REQUIRED: 'Multi-factor authentication is required.',
  ENTERPRISE_CONNECTION_FAILED: 'Enterprise connection validation failed.',
  INVALID_ROLE: 'User does not have required role.',
  INVALID_PERMISSION: 'User does not have required permission.',
  SESSION_EXPIRED: 'Your session has expired. Please login again.'
};

/**
 * Enhanced custom hook for managing authentication state and operations
 * Provides comprehensive authentication functionality with MFA, enterprise SSO,
 * and role-based access control
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector((state: { auth: AuthState }) => state.auth);
  const authService = new AuthService();

  /**
   * Initiates the login process with MFA and enterprise SSO support
   */
  const login = useCallback(async () => {
    try {
      await authService.loginWithRedirect({
        appState: { returnTo: window.location.pathname },
        // Enable MFA prompt
        acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.LOGIN_FAILED);
    }
  }, []);

  /**
   * Handles user logout and cleanup
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout({
        returnTo: window.location.origin
      });
      // Clear local auth state
      dispatch({ type: 'auth/logout' });
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.LOGOUT_FAILED);
    }
  }, [dispatch]);

  /**
   * Retrieves access token with caching
   */
  const getToken = useCallback(async (): Promise<string> => {
    try {
      const token = await authService.getAccessToken({
        timeoutInSeconds: 60,
        cacheMode: 'on'
      });
      return token;
    } catch (error) {
      console.error('Token retrieval failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.TOKEN_ERROR);
    }
  }, []);

  /**
   * Validates if user has specified role
   */
  const checkRole = useCallback((role: UserRole): boolean => {
    if (!authState.user) return false;

    const userRoles = authState.user[`${process.env.VITE_AUTH0_AUDIENCE}/roles`] as string[];
    return userRoles?.includes(role);
  }, [authState.user]);

  /**
   * Checks if user has specific permission
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!authState.user) return false;

    const userPermissions = authState.user[`${process.env.VITE_AUTH0_AUDIENCE}/permissions`] as string[];
    return userPermissions?.includes(permission);
  }, [authState.user]);

  /**
   * Checks MFA status and enrollment
   */
  const checkMfaStatus = useCallback(async () => {
    try {
      const mfaStatus = await authService.checkMfaStatus();
      return mfaStatus;
    } catch (error) {
      console.error('MFA status check failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.MFA_REQUIRED);
    }
  }, []);

  /**
   * Validates enterprise connection configuration
   */
  const validateEnterpriseConnection = useCallback(async (): Promise<boolean> => {
    try {
      const sessionInfo = await authService.getSessionInfo();
      return sessionInfo.id.includes('enterprise');
    } catch (error) {
      console.error('Enterprise connection validation failed:', error);
      throw new Error(AUTH_ERROR_MESSAGES.ENTERPRISE_CONNECTION_FAILED);
    }
  }, []);

  /**
   * Handles authentication callback and session setup
   */
  useEffect(() => {
    const handleAuthCallback = async () => {
      if (window.location.search.includes('code=')) {
        try {
          const authResult = await authService.handleRedirectCallback();
          dispatch({ type: 'auth/loginSuccess', payload: authResult });
        } catch (error) {
          console.error('Auth callback failed:', error);
          dispatch({ type: 'auth/loginFailure', payload: error });
        }
      }
    };

    handleAuthCallback();
  }, [dispatch]);

  /**
   * Monitors authentication session status
   */
  useEffect(() => {
    const handleAuthEvent = (event: CustomEvent) => {
      if (event.detail.type === 'session_expired') {
        dispatch({ type: 'auth/sessionExpired' });
        logout();
      }
    };

    window.addEventListener('auth_event', handleAuthEvent as EventListener);
    return () => {
      window.removeEventListener('auth_event', handleAuthEvent as EventListener);
    };
  }, [dispatch, logout]);

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
    error: authState.error,
    login,
    logout,
    getToken,
    checkRole,
    hasPermission,
    checkMfaStatus,
    validateEnterpriseConnection
  };
};