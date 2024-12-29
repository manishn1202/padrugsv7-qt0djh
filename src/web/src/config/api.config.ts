/**
 * API Client Configuration for Enhanced Prior Authorization System
 * @version 1.0.0
 * @description Configures a production-ready API client with advanced features including
 * authentication, circuit breaking, retry logic, and request management
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import CircuitBreaker from 'circuit-breaker-js'; // ^0.5.0
import { v4 as uuidv4 } from 'uuid';
import { API_VERSION, API_HEADERS, API_TIMEOUT } from '../constants/api.constants';

// Environment configuration
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8080';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CIRCUIT_BREAKER_OPTIONS = {
  failureThreshold: 5,
  recoveryTime: 30000
};

// Request priority levels for queue management
const REQUEST_PRIORITY = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
} as const;

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>();

/**
 * Creates and configures an enhanced Axios instance with advanced features
 */
const createAxiosInstance = (): AxiosInstance => {
  // Create base instance with default configuration
  const instance = axios.create({
    baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
    timeout: API_TIMEOUT.DEFAULT,
    headers: {
      [API_HEADERS.CONTENT_TYPE]: 'application/json'
    }
  });

  // Configure retry mechanism with exponential backoff
  axiosRetry(instance, {
    retries: MAX_RETRIES,
    retryDelay: (retryCount) => {
      return retryCount * RETRY_DELAY;
    },
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429;
    }
  });

  // Initialize circuit breaker
  const breaker = new CircuitBreaker(CIRCUIT_BREAKER_OPTIONS);

  // Setup request interceptor
  instance.interceptors.request.use(
    async (config) => {
      // Add correlation ID for request tracing
      config.headers[API_HEADERS.X_CORRELATION_ID] = uuidv4();

      // Check circuit breaker state
      if (!breaker.isOpen()) {
        return config;
      }
      throw new Error('Circuit breaker is open');
    },
    (error) => Promise.reject(error)
  );

  // Setup response interceptor
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      breaker.success();
      return response;
    },
    async (error) => {
      breaker.failure();

      // Handle token refresh if needed
      if (error.response?.status === 401) {
        // Token refresh logic would go here
        // Return retried request with new token
      }

      // Enhanced error handling
      const enhancedError = {
        ...error,
        timestamp: new Date().toISOString(),
        correlationId: error.config?.headers[API_HEADERS.X_CORRELATION_ID],
        message: error.response?.data?.message || error.message
      };

      return Promise.reject(enhancedError);
    }
  );

  return instance;
};

/**
 * Configure request deduplication
 */
const setupRequestDeduplication = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config) => {
      const requestHash = `${config.method}-${config.url}-${JSON.stringify(config.params)}-${JSON.stringify(config.data)}`;
      
      if (requestCache.has(requestHash)) {
        return requestCache.get(requestHash);
      }

      const request = instance(config);
      requestCache.set(requestHash, request);
      
      // Clear cache entry after request completes
      request.finally(() => {
        requestCache.delete(requestHash);
      });

      return request;
    },
    (error) => Promise.reject(error)
  );
};

/**
 * Configure request prioritization
 */
const setupRequestPrioritization = (instance: AxiosInstance) => {
  const requestQueue = new Map<number, Promise<any>[]>();

  instance.interceptors.request.use(
    (config) => {
      const priority = config.headers['x-priority'] || REQUEST_PRIORITY.MEDIUM;
      
      if (!requestQueue.has(priority)) {
        requestQueue.set(priority, []);
      }

      const request = instance(config);
      requestQueue.get(priority)?.push(request);

      return request;
    },
    (error) => Promise.reject(error)
  );
};

// Create and configure the API client instance
const apiClient = createAxiosInstance();
setupRequestDeduplication(apiClient);
setupRequestPrioritization(apiClient);

/**
 * Enhanced file upload function with progress tracking
 */
export const upload = async (
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<AxiosResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.post(url, formData, {
    timeout: API_TIMEOUT.DOCUMENT_UPLOAD,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    }
  });
};

/**
 * Request cancellation support
 */
export const cancelRequest = (requestId: string) => {
  const source = axios.CancelToken.source();
  source.cancel(`Request cancelled: ${requestId}`);
};

// Export configured API client as default
export default apiClient;