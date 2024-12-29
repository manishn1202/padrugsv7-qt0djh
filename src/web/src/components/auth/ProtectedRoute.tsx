/**
 * @fileoverview Enhanced Protected Route component with RBAC, telemetry, and error handling
 * @version 1.0.0
 * @package react ^18.2.0
 * @package react-router-dom ^6.x
 */

import React, { useCallback, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../common/Loading';

// Constants for configuration
const DEFAULT_REDIRECT_PATH = '/login';
const ROLE_VALIDATION_CACHE_TTL = 5000; // 5 seconds cache for role validation
const AUTH_ERROR_CODES = {
  INVALID_TOKEN: 'auth/invalid-token',
  EXPIRED_TOKEN: 'auth/expired-token',
  INSUFFICIENT_ROLES: 'auth/insufficient-roles'
} as const;

// Role validation cache interface
interface RoleValidationCache {
  result: boolean;
  timestamp: number;
}

// Cache for role validation results
const roleValidationCache = new Map<string, RoleValidationCache>();

/**
 * Interface for authentication errors
 */
interface AuthError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Props interface for the ProtectedRoute component
 */
interface ProtectedRouteProps {
  /** Child components to render when authorized */
  children: React.ReactNode;
  /** Required roles for access */
  requiredRoles?: string[];
  /** Custom redirect path */
  redirectPath?: string;
  /** Optional fallback component for error states */
  fallbackComponent?: React.ComponentType<{ error: AuthError }>;
  /** Enable telemetry tracking */
  telemetryEnabled?: boolean;
}

/**
 * Custom hook for memoized role validation with caching
 */
const useRoleValidation = (user: any | null, requiredRoles?: string[]): boolean => {
  return useMemo(() => {
    if (!user || !requiredRoles?.length) {
      return true; // No role requirements
    }

    // Generate cache key
    const cacheKey = `${user.sub}-${requiredRoles.join(',')}`;
    const now = Date.now();

    // Check cache
    const cached = roleValidationCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < ROLE_VALIDATION_CACHE_TTL) {
      return cached.result;
    }

    // Validate roles
    const userRoles = user[`${process.env.VITE_AUTH0_AUDIENCE}/roles`] as string[];
    const hasRequiredRole = requiredRoles.some(role => userRoles?.includes(role));

    // Update cache
    roleValidationCache.set(cacheKey, {
      result: hasRequiredRole,
      timestamp: now
    });

    return hasRequiredRole;
  }, [user, requiredRoles]);
};

/**
 * Enhanced Protected Route component with role-based access control,
 * loading states, and error handling
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = React.memo(({
  children,
  requiredRoles,
  redirectPath = DEFAULT_REDIRECT_PATH,
  fallbackComponent: FallbackComponent,
  telemetryEnabled = false
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, error } = useAuth();
  
  // Validate user roles with caching
  const hasRequiredRoles = useRoleValidation(user, requiredRoles);

  /**
   * Handle authentication errors and logging
   */
  const handleAuthError = useCallback((error: AuthError) => {
    if (telemetryEnabled) {
      // Log authentication error for telemetry
      console.error('Authentication error:', {
        code: error.code,
        path: location.pathname,
        timestamp: new Date().toISOString(),
        details: error.details
      });
    }

    if (FallbackComponent) {
      return <FallbackComponent error={error} />;
    }

    return null;
  }, [location.pathname, telemetryEnabled, FallbackComponent]);

  // Show loading state while authenticating
  if (isLoading) {
    return (
      <Loading 
        size="large"
        overlay
        aria-label="Verifying authentication status"
      />
    );
  }

  // Handle authentication errors
  if (error) {
    return handleAuthError({
      code: AUTH_ERROR_CODES.INVALID_TOKEN,
      message: error,
      details: {
        path: location.pathname,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectPath}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Check role-based access
  if (!hasRequiredRoles) {
    const roleError = {
      code: AUTH_ERROR_CODES.INSUFFICIENT_ROLES,
      message: 'Insufficient permissions to access this resource',
      details: {
        requiredRoles,
        userRoles: user?.[`${process.env.VITE_AUTH0_AUDIENCE}/roles`],
        path: location.pathname
      }
    };

    return handleAuthError(roleError);
  }

  // Render protected content
  return <>{children}</>;
});

ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute;
```

This implementation includes:

1. **Enhanced Security Features**:
- Role-based access control with caching
- Comprehensive error handling
- Telemetry tracking for security events
- Type-safe error codes and messages

2. **Performance Optimizations**:
- Memoized role validation with caching
- React.memo for component optimization
- Efficient state management

3. **Enterprise-Ready Features**:
- TypeScript interfaces for type safety
- Comprehensive error handling
- Telemetry support
- Customizable fallback components
- Loading states with accessibility

4. **Accessibility**:
- ARIA labels for loading states
- Semantic HTML structure
- Screen reader support

5. **Error Handling**:
- Detailed error types
- Custom error components
- Telemetry logging
- Security event tracking

6. **Flexibility**:
- Customizable redirect paths
- Optional role requirements
- Fallback component support
- Configurable telemetry

The component can be used like this:

```typescript
// Basic usage
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// With role requirements
<ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
  <AdminPanel />
</ProtectedRoute>

// With custom error handling
<ProtectedRoute
  fallbackComponent={CustomErrorComponent}
  telemetryEnabled
>
  <SecureContent />
</ProtectedRoute>