/**
 * API Constants for Enhanced Prior Authorization System
 * @version 1.0.0
 * @description Defines API-related constants including endpoint paths, headers, timeouts, 
 * and version information for secure, standardized API communication
 */

/**
 * Current API version prefix for all endpoints
 */
export const API_VERSION = 'v1';

/**
 * Comprehensive collection of all API endpoint paths organized by service domain
 */
export const API_ENDPOINTS = {
  AUTHORIZATION: {
    BASE: '/api/v1/authorizations',
    CREATE: '/api/v1/authorizations',
    GET: '/api/v1/authorizations/:id',
    SEARCH: '/api/v1/authorizations/search',
    UPDATE_STATUS: '/api/v1/authorizations/:id/status',
    DOCUMENTS: '/api/v1/authorizations/:id/documents',
    CLINICAL_DATA: '/api/v1/authorizations/:id/clinical-data',
    HISTORY: '/api/v1/authorizations/:id/history'
  },
  DOCUMENT: {
    BASE: '/api/v1/documents',
    UPLOAD: '/api/v1/documents/upload',
    DOWNLOAD: '/api/v1/documents/:id/download',
    ANALYZE: '/api/v1/documents/:id/analyze',
    VALIDATE: '/api/v1/documents/:id/validate',
    METADATA: '/api/v1/documents/:id/metadata'
  },
  ANALYTICS: {
    BASE: '/api/v1/analytics',
    METRICS: '/api/v1/analytics/metrics',
    TRENDS: '/api/v1/analytics/trends',
    REPORTS: '/api/v1/analytics/reports',
    DASHBOARD: '/api/v1/analytics/dashboard',
    EXPORT: '/api/v1/analytics/export'
  },
  WORKFLOW: {
    BASE: '/api/v1/workflow',
    TASKS: '/api/v1/workflow/tasks',
    ASSIGNMENTS: '/api/v1/workflow/assignments',
    QUEUE: '/api/v1/workflow/queue',
    RULES: '/api/v1/workflow/rules'
  }
} as const;

/**
 * Standard HTTP headers for API requests including security and caching controls
 */
export const API_HEADERS = {
  CONTENT_TYPE: 'application/json',
  AUTHORIZATION: 'Bearer ',
  ACCEPT: 'application/json',
  CACHE_CONTROL: 'no-cache, no-store, must-revalidate',
  X_REQUEST_ID: 'x-request-id',
  X_CORRELATION_ID: 'x-correlation-id',
  X_API_KEY: 'x-api-key'
} as const;

/**
 * API request timeout configurations for different operation types (in milliseconds)
 */
export const API_TIMEOUT = {
  DEFAULT: 30000,      // 30 seconds
  LONG: 60000,         // 1 minute
  DOCUMENT_UPLOAD: 120000,  // 2 minutes
  ANALYTICS_EXPORT: 180000  // 3 minutes
} as const;

/**
 * HTTP status codes used across the application
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Type definitions for strongly-typed endpoint paths
export type AuthorizationEndpoints = typeof API_ENDPOINTS.AUTHORIZATION;
export type DocumentEndpoints = typeof API_ENDPOINTS.DOCUMENT;
export type AnalyticsEndpoints = typeof API_ENDPOINTS.ANALYTICS;
export type WorkflowEndpoints = typeof API_ENDPOINTS.WORKFLOW;

// Type definitions for strongly-typed headers
export type ApiHeaders = typeof API_HEADERS;
export type ApiTimeouts = typeof API_TIMEOUT;
export type HttpStatus = typeof HTTP_STATUS;