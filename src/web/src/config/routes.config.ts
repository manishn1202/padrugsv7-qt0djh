/**
 * @fileoverview Enhanced route configuration with RBAC, security, and performance optimizations
 * @version 1.0.0
 * @package react ^18.2.0
 */

import { lazy } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { UserRole } from '../types/auth.types';

/**
 * Interface for route metadata with security and performance configurations
 */
interface RouteMetadata {
  /** Audit logging level for the route */
  auditLevel: 'basic' | 'detailed';
  /** Rate limiting threshold (requests per minute) */
  rateLimit: number;
  /** Whether to enable route prefetching */
  prefetch: boolean;
}

/**
 * Enhanced interface for route configuration with security features
 */
interface RouteConfig {
  /** Route path */
  path: string;
  /** Lazy-loaded component */
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Allowed user roles for access */
  allowedRoles: UserRole[];
  /** Exact path matching */
  exact: boolean;
  /** Route metadata for security and performance */
  metadata: RouteMetadata;
}

// Lazy-loaded components with error boundaries
const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Requests = lazy(() => import('../pages/Requests'));
const NewRequest = lazy(() => import('../pages/NewRequest'));
const RequestDetails = lazy(() => import('../pages/RequestDetails'));
const Analytics = lazy(() => import('../pages/Analytics'));
const Settings = lazy(() => import('../pages/Settings'));
const NotFound = lazy(() => import('../pages/NotFound'));

/**
 * Enhanced route configurations with security and performance optimizations
 */
export const ROUTES: Record<string, RouteConfig> = {
  login: {
    path: '/login',
    component: Login,
    allowedRoles: [],
    exact: true,
    metadata: {
      auditLevel: 'basic',
      rateLimit: 100,
      prefetch: true
    }
  },
  dashboard: {
    path: '/dashboard',
    component: Dashboard,
    allowedRoles: [
      UserRole.HEALTHCARE_PROVIDER,
      UserRole.INSURANCE_REVIEWER,
      UserRole.ADMIN_STAFF
    ],
    exact: true,
    metadata: {
      auditLevel: 'detailed',
      rateLimit: 50,
      prefetch: true
    }
  },
  requests: {
    path: '/requests',
    component: Requests,
    allowedRoles: [
      UserRole.HEALTHCARE_PROVIDER,
      UserRole.INSURANCE_REVIEWER,
      UserRole.ADMIN_STAFF
    ],
    exact: true,
    metadata: {
      auditLevel: 'detailed',
      rateLimit: 50,
      prefetch: true
    }
  },
  newRequest: {
    path: '/requests/new',
    component: NewRequest,
    allowedRoles: [
      UserRole.HEALTHCARE_PROVIDER,
      UserRole.ADMIN_STAFF
    ],
    exact: true,
    metadata: {
      auditLevel: 'detailed',
      rateLimit: 30,
      prefetch: false
    }
  },
  requestDetails: {
    path: '/requests/:id',
    component: RequestDetails,
    allowedRoles: [
      UserRole.HEALTHCARE_PROVIDER,
      UserRole.INSURANCE_REVIEWER,
      UserRole.ADMIN_STAFF
    ],
    exact: true,
    metadata: {
      auditLevel: 'detailed',
      rateLimit: 50,
      prefetch: false
    }
  },
  analytics: {
    path: '/analytics',
    component: Analytics,
    allowedRoles: [
      UserRole.HEALTHCARE_PROVIDER,
      UserRole.INSURANCE_REVIEWER,
      UserRole.ADMIN_STAFF
    ],
    exact: true,
    metadata: {
      auditLevel: 'detailed',
      rateLimit: 30,
      prefetch: false
    }
  },
  settings: {
    path: '/settings',
    component: Settings,
    allowedRoles: [UserRole.ADMIN_STAFF],
    exact: true,
    metadata: {
      auditLevel: 'detailed',
      rateLimit: 20,
      prefetch: false
    }
  },
  notFound: {
    path: '*',
    component: NotFound,
    allowedRoles: [],
    exact: false,
    metadata: {
      auditLevel: 'basic',
      rateLimit: 100,
      prefetch: false
    }
  }
};

/**
 * Helper function to get route configuration with security validation
 * @param path - Route path to lookup
 * @returns Route configuration if found and validated
 */
export function getRouteConfig(path: string): RouteConfig | undefined {
  // Validate path parameter
  if (!path || typeof path !== 'string') {
    console.error('Invalid path parameter provided to getRouteConfig');
    return undefined;
  }

  // Find matching route
  const route = Object.values(ROUTES).find(route => {
    if (route.exact) {
      return route.path === path;
    }
    // Handle dynamic routes with parameters
    const routeRegex = new RegExp(
      `^${route.path.replace(/:[^\s/]+/g, '[^/]+')}$`
    );
    return routeRegex.test(path);
  });

  if (!route) {
    console.warn(`No route configuration found for path: ${path}`);
    return undefined;
  }

  return route;
}

/**
 * HOC wrapper for protected routes with enhanced security
 */
export const withProtectedRoute = (
  Component: React.ComponentType,
  config: RouteConfig
) => {
  return function ProtectedRouteWrapper(props: any) {
    return (
      <ProtectedRoute
        requiredRoles={config.allowedRoles}
        telemetryEnabled={config.metadata.auditLevel === 'detailed'}
      >
        <Component {...props} />
      </ProtectedRoute>
    );
  };
};