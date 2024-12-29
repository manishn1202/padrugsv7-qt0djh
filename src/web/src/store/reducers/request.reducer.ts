/**
 * @fileoverview Redux reducer for managing prior authorization request state
 * @version 1.0.0
 * @license MIT
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.7
import { AuthorizationRequest, AuthorizationStatus } from '../../types/request.types';

/**
 * Interface for date range filter
 */
interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

/**
 * Interface for request error details
 */
interface RequestError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Interface for the request reducer state
 */
interface RequestState {
  currentRequest: AuthorizationRequest | null;
  requestList: AuthorizationRequest[];
  requestCache: Record<string, {
    data: AuthorizationRequest;
    timestamp: number;
  }>;
  pendingRequests: Set<string>;
  optimisticUpdates: Map<string, Partial<AuthorizationRequest>>;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
  };
  filters: {
    status: AuthorizationStatus[];
    dateRange: DateRange;
    searchTerm: string;
  };
  loading: boolean;
  error: RequestError | null;
  lastUpdated: number;
}

// Global constants
const REQUEST_SLICE_NAME = 'requests';
const CACHE_TIMEOUT = 300000; // 5 minutes
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

/**
 * Initial state for the request reducer
 */
const initialState: RequestState = {
  currentRequest: null,
  requestList: [],
  requestCache: {},
  pendingRequests: new Set(),
  optimisticUpdates: new Map(),
  pagination: {
    page: 1,
    pageSize: 20,
    totalCount: 0
  },
  filters: {
    status: [],
    dateRange: {
      startDate: null,
      endDate: null
    },
    searchTerm: ''
  },
  loading: false,
  error: null,
  lastUpdated: 0
};

/**
 * Request slice with reducer logic and actions
 */
const requestSlice = createSlice({
  name: REQUEST_SLICE_NAME,
  initialState,
  reducers: {
    setCurrentRequest: (state, action: PayloadAction<AuthorizationRequest | null>) => {
      state.currentRequest = action.payload;
      state.lastUpdated = Date.now();
    },

    clearCurrentRequest: (state) => {
      state.currentRequest = null;
    },

    setRequestList: (state, action: PayloadAction<AuthorizationRequest[]>) => {
      state.requestList = action.payload;
      state.lastUpdated = Date.now();

      // Update cache with new requests
      action.payload.forEach(request => {
        state.requestCache[request.authorization_id] = {
          data: request,
          timestamp: Date.now()
        };
      });
    },

    updateRequestCache: (state, action: PayloadAction<AuthorizationRequest>) => {
      const request = action.payload;
      state.requestCache[request.authorization_id] = {
        data: request,
        timestamp: Date.now()
      };

      // Update request in list if present
      const index = state.requestList.findIndex(r => r.authorization_id === request.authorization_id);
      if (index !== -1) {
        state.requestList[index] = request;
      }

      // Update current request if matching
      if (state.currentRequest?.authorization_id === request.authorization_id) {
        state.currentRequest = request;
      }
    },

    setOptimisticUpdate: (state, action: PayloadAction<{
      requestId: string;
      update: Partial<AuthorizationRequest>;
    }>) => {
      const { requestId, update } = action.payload;
      state.optimisticUpdates.set(requestId, update);
      state.pendingRequests.add(requestId);
    },

    clearOptimisticUpdate: (state, action: PayloadAction<string>) => {
      const requestId = action.payload;
      state.optimisticUpdates.delete(requestId);
      state.pendingRequests.delete(requestId);
    },

    setPagination: (state, action: PayloadAction<{
      page?: number;
      pageSize?: number;
      totalCount?: number;
    }>) => {
      state.pagination = {
        ...state.pagination,
        ...action.payload
      };
    },

    setFilters: (state, action: PayloadAction<Partial<RequestState['filters']>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload
      };
      // Reset pagination when filters change
      state.pagination.page = 1;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<RequestError | null>) => {
      state.error = action.payload;
    },

    cleanupCache: (state) => {
      const now = Date.now();
      Object.entries(state.requestCache).forEach(([id, entry]) => {
        if (now - entry.timestamp > CACHE_TIMEOUT) {
          delete state.requestCache[id];
        }
      });
    }
  }
});

// Export actions
export const {
  setCurrentRequest,
  clearCurrentRequest,
  setRequestList,
  updateRequestCache,
  setOptimisticUpdate,
  clearOptimisticUpdate,
  setPagination,
  setFilters,
  setLoading,
  setError,
  cleanupCache
} = requestSlice.actions;

// Export reducer
export default requestSlice.reducer;

// Export selector helpers
export const selectCurrentRequest = (state: { requests: RequestState }) => state.requests.currentRequest;
export const selectRequestList = (state: { requests: RequestState }) => state.requests.requestList;
export const selectRequestById = (state: { requests: RequestState }, id: string) => 
  state.requests.requestCache[id]?.data;
export const selectPagination = (state: { requests: RequestState }) => state.requests.pagination;
export const selectFilters = (state: { requests: RequestState }) => state.requests.filters;
export const selectLoading = (state: { requests: RequestState }) => state.requests.loading;
export const selectError = (state: { requests: RequestState }) => state.requests.error;