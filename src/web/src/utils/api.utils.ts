// axios version ^1.6.0
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, ErrorResponse } from '../types/common.types';
import { getLocalStorage } from './storage.utils';

// API Configuration Constants
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8080';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // milliseconds
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Error Categories
const ERROR_CATEGORIES = {
  NETWORK: 'network',
  AUTH: 'auth',
  SERVER: 'server',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
} as const;

// Status codes eligible for retry
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Creates and configures the API client with interceptors and enhanced error handling
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Request Interceptor
  client.interceptors.request.use(
    async (config) => {
      // Add request timestamp for performance tracking
      config.metadata = { startTime: new Date().getTime() };

      // Add authentication token if available
      const authResponse = await getLocalStorage<string>('auth_token');
      if (authResponse.success && authResponse.data) {
        config.headers.Authorization = `Bearer ${authResponse.data}`;
      }

      // Generate request key for deduplication
      const requestKey = `${config.method}-${config.url}-${JSON.stringify(config.params)}-${JSON.stringify(config.data)}`;
      
      // Check for duplicate in-flight requests
      if (pendingRequests.has(requestKey)) {
        return pendingRequests.get(requestKey);
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response Interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Calculate request duration
      const duration = new Date().getTime() - (response.config.metadata?.startTime || 0);
      
      // Log performance metrics
      console.debug(`Request to ${response.config.url} completed in ${duration}ms`);
      
      return response;
    },
    async (error: AxiosError) => {
      // Handle retry logic
      const config = error.config as AxiosRequestConfig & { _retry?: number };
      
      if (shouldRetry(error) && (!config._retry || config._retry < MAX_RETRIES)) {
        config._retry = (config._retry || 0) + 1;
        const delay = calculateRetryDelay(config._retry);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return client(config);
      }

      return Promise.reject(handleApiError(error));
    }
  );

  return client;
};

/**
 * Determines if a request should be retried based on error type and status
 */
const shouldRetry = (error: AxiosError): boolean => {
  return (
    !error.response || // Network errors
    RETRY_STATUS_CODES.includes(error.response.status) // Retriable status codes
  );
};

/**
 * Calculates exponential backoff delay for retries
 */
const calculateRetryDelay = (retryCount: number): number => {
  return Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1) + Math.random() * 1000,
    10000 // Max delay of 10 seconds
  );
};

/**
 * Enhanced error handling with detailed categorization and logging
 */
export const handleApiError = (error: AxiosError): ErrorResponse => {
  let category = ERROR_CATEGORIES.UNKNOWN;
  let code = 'UNKNOWN_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> = {};

  if (!error.response) {
    // Network errors
    category = ERROR_CATEGORIES.NETWORK;
    code = 'NETWORK_ERROR';
    message = 'Network connection failed';
    details = { error: error.message };
  } else {
    const status = error.response.status;
    const responseData = error.response.data as any;

    // Categorize based on status code
    if (status === 401 || status === 403) {
      category = ERROR_CATEGORIES.AUTH;
      code = status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN';
      message = 'Authentication failed';
    } else if (status === 400 || status === 422) {
      category = ERROR_CATEGORIES.VALIDATION;
      code = 'VALIDATION_ERROR';
      message = responseData?.message || 'Validation failed';
      details = responseData?.details || {};
    } else if (status >= 500) {
      category = ERROR_CATEGORIES.SERVER;
      code = 'SERVER_ERROR';
      message = 'Server error occurred';
    }

    details = {
      ...details,
      status,
      url: error.config?.url,
      method: error.config?.method
    };
  }

  // Log error for monitoring
  console.error(`API Error [${category}]: ${message}`, {
    code,
    details,
    stack: error.stack
  });

  return {
    code,
    message,
    category,
    details,
    timestamp: new Date().toISOString()
  };
};

// Create and export configured API client
export const apiClient = createApiClient();

/**
 * Type-safe wrapper for API responses
 */
export const createApiResponse = <T>(
  data: T,
  error: ErrorResponse | null = null
): ApiResponse<T> => ({
  success: !error,
  data,
  error,
  timestamp: new Date().toISOString(),
  metadata: {}
});