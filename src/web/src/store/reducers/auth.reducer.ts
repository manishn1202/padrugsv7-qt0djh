/**
 * @fileoverview Enhanced authentication reducer with comprehensive security features
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.5
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, UserRole, Permission, AuthError, UserProfile } from '../../types/auth.types';
import { LoadingState } from '../../types/common.types';
import { encryptState, validateStateIntegrity, generateCSRFToken } from '../utils/security';

// Initial state with secure defaults
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null,
  mfaRequired: false,
  enterpriseConnection: null,
  roles: [],
  sessionExpiry: 0,
  loadingState: 'idle' as LoadingState,
  csrfToken: generateCSRFToken(), // Security enhancement
  lastActivity: Date.now(),
};

/**
 * Enhanced authentication slice with comprehensive security features
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Login flow
    loginPending: (state) => {
      state.isLoading = true;
      state.error = null;
      state.loadingState = 'loading';
      state.lastActivity = Date.now();
    },

    loginFulfilled: (state, action: PayloadAction<{ 
      user: UserProfile; 
      roles: UserRole[]; 
      sessionExpiry: number;
    }>) => {
      if (validateStateIntegrity(state)) {
        state.isAuthenticated = true;
        state.isLoading = false;
        state.user = action.payload.user;
        state.roles = action.payload.roles;
        state.sessionExpiry = action.payload.sessionExpiry;
        state.error = null;
        state.loadingState = 'succeeded';
        state.lastActivity = Date.now();
        state.csrfToken = generateCSRFToken(); // Refresh CSRF token on login
      }
    },

    loginRejected: (state, action: PayloadAction<AuthError>) => {
      state.isAuthenticated = false;
      state.isLoading = false;
      state.user = null;
      state.error = action.payload.message;
      state.loadingState = 'failed';
      state.lastActivity = Date.now();
    },

    // MFA handling
    mfaRequired: (state, action: PayloadAction<{ challengeType: string }>) => {
      state.mfaRequired = true;
      state.isLoading = false;
      state.loadingState = 'idle';
      state.lastActivity = Date.now();
    },

    mfaFulfilled: (state, action: PayloadAction<{ 
      user: UserProfile;
      sessionExpiry: number;
    }>) => {
      if (validateStateIntegrity(state)) {
        state.mfaRequired = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.sessionExpiry = action.payload.sessionExpiry;
        state.loadingState = 'succeeded';
        state.lastActivity = Date.now();
      }
    },

    // Enterprise SSO
    enterpriseConnecting: (state, action: PayloadAction<{ connection: string }>) => {
      state.enterpriseConnection = action.payload.connection;
      state.isLoading = true;
      state.loadingState = 'loading';
      state.lastActivity = Date.now();
    },

    enterpriseFulfilled: (state, action: PayloadAction<{
      user: UserProfile;
      connection: string;
      sessionExpiry: number;
    }>) => {
      if (validateStateIntegrity(state)) {
        state.isAuthenticated = true;
        state.isLoading = false;
        state.user = action.payload.user;
        state.enterpriseConnection = action.payload.connection;
        state.sessionExpiry = action.payload.sessionExpiry;
        state.loadingState = 'succeeded';
        state.lastActivity = Date.now();
      }
    },

    // Session management
    sessionExpired: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = 'Session expired';
      state.sessionExpiry = 0;
      state.loadingState = 'idle';
      state.csrfToken = generateCSRFToken(); // Refresh CSRF token
    },

    refreshToken: (state, action: PayloadAction<{ sessionExpiry: number }>) => {
      if (validateStateIntegrity(state)) {
        state.sessionExpiry = action.payload.sessionExpiry;
        state.lastActivity = Date.now();
        state.csrfToken = generateCSRFToken(); // Refresh CSRF token
      }
    },

    // Logout
    logoutFulfilled: (state) => {
      // Secure state cleanup
      Object.assign(state, {
        ...initialState,
        csrfToken: generateCSRFToken(), // Generate new CSRF token
        lastActivity: Date.now()
      });
    },

    // Permission validation
    validatePermissions: (state, action: PayloadAction<{ 
      requiredPermissions: Permission[] 
    }>) => {
      if (state.user && state.roles.length > 0) {
        const hasRequiredPermissions = action.payload.requiredPermissions.every(
          permission => state.user?.permissions.includes(permission)
        );
        if (!hasRequiredPermissions) {
          state.error = 'Insufficient permissions';
        }
      }
    },

    // Security enhancement - Update last activity
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },

    // Clear errors
    clearError: (state) => {
      state.error = null;
    }
  }
});

// Export actions
export const {
  loginPending,
  loginFulfilled,
  loginRejected,
  mfaRequired,
  mfaFulfilled,
  enterpriseConnecting,
  enterpriseFulfilled,
  sessionExpired,
  refreshToken,
  logoutFulfilled,
  validatePermissions,
  updateLastActivity,
  clearError
} = authSlice.actions;

// Encrypt sensitive state before exporting reducer
const secureReducer = (state: AuthState, action: PayloadAction<any>) => {
  const newState = authSlice.reducer(state, action);
  return encryptState(newState, ['user', 'sessionExpiry']);
};

// Export secure reducer
export default secureReducer;

// Export selector for type-safe state access
export const selectAuth = (state: { auth: AuthState }) => state.auth;