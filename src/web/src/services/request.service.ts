/**
 * @fileoverview Enhanced service layer for handling prior authorization request operations
 * @version 1.0.0
 * @license MIT
 */

import { AxiosResponse } from 'axios'; // ^1.6.0
import { retry } from 'axios-retry'; // ^3.8.0
import { AuthorizationRequest, AuthorizationStatus } from '../types/request.types';
import { RequestValidationUtils } from '../utils/validation.utils';
import { ApiResponse, LoadingState, ErrorResponse } from '../types/common.types';
import { debounce, memoize } from 'lodash'; // ^4.17.21

// Configuration constants
const REQUEST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const DEBOUNCE_DELAY = 300;

/**
 * Enhanced service class for managing prior authorization requests
 * Implements caching, batching, and retry mechanisms for improved performance
 */
export class RequestService {
  private validationUtils: RequestValidationUtils;
  private requestCache: Map<string, { data: AuthorizationRequest; timestamp: number }>;
  private pendingRequests: Map<string, Promise<AuthorizationRequest>>;
  private loadingStates: Map<string, LoadingState>;

  constructor(validationUtils: RequestValidationUtils) {
    this.validationUtils = validationUtils;
    this.requestCache = new Map();
    this.pendingRequests = new Map();
    this.loadingStates = new Map();

    // Configure axios-retry for API calls
    retry(this.axiosInstance, {
      retries: MAX_RETRIES,
      retryDelay: retry.exponentialDelay,
      retryCondition: (error) => {
        return retry.isNetworkOrIdempotentRequestError(error) || 
               (error.response?.status === 429); // Retry on rate limit
      }
    });
  }

  /**
   * Creates a new prior authorization request with enhanced validation
   * @param request Authorization request data
   * @returns Promise resolving to created request
   * @throws ValidationError if request is invalid
   */
  public async createRequest(request: AuthorizationRequest): Promise<AuthorizationRequest> {
    try {
      // Validate request data
      const validationResult = await this.validationUtils.validateRequest(request);
      if (!validationResult.isValid) {
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Sanitize request data
      const sanitizedRequest = this.validationUtils.sanitizeRequest(request);

      // Check for duplicate pending requests
      const requestKey = this.generateRequestKey(sanitizedRequest);
      if (this.pendingRequests.has(requestKey)) {
        return this.pendingRequests.get(requestKey)!;
      }

      // Create new request
      const requestPromise = this.createRequestInternal(sanitizedRequest);
      this.pendingRequests.set(requestKey, requestPromise);

      const response = await requestPromise;
      this.pendingRequests.delete(requestKey);
      return response;
    } catch (error) {
      this.handleError('createRequest', error);
      throw error;
    }
  }

  /**
   * Retrieves authorization request details with caching
   * @param authorizationId Authorization request ID
   * @returns Promise resolving to request details
   */
  public async getRequestDetails(authorizationId: string): Promise<AuthorizationRequest> {
    try {
      // Check cache first
      const cachedRequest = this.getCachedRequest(authorizationId);
      if (cachedRequest) {
        return cachedRequest;
      }

      this.setLoadingState(authorizationId, 'loading');
      const response = await this.axiosInstance.get<ApiResponse<AuthorizationRequest>>(
        `/api/v1/authorizations/${authorizationId}`
      );

      const request = response.data.data;
      this.cacheRequest(authorizationId, request);
      this.setLoadingState(authorizationId, 'succeeded');
      return request;
    } catch (error) {
      this.setLoadingState(authorizationId, 'failed');
      this.handleError('getRequestDetails', error);
      throw error;
    }
  }

  /**
   * Updates authorization request status with optimistic updates
   * @param authorizationId Authorization request ID
   * @param status New status
   * @returns Promise resolving to updated request
   */
  public async updateRequestStatus(
    authorizationId: string,
    status: AuthorizationStatus
  ): Promise<AuthorizationRequest> {
    try {
      // Optimistically update cache
      const currentRequest = await this.getRequestDetails(authorizationId);
      const updatedRequest = { ...currentRequest, status };
      this.cacheRequest(authorizationId, updatedRequest);

      const response = await this.axiosInstance.patch<ApiResponse<AuthorizationRequest>>(
        `/api/v1/authorizations/${authorizationId}/status`,
        { status }
      );

      const confirmedRequest = response.data.data;
      this.cacheRequest(authorizationId, confirmedRequest);
      return confirmedRequest;
    } catch (error) {
      // Revert optimistic update on error
      this.requestCache.delete(authorizationId);
      this.handleError('updateRequestStatus', error);
      throw error;
    }
  }

  /**
   * Searches authorization requests with debouncing
   * @param searchParams Search parameters
   * @returns Promise resolving to search results
   */
  public searchRequests = debounce(
    async (searchParams: Record<string, unknown>): Promise<AuthorizationRequest[]> => {
      try {
        const response = await this.axiosInstance.get<ApiResponse<AuthorizationRequest[]>>(
          '/api/v1/authorizations/search',
          { params: searchParams }
        );
        return response.data.data;
      } catch (error) {
        this.handleError('searchRequests', error);
        throw error;
      }
    },
    DEBOUNCE_DELAY
  );

  /**
   * Performs batch updates on multiple authorization requests
   * @param requests Requests to update
   * @returns Promise resolving to updated requests
   */
  public async batchUpdateRequests(
    requests: AuthorizationRequest[]
  ): Promise<AuthorizationRequest[]> {
    try {
      // Process requests in batches
      const batches = this.chunkArray(requests, BATCH_SIZE);
      const results: AuthorizationRequest[] = [];

      for (const batch of batches) {
        const batchPromises = batch.map(request =>
          this.updateRequestStatus(request.authorization_id, request.status)
        );
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Handle partial failures
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Failed to update request ${batch[index].authorization_id}:`, result.reason);
          }
        });
      }

      return results;
    } catch (error) {
      this.handleError('batchUpdateRequests', error);
      throw error;
    }
  }

  /**
   * Internal helper methods
   */
  private async createRequestInternal(request: AuthorizationRequest): Promise<AuthorizationRequest> {
    const response = await this.axiosInstance.post<ApiResponse<AuthorizationRequest>>(
      '/api/v1/authorizations',
      request
    );
    return response.data.data;
  }

  private generateRequestKey(request: AuthorizationRequest): string {
    return `${request.authorization_id}-${JSON.stringify(request.metadata)}`;
  }

  private getCachedRequest(authorizationId: string): AuthorizationRequest | null {
    const cached = this.requestCache.get(authorizationId);
    if (cached && Date.now() - cached.timestamp < REQUEST_CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private cacheRequest(authorizationId: string, request: AuthorizationRequest): void {
    this.requestCache.set(authorizationId, {
      data: request,
      timestamp: Date.now()
    });
  }

  private setLoadingState(authorizationId: string, state: LoadingState): void {
    this.loadingStates.set(authorizationId, state);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
      array.slice(index * size, (index + 1) * size)
    );
  }

  private handleError(operation: string, error: unknown): void {
    const errorResponse: ErrorResponse = {
      code: 'REQUEST_SERVICE_ERROR',
      message: `Error in ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { operation },
      timestamp: new Date().toISOString()
    };
    console.error(errorResponse);
  }
}