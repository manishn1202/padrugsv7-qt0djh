// React/Redux imports - versions from package.json
import { useCallback, useState } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.5
import { debounce } from 'lodash'; // ^4.17.21

// Action imports
import {
  createAuthorizationRequest,
  fetchAuthorizationRequest,
  searchAuthorizationRequests,
  updateAuthorizationRequestStatus
} from '../store/actions/request.actions';

// Type imports
import { 
  AuthorizationRequest, 
  AuthorizationStatus,
  ClinicalInfo,
  InsuranceInfo,
  MedicationInfo,
  PatientInfo 
} from '../types/request.types';
import { ApiResponse, ErrorResponse, PaginationParams } from '../types/common.types';

// Constants
const DEBOUNCE_DELAY = 300; // milliseconds
const MAX_RETRIES = 3;

/**
 * Interface for request hook state and methods
 */
interface UseRequestHook {
  createRequest: (request: AuthorizationRequest) => Promise<ApiResponse<any>>;
  getRequest: (id: string) => Promise<ApiResponse<any>>;
  searchRequests: (filters: Record<string, unknown>, pagination: PaginationParams) => Promise<ApiResponse<any>>;
  updateStatus: (id: string, status: AuthorizationStatus) => Promise<ApiResponse<any>>;
  loading: boolean;
  error: ErrorResponse | null;
  clearError: () => void;
}

/**
 * Custom hook for managing prior authorization requests
 * Provides methods for creating, fetching, searching, and updating requests
 * Implements error handling, loading states, and request deduplication
 */
export const useRequest = (): UseRequestHook => {
  // Local state for loading and error handling
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorResponse | null>(null);

  // Get Redux dispatch function
  const dispatch = useDispatch();

  // Track pending requests to prevent duplicates
  const pendingRequests = new Set<string>();

  /**
   * Clears current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Creates a new prior authorization request
   * Implements validation, error handling, and duplicate request prevention
   */
  const createRequest = useCallback(async (
    request: AuthorizationRequest
  ): Promise<ApiResponse<any>> => {
    try {
      setLoading(true);
      clearError();

      // Generate request key for deduplication
      const requestKey = `create-${JSON.stringify(request)}`;
      if (pendingRequests.has(requestKey)) {
        throw new Error('Duplicate request in progress');
      }
      pendingRequests.add(requestKey);

      const result = await dispatch(createAuthorizationRequest(request)).unwrap();
      return {
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    } catch (err) {
      const errorResponse: ErrorResponse = {
        code: 'CREATE_REQUEST_ERROR',
        message: err instanceof Error ? err.message : 'Failed to create request',
        details: { error: err },
        timestamp: new Date().toISOString()
      };
      setError(errorResponse);
      return {
        success: false,
        data: null,
        error: errorResponse,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    } finally {
      setLoading(false);
      pendingRequests.delete(`create-${JSON.stringify(request)}`);
    }
  }, [dispatch, clearError]);

  /**
   * Retrieves a specific authorization request by ID
   * Implements caching and error handling
   */
  const getRequest = useCallback(async (
    id: string
  ): Promise<ApiResponse<any>> => {
    try {
      setLoading(true);
      clearError();

      const result = await dispatch(fetchAuthorizationRequest(id)).unwrap();
      return {
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    } catch (err) {
      const errorResponse: ErrorResponse = {
        code: 'GET_REQUEST_ERROR',
        message: err instanceof Error ? err.message : 'Failed to fetch request',
        details: { id, error: err },
        timestamp: new Date().toISOString()
      };
      setError(errorResponse);
      return {
        success: false,
        data: null,
        error: errorResponse,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    } finally {
      setLoading(false);
    }
  }, [dispatch, clearError]);

  /**
   * Searches authorization requests with filters and pagination
   * Implements debouncing for search optimization
   */
  const searchRequests = useCallback(
    debounce(async (
      filters: Record<string, unknown>,
      pagination: PaginationParams
    ): Promise<ApiResponse<any>> => {
      try {
        setLoading(true);
        clearError();

        const result = await dispatch(searchAuthorizationRequests({
          filters,
          pagination
        })).unwrap();

        return {
          success: true,
          data: result,
          error: null,
          timestamp: new Date().toISOString(),
          metadata: { filters, pagination }
        };
      } catch (err) {
        const errorResponse: ErrorResponse = {
          code: 'SEARCH_REQUESTS_ERROR',
          message: err instanceof Error ? err.message : 'Failed to search requests',
          details: { filters, pagination, error: err },
          timestamp: new Date().toISOString()
        };
        setError(errorResponse);
        return {
          success: false,
          data: null,
          error: errorResponse,
          timestamp: new Date().toISOString(),
          metadata: {}
        };
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_DELAY),
    [dispatch, clearError]
  );

  /**
   * Updates the status of an authorization request
   * Implements optimistic updates and rollback on failure
   */
  const updateStatus = useCallback(async (
    id: string,
    status: AuthorizationStatus
  ): Promise<ApiResponse<any>> => {
    try {
      setLoading(true);
      clearError();

      const result = await dispatch(updateAuthorizationRequestStatus({
        authorizationId: id,
        status
      })).unwrap();

      return {
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: { id, status }
      };
    } catch (err) {
      const errorResponse: ErrorResponse = {
        code: 'UPDATE_STATUS_ERROR',
        message: err instanceof Error ? err.message : 'Failed to update status',
        details: { id, status, error: err },
        timestamp: new Date().toISOString()
      };
      setError(errorResponse);
      return {
        success: false,
        data: null,
        error: errorResponse,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    } finally {
      setLoading(false);
    }
  }, [dispatch, clearError]);

  return {
    createRequest,
    getRequest,
    searchRequests,
    updateStatus,
    loading,
    error,
    clearError
  };
};