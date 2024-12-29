/**
 * @fileoverview Enhanced Redux authentication actions with Auth0, MFA, and RBAC support
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.5
 */

import { createAsyncThunk, createAction } from '@reduxjs/toolkit';
import { AuthState, AuthError, MFAConfig } from '../../types/auth.types';
import { authService } from '../../services/auth.service';

// Constants for authentication timeouts and intervals
const AUTH_TIMEOUT_MS = 300000; // 5 minutes
const TOKEN_REFRESH_INTERVAL_MS = 240000; // 4 minutes

/**
 * Interface for login options
 */
interface LoginOptions {
  connection?: string;
  mfaToken?: string;
  prompt?: 'login' | 'none';
  redirectPath?: string;
}

/**
 * Enhanced login action with MFA and enterprise support
 */
export const loginUser = createAsyncThunk<AuthState, LoginOptions | undefined>(
  'auth/login',
  async (options, { rejectWithValue }) => {
    try {
      // Initialize auth service if needed
      if (!authService.initialized) {
        await authService.initialize();
      }

      // Check MFA requirements before login
      const mfaConfig: MFAConfig = await authService.checkMfaStatus();
      
      // Prepare login options with enhanced security
      const loginOptions = {
        ...options,
        acr_values: mfaConfig.required 
          ? 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'
          : undefined,
        max_age: AUTH_TIMEOUT_MS / 1000, // Convert to seconds
        prompt: options?.prompt || 'login'
      };

      // Initiate login with enhanced options
      await authService.loginWithRedirect(loginOptions);

      // Return initial state while redirecting
      return {
        isAuthenticated: false,
        isLoading: true,
        user: null,
        error: null,
        loadingState: 'loading'
      };
    } catch (error) {
      console.error('Login failed:', error);
      return rejectWithValue({
        code: 'LOGIN_ERROR',
        message: error instanceof Error ? error.message : 'Login failed',
        details: { timestamp: new Date().toISOString() }
      } as AuthError);
    }
  }
);

/**
 * Enhanced logout action with secure cleanup
 */
export const logoutUser = createAsyncThunk<void, { clearLocalStorage?: boolean }>(
  'auth/logout',
  async (options, { rejectWithValue }) => {
    try {
      // Perform secure logout
      await authService.logout({
        returnTo: window.location.origin,
        clientId: process.env.VITE_AUTH0_CLIENT_ID
      });

      // Clear sensitive data from local storage if requested
      if (options?.clearLocalStorage) {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Clear any active sessions or tokens
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      return rejectWithValue({
        code: 'LOGOUT_ERROR',
        message: error instanceof Error ? error.message : 'Logout failed',
        details: { timestamp: new Date().toISOString() }
      } as AuthError);
    }
  }
);

/**
 * Enhanced callback handler with security validations
 */
export const handleAuthCallback = createAsyncThunk<AuthState>(
  'auth/handleCallback',
  async (_, { rejectWithValue }) => {
    try {
      // Process callback with enhanced security checks
      const authState = await authService.handleRedirectCallback();

      // Verify user role and permissions
      const userRole = await authService.getUserRole();
      if (!userRole) {
        throw new Error('Invalid user role');
      }

      // Check MFA completion status
      const mfaStatus = await authService.checkMfaStatus();
      if (mfaStatus.required && !mfaStatus.preferredMethod) {
        throw new Error('MFA setup required');
      }

      // Get current session info
      const sessionInfo = await authService.getSessionInfo();
      
      // Return enhanced auth state
      return {
        ...authState,
        user: {
          ...authState.user,
          role: userRole,
          sessionInfo
        }
      };
    } catch (error) {
      console.error('Auth callback handling failed:', error);
      return rejectWithValue({
        code: 'CALLBACK_ERROR',
        message: error instanceof Error ? error.message : 'Callback processing failed',
        details: { timestamp: new Date().toISOString() }
      } as AuthError);
    }
  }
);

/**
 * Action to update auth loading state
 */
export const setAuthLoading = createAction<boolean>('auth/setLoading');

// Add event listeners for auth events
window.addEventListener('auth_event', (event: CustomEvent) => {
  const { type, data } = event.detail;
  
  switch (type) {
    case 'session_expired':
      // Handle session expiration
      logoutUser({ clearLocalStorage: true });
      break;
    case 'mfa_required':
      // Redirect to MFA setup if needed
      window.location.href = '/mfa-setup';
      break;
    default:
      console.warn('Unhandled auth event:', type);
  }
});