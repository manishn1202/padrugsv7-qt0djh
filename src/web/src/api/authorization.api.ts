// axios version ^1.6.0
// axios-retry version ^3.8.0
// axios-rate-limit version ^1.3.0

import { AxiosResponse } from 'axios';
import retry from 'axios-retry';
import rateLimit from 'axios-rate-limit';
import { apiClient } from '../utils/api.utils';
import { API_ENDPOINTS } from '../constants/api.constants';
import { AuthorizationStatus, ClinicalInfo, InsuranceInfo, MedicationInfo, PatientInfo } from '../types/request.types';
import { RequestValidator } from '../utils/validation.utils';
import { ApiResponse, PaginationParams } from '../types/common.types';

// Configure retry strategy
retry(apiClient, {
  retries: 3,
  retryDelay: retry.exponentialDelay,
  retryCondition: (error) => {
    return retry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

// Configure rate limiting
const rateLimitedClient = rateLimit(apiClient, { 
  maxRequests: 100,
  perMilliseconds: 60000 // 1 minute
});

/**
 * Interface for authorization request creation
 */
export interface CreateAuthorizationRequest {
  patientInfo: PatientInfo;
  insuranceInfo: InsuranceInfo;
  medicationInfo: MedicationInfo;
  clinicalInfo: ClinicalInfo;
}

/**
 * Interface for authorization search filters
 */
export interface AuthorizationSearchFilters {
  status?: AuthorizationStatus[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  patientId?: string;
  providerId?: string;
}

/**
 * Creates a new prior authorization request
 * @param request Authorization request details
 * @returns Promise with created authorization
 */
export const createAuthorization = async (
  request: CreateAuthorizationRequest
): Promise<ApiResponse<AxiosResponse>> => {
  try {
    // Validate request data
    const validator = new RequestValidator();
    const validationResult = await validator.validate(request);
    
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    const response = await rateLimitedClient.post(
      API_ENDPOINTS.AUTHORIZATION.CREATE,
      request,
      {
        headers: {
          'x-idempotency-key': `${Date.now()}-${Math.random()}`,
        }
      }
    );

    return {
      success: true,
      data: response,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'CREATE_AUTHORIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create authorization',
        details: { error },
        timestamp: new Date().toISOString()
      }
    };
  }
};

/**
 * Retrieves a specific authorization request by ID
 * @param authorizationId Authorization request ID
 * @returns Promise with authorization details
 */
export const getAuthorization = async (
  authorizationId: string
): Promise<ApiResponse<AxiosResponse>> => {
  try {
    const endpoint = API_ENDPOINTS.AUTHORIZATION.GET.replace(':id', authorizationId);
    const response = await rateLimitedClient.get(endpoint);

    return {
      success: true,
      data: response,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'GET_AUTHORIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to retrieve authorization',
        details: { authorizationId, error },
        timestamp: new Date().toISOString()
      }
    };
  }
};

/**
 * Updates the status of an authorization request
 * @param authorizationId Authorization request ID
 * @param status New authorization status
 * @param notes Optional status update notes
 * @returns Promise with updated authorization
 */
export const updateAuthorizationStatus = async (
  authorizationId: string,
  status: AuthorizationStatus,
  notes?: string
): Promise<ApiResponse<AxiosResponse>> => {
  try {
    const endpoint = API_ENDPOINTS.AUTHORIZATION.UPDATE_STATUS.replace(':id', authorizationId);
    const response = await rateLimitedClient.put(
      endpoint,
      { status, notes },
      {
        headers: {
          'x-idempotency-key': `${Date.now()}-${Math.random()}`,
        }
      }
    );

    return {
      success: true,
      data: response,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'UPDATE_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update authorization status',
        details: { authorizationId, status, error },
        timestamp: new Date().toISOString()
      }
    };
  }
};

/**
 * Searches authorization requests with filters and pagination
 * @param filters Search filters
 * @param pagination Pagination options
 * @returns Promise with paginated authorization results
 */
export const searchAuthorizations = async (
  filters: AuthorizationSearchFilters,
  pagination: PaginationParams
): Promise<ApiResponse<AxiosResponse>> => {
  try {
    const response = await rateLimitedClient.get(API_ENDPOINTS.AUTHORIZATION.SEARCH, {
      params: {
        ...filters,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder
      }
    });

    return {
      success: true,
      data: response,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {
        filters,
        pagination
      }
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'SEARCH_AUTHORIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to search authorizations',
        details: { filters, pagination, error },
        timestamp: new Date().toISOString()
      }
    };
  }
};

/**
 * Uploads clinical documents for an authorization request
 * @param authorizationId Authorization request ID
 * @param documents Array of document files
 * @returns Promise with upload response
 */
export const uploadAuthorizationDocuments = async (
  authorizationId: string,
  documents: File[]
): Promise<ApiResponse<AxiosResponse>> => {
  try {
    const formData = new FormData();
    documents.forEach(doc => formData.append('documents', doc));

    const endpoint = API_ENDPOINTS.AUTHORIZATION.DOCUMENTS.replace(':id', authorizationId);
    const response = await rateLimitedClient.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'x-idempotency-key': `${Date.now()}-${Math.random()}`,
      },
      timeout: 120000 // 2 minutes for file uploads
    });

    return {
      success: true,
      data: response,
      error: null,
      timestamp: new Date().toISOString(),
      metadata: {
        documentCount: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + doc.size, 0)
      }
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'UPLOAD_DOCUMENTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to upload documents',
        details: { authorizationId, documentCount: documents.length, error },
        timestamp: new Date().toISOString()
      }
    };
  }
};