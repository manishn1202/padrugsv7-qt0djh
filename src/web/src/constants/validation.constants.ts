import { ValidationRule } from '../types/common.types';

/**
 * Global validation constraints
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_FILE_SIZE = 10485760; // 10MB in bytes
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_FIELD_LENGTH = 255;
export const MIN_NPI_LENGTH = 10;
export const MAX_PHONE_LENGTH = 15;

/**
 * Healthcare-specific and standard validation patterns
 * Implements strict validation for medical identifiers and standard fields
 */
export const VALIDATION_PATTERNS = {
  // Standard field patterns
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^\+?[1-9]\d{1,14}$/, // E.164 format
  ZIP_CODE: /^\d{5}(-\d{4})?$/,
  DATE: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,

  // Healthcare-specific patterns
  NPI: /^\d{10}$/, // National Provider Identifier
  ICD10: /^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?$/, // ICD-10 diagnosis code
  MEDICATION_CODE: /^[A-Z0-9]{4,10}$/, // Generic medication code format
  NDC: /^\d{4,5}-\d{3,4}-\d{1,2}$/, // National Drug Code
  INSURANCE_ID: /^[A-Z0-9]{8,15}$/, // Insurance ID format
  DEA_NUMBER: /^[A-Z]\d{8}$/, // DEA registration number
} as const;

/**
 * Predefined validation rules combining patterns with additional constraints
 * Implements HIPAA-compliant validation rules for healthcare data
 */
export const VALIDATION_RULES: Record<string, ValidationRule> = {
  REQUIRED: {
    required: true,
    pattern: /.+/,
    minLength: 1,
    maxLength: MAX_FIELD_LENGTH,
  },
  EMAIL: {
    required: true,
    pattern: VALIDATION_PATTERNS.EMAIL,
    maxLength: MAX_FIELD_LENGTH,
  },
  PHONE: {
    required: true,
    pattern: VALIDATION_PATTERNS.PHONE,
    maxLength: MAX_PHONE_LENGTH,
  },
  NPI: {
    required: true,
    pattern: VALIDATION_PATTERNS.NPI,
    minLength: MIN_NPI_LENGTH,
    maxLength: MIN_NPI_LENGTH,
  },
  ICD10: {
    required: true,
    pattern: VALIDATION_PATTERNS.ICD10,
    maxLength: 8,
  },
  NDC: {
    required: true,
    pattern: VALIDATION_PATTERNS.NDC,
    maxLength: 13,
  },
  DEA_NUMBER: {
    required: true,
    pattern: VALIDATION_PATTERNS.DEA_NUMBER,
    maxLength: 9,
  },
  INSURANCE_ID: {
    required: true,
    pattern: VALIDATION_PATTERNS.INSURANCE_ID,
    minLength: 8,
    maxLength: 15,
  },
} as const;

/**
 * Screen-reader friendly and internationalization-ready error messages
 * Implements accessibility-friendly validation feedback
 */
export const ERROR_MESSAGES = {
  // General validation messages
  REQUIRED: 'This field is required',
  INVALID_FORMAT: 'The provided format is invalid',
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Must not exceed ${max} characters`,

  // Field-specific validation messages
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number in international format',
  INVALID_NPI: 'Please enter a valid 10-digit NPI number',
  INVALID_ICD10: 'Please enter a valid ICD-10 diagnosis code',
  INVALID_NDC: 'Please enter a valid National Drug Code (NDC)',
  INVALID_DEA: 'Please enter a valid DEA registration number',
  INVALID_INSURANCE_ID: 'Please enter a valid insurance ID',

  // File validation messages
  FILE_SIZE_EXCEEDED: `File size must not exceed ${MAX_FILE_SIZE / 1048576}MB`,
  INVALID_FILE_TYPE: `Allowed file types: ${ALLOWED_FILE_TYPES.join(', ')}`,
} as const;

/**
 * Helper function to create a custom validation rule
 * @param options Partial validation rule options to merge with defaults
 * @returns ValidationRule
 */
export const createValidationRule = (
  options: Partial<ValidationRule>
): ValidationRule => ({
  required: false,
  maxLength: MAX_FIELD_LENGTH,
  ...options,
});

/**
 * Helper function to format validation error message with parameters
 * @param message Error message template
 * @param params Parameters to inject into the message
 * @returns Formatted error message
 */
export const formatErrorMessage = (
  message: string,
  params?: Record<string, string | number>
): string => {
  if (!params) return message;
  return Object.entries(params).reduce(
    (msg, [key, value]) => msg.replace(`{${key}}`, String(value)),
    message
  );
};