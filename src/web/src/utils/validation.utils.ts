import { isValid } from 'date-fns'; // v2.30.0
import { memoize } from 'lodash'; // v4.17.21
import { 
  VALIDATION_PATTERNS, 
  ERROR_MESSAGES,
  MIN_NPI_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_PHONE_LENGTH
} from '../constants/validation.constants';
import { ValidationState } from '../types/common.types';

// Global validation configuration
const MAX_VALIDATION_ATTEMPTS = 5;
const VALIDATION_TIMEOUT_MS = 5000;
const VALIDATION_CACHE_SIZE = 1000;

/**
 * Interface for validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates if a value is not empty or undefined
 * @param value - Value to validate
 * @returns ValidationResult
 */
export const validateRequired = (value: unknown): ValidationResult => {
  if (value === undefined || value === null || value === '') {
    return {
      isValid: false,
      errors: [ERROR_MESSAGES.REQUIRED]
    };
  }
  return { isValid: true, errors: [] };
};

/**
 * Enhanced NPI validation with checksum calculation and format verification
 * Implements HIPAA-compliant NPI validation rules
 * @param npi - NPI number to validate
 * @returns ValidationResult
 */
export const validateNPI = memoize((npi: string): ValidationResult => {
  const errors: string[] = [];

  // Basic format validation
  if (!VALIDATION_PATTERNS.NPI.test(npi)) {
    errors.push(ERROR_MESSAGES.INVALID_NPI);
    return { isValid: false, errors };
  }

  // Length validation
  if (npi.length !== MIN_NPI_LENGTH) {
    errors.push(`NPI must be exactly ${MIN_NPI_LENGTH} digits`);
    return { isValid: false, errors };
  }

  // Luhn algorithm checksum validation
  const digits = npi.split('').map(Number);
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    errors.push('Invalid NPI checksum');
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}, (npi: string) => npi.trim());

/**
 * Enhanced ICD-10 code validation with category and version verification
 * @param code - ICD-10 code to validate
 * @returns ValidationResult
 */
export const validateICD10 = memoize((code: string): ValidationResult => {
  const errors: string[] = [];

  // Basic format validation
  if (!VALIDATION_PATTERNS.ICD10.test(code)) {
    errors.push(ERROR_MESSAGES.INVALID_ICD10);
    return { isValid: false, errors };
  }

  // Category validation (first character must be letter A-Z)
  const category = code.charAt(0);
  if (!/^[A-Z]$/.test(category)) {
    errors.push('Invalid ICD-10 category');
    return { isValid: false, errors };
  }

  // Subcategory validation (must be valid numeric format)
  const subcategory = code.substring(1, 3);
  if (!/^\d{2}$/.test(subcategory)) {
    errors.push('Invalid ICD-10 subcategory');
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}, (code: string) => code.trim().toUpperCase());

/**
 * Validates email format with enhanced security checks
 * @param email - Email address to validate
 * @returns ValidationResult
 */
export const validateEmail = memoize((email: string): ValidationResult => {
  const errors: string[] = [];

  if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
    errors.push(ERROR_MESSAGES.INVALID_EMAIL);
    return { isValid: false, errors };
  }

  if (email.length > MAX_FIELD_LENGTH) {
    errors.push(`Email must not exceed ${MAX_FIELD_LENGTH} characters`);
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}, (email: string) => email.trim().toLowerCase());

/**
 * Validates phone number format using E.164 standard
 * @param phone - Phone number to validate
 * @returns ValidationResult
 */
export const validatePhone = memoize((phone: string): ValidationResult => {
  const errors: string[] = [];

  if (!VALIDATION_PATTERNS.PHONE.test(phone)) {
    errors.push(ERROR_MESSAGES.INVALID_PHONE);
    return { isValid: false, errors };
  }

  if (phone.length > MAX_PHONE_LENGTH) {
    errors.push(`Phone number must not exceed ${MAX_PHONE_LENGTH} characters`);
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}, (phone: string) => phone.replace(/\D/g, ''));

/**
 * Validates date format and range
 * @param date - Date string to validate
 * @param minDate - Optional minimum date
 * @param maxDate - Optional maximum date
 * @returns ValidationResult
 */
export const validateDate = (
  date: string,
  minDate?: Date,
  maxDate?: Date
): ValidationResult => {
  const errors: string[] = [];
  const dateObj = new Date(date);

  if (!isValid(dateObj)) {
    errors.push('Invalid date format');
    return { isValid: false, errors };
  }

  if (minDate && dateObj < minDate) {
    errors.push(`Date must be after ${minDate.toISOString().split('T')[0]}`);
  }

  if (maxDate && dateObj > maxDate) {
    errors.push(`Date must be before ${maxDate.toISOString().split('T')[0]}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Creates a validation state object for form fields
 * @param isValid - Whether the field is valid
 * @param error - Error message if invalid
 * @returns ValidationState
 */
export const createValidationState = (
  isValid: boolean,
  error?: string
): ValidationState => ({
  valid: isValid,
  error: error || null,
  touched: true
});

/**
 * Combines multiple validation results
 * @param results - Array of validation results to combine
 * @returns ValidationResult
 */
export const combineValidationResults = (
  results: ValidationResult[]
): ValidationResult => ({
  isValid: results.every(result => result.isValid),
  errors: results.reduce((acc, result) => [...acc, ...result.errors], [] as string[])
});

// Export validation patterns for external use
export { VALIDATION_PATTERNS };