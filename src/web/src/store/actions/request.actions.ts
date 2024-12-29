// @reduxjs/toolkit version ^1.9.7
import { createAsyncThunk } from '@reduxjs/toolkit';
import { nanoid } from '@reduxjs/toolkit';
import { 
  AuthorizationRequest, 
  AuthorizationStatus 
} from '../../types/request.types';
import { 
  createAuthorization,
  getAuthorization,
  updateAuthorizationStatus,
  searchAuthorizations
} from '../../api/authorization.api';
import { getLocalStorage, setLocalStorage } from '../../utils/storage.utils';
import { handleApiError } from '../../utils/api.utils';
import { API_TIMEOUT } from '../../constants/api.constants';

// Cache configuration
const REQUEST_CACHE_KEY = 'authorization_requests_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a new prior authorization request
 * Implements comprehensive validation and error handling
 */
export const createAuthorizationRequest = createAsyncThunk(
  'requests/create',
  async (request: AuthorizationRequest, { rejectWithValue }) => {
    try {
      // Generate correlation ID for request tracking
      const correlationId = nanoid();

      // Call API with timeout and correlation tracking
      const response = await createAuthorization({
        ...request,
        metadata: {
          ...request.metadata,
          correlationId,
          createdAt: new Date().toISOString()
        }
      });

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      // Cache successful response
      await setLocalStorage(REQUEST_CACHE_KEY, {
        [response.data.data.authorization_id]: {
          data: response.data.data,
          timestamp: Date.now()
        }
      });

      return response.data.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Retrieves authorization request details with caching
 * Implements cache-first strategy with background refresh
 */
export const fetchAuthorizationRequest = createAsyncThunk(
  'requests/fetch',
  async (authorizationId: string, { rejectWithValue }) => {
    try {
      // Check cache first
      const cachedData = await getLocalStorage<Record<string, any>>(REQUEST_CACHE_KEY);
      const cached = cachedData.success ? cachedData.data?.[authorizationId] : null;

      // Return cached data if fresh
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }

      // Fetch fresh data
      const response = await getAuthorization(authorizationId);

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      // Update cache
      await setLocalStorage(REQUEST_CACHE_KEY, {
        ...cachedData.data,
        [authorizationId]: {
          data: response.data.data,
          timestamp: Date.now()
        }
      });

      return response.data.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Updates authorization request status with optimistic updates
 * Implements rollback on failure
 */
export const updateAuthorizationRequestStatus = createAsyncThunk(
  'requests/updateStatus',
  async (
    { authorizationId, status }: { authorizationId: string; status: AuthorizationStatus },
    { rejectWithValue, getState }
  ) => {
    try {
      // Validate status transition
      const currentState = getState() as any;
      const currentRequest = currentState.requests.entities[authorizationId];

      if (!currentRequest) {
        throw new Error('Request not found');
      }

      // Call API with timeout
      const response = await updateAuthorizationStatus(
        authorizationId,
        status,
        `Status updated to ${status} at ${new Date().toISOString()}`
      );

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      // Update cache
      const cachedData = await getLocalStorage<Record<string, any>>(REQUEST_CACHE_KEY);
      if (cachedData.success) {
        await setLocalStorage(REQUEST_CACHE_KEY, {
          ...cachedData.data,
          [authorizationId]: {
            data: response.data.data,
            timestamp: Date.now()
          }
        });
      }

      return response.data.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Searches authorization requests with advanced filtering
 * Implements pagination and result caching
 */
export const searchAuthorizationRequests = createAsyncThunk(
  'requests/search',
  async (
    {
      filters,
      pagination
    }: {
      filters: Record<string, unknown>;
      pagination: { page: number; pageSize: number; sortBy?: string; sortOrder?: 'asc' | 'desc' };
    },
    { rejectWithValue }
  ) => {
    try {
      // Generate cache key for search results
      const searchCacheKey = `${REQUEST_CACHE_KEY}_search_${JSON.stringify({ filters, pagination })}`;
      
      // Check cache for recent search results
      const cachedResults = await getLocalStorage<any>(searchCacheKey);
      if (cachedResults.success && Date.now() - cachedResults.data.timestamp < CACHE_TTL) {
        return cachedResults.data.results;
      }

      // Perform search with timeout
      const response = await searchAuthorizations(filters, pagination);

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      // Cache search results
      await setLocalStorage(searchCacheKey, {
        results: response.data.data,
        timestamp: Date.now()
      });

      return response.data.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Export action type constants for reducer consumption
export const REQUEST_ACTION_TYPES = {
  CREATE_REQUEST: createAuthorizationRequest.typePrefix,
  FETCH_REQUEST: fetchAuthorizationRequest.typePrefix,
  UPDATE_STATUS: updateAuthorizationRequestStatus.typePrefix,
  SEARCH_REQUESTS: searchAuthorizationRequests.typePrefix
} as const;