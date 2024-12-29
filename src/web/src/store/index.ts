/**
 * @fileoverview Root Redux store configuration with enhanced security and monitoring
 * @version 1.0.0
 * @license MIT
 */

// @reduxjs/toolkit version ^1.9.7
import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit';
// redux-thunk version ^2.4.2
import thunk from 'redux-thunk';
// redux-sanitize version ^1.0.0
import { createStateSanitizer } from 'redux-sanitize';
// redux-compress version ^1.0.0
import { compression } from 'redux-compress';

// Import reducers
import analyticsReducer from './reducers/analytics.reducer';
import authReducer from './reducers/auth.reducer';
import requestReducer from './reducers/request.reducer';

// Import types
import { RootState } from '../types/store.types';
import { LoadingState } from '../types/common.types';

/**
 * Security configuration for state sanitization
 */
const sanitizerConfig = {
  replacer: (key: string, value: any) => {
    // Sanitize sensitive data patterns
    if (typeof value === 'string' && /^\d{9}$/.test(value)) { // SSN pattern
      return '[REDACTED]';
    }
    return value;
  },
  allowList: ['auth.isAuthenticated', 'auth.loadingState']
};

/**
 * Custom middleware for HIPAA compliance logging
 */
const hipaaLogger: Middleware = store => next => action => {
  const timestamp = new Date().toISOString();
  const secureLog = {
    type: action.type,
    timestamp,
    user: store.getState().auth?.user?.id || 'anonymous',
    accessType: action.type.startsWith('auth/') ? 'AUTH' : 'DATA'
  };
  
  // Log to secure audit system
  console.info('HIPAA Audit Log:', secureLog);
  return next(action);
};

/**
 * Performance monitoring middleware
 */
const performanceMonitor: Middleware = store => next => action => {
  const start = performance.now();
  const result = next(action);
  const end = performance.now();
  
  if (end - start > 100) { // Log slow actions (>100ms)
    console.warn(`Slow action detected: ${action.type} took ${end - start}ms`);
  }
  
  return result;
};

/**
 * State validation middleware
 */
const stateValidator: Middleware = store => next => action => {
  const result = next(action);
  const newState = store.getState();
  
  // Validate state integrity
  const isValid = Object.values(newState).every(slice => 
    typeof slice === 'object' && slice !== null
  );
  
  if (!isValid) {
    console.error('State integrity violation detected');
    // Reset to safe state
    store.dispatch({ type: 'RESET_STATE' });
  }
  
  return result;
};

/**
 * Create the root reducer with all domain reducers
 */
const rootReducer = combineReducers({
  analytics: analyticsReducer,
  auth: authReducer,
  requests: requestReducer
});

/**
 * Configure Redux store with enhanced security and monitoring
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      // Ignore these action types in serializable check
      ignoredActions: ['auth/loginFulfilled', 'auth/refreshToken'],
      // Ignore these paths in serializable check
      ignoredPaths: ['auth.sessionExpiry', 'requests.optimisticUpdates']
    },
    thunk: {
      extraArgument: {
        // Add any extra arguments for thunks
        apiBaseUrl: process.env.REACT_APP_API_BASE_URL,
        environment: process.env.NODE_ENV
      }
    }
  }).concat([
    thunk,
    hipaaLogger,
    performanceMonitor,
    stateValidator,
    createStateSanitizer(sanitizerConfig),
    compression({
      // Configure compression for large state objects
      threshold: 1024, // Compress objects larger than 1KB
      level: 6 // Compression level (1-9)
    })
  ]),
  devTools: process.env.NODE_ENV !== 'production',
  preloadedState: undefined,
  enhancers: []
});

/**
 * Export type-safe hooks and selectors
 */
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

/**
 * Select loading state across all slices
 */
export const selectGlobalLoadingState = (state: RootState): LoadingState => {
  const loadingStates = [
    state.auth.loadingState,
    state.requests.loading,
    state.analytics.loading
  ];
  
  if (loadingStates.some(state => state === 'loading')) return 'loading';
  if (loadingStates.some(state => state === 'failed')) return 'failed';
  if (loadingStates.every(state => state === 'succeeded')) return 'succeeded';
  return 'idle';
};

/**
 * Select global error state
 */
export const selectGlobalError = (state: RootState) => ({
  auth: state.auth.error,
  requests: state.requests.error,
  analytics: state.analytics.error
});

// Export configured store as default
export default store;