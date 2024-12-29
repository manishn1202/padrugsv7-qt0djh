// @mui/material version ^5.0.0
import { Theme } from '@mui/material';

/**
 * Represents all possible states for asynchronous operations and data loading scenarios
 */
export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

/**
 * Generic type for standardized API response structure
 * @template T The type of data contained in the response
 */
export interface ApiResponse<T> {
  /** Indicates if the API call was successful */
  success: boolean;
  /** The response payload */
  data: T;
  /** Error information if the call failed */
  error: ErrorResponse | null;
  /** ISO8601 timestamp of the response */
  timestamp: string;
  /** Additional metadata about the response */
  metadata: Record<string, unknown>;
}

/**
 * Comprehensive pagination parameters for data fetching
 */
export interface PaginationParams {
  /** Current page number (0-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Field to sort by */
  sortBy: string;
  /** Sort direction */
  sortOrder: SortOrder;
  /** Optional filtering criteria */
  filters: Record<string, unknown>;
}

/**
 * Type-safe sort order options
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Theme mode options for the application
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Comprehensive error response structure
 */
export interface ErrorResponse {
  /** Error code for categorization */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error context */
  details: Record<string, unknown>;
  /** Stack trace (only included in development) */
  stack?: string;
  /** ISO8601 timestamp when the error occurred */
  timestamp: string;
}

/**
 * Date range type with validation and utility methods
 */
export interface DateRange {
  /** Start date of the range */
  startDate: Date;
  /** End date of the range */
  endDate: Date;
  /** Validates the date range */
  isValid: () => boolean;
  /** Gets the duration in milliseconds */
  getDuration: () => number;
}

/**
 * Type guard to check if a value is a valid ErrorResponse
 */
export function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value
  );
}

/**
 * Type guard to check if a value is a valid DateRange
 */
export function isDateRange(value: unknown): value is DateRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'startDate' in value &&
    'endDate' in value &&
    'isValid' in value &&
    'getDuration' in value &&
    value.startDate instanceof Date &&
    value.endDate instanceof Date
  );
}

/**
 * Helper type for handling promise states with loading and error information
 */
export interface AsyncState<T> {
  data: T | null;
  loading: LoadingState;
  error: ErrorResponse | null;
}

/**
 * Type for handling form field validation states
 */
export interface ValidationState {
  valid: boolean;
  error: string | null;
  touched: boolean;
}

/**
 * Type for consistent HTTP method handling
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Type for handling API endpoint configurations
 */
export interface ApiEndpointConfig {
  url: string;
  method: HttpMethod;
  requiresAuth: boolean;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Type for handling theme customization options
 */
export interface ThemeCustomization {
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: number;
  customComponents?: Partial<Theme>;
}