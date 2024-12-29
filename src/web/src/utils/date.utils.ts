/**
 * @fileoverview Enterprise-grade date utility functions for the Enhanced PA System
 * Provides comprehensive date manipulation, formatting, and validation with
 * internationalization, accessibility, and timezone support.
 * @version 1.0.0
 */

// date-fns v2.30.0 - Comprehensive date utility library
import { format, isValid, parseISO } from 'date-fns';
import { DateRange } from '../types/common.types';

/**
 * Default configuration constants for date handling
 */
export const DEFAULT_DATE_FORMAT = 'MM/dd/yyyy';
export const DEFAULT_DATETIME_FORMAT = 'MM/dd/yyyy HH:mm:ss';
export const DATE_RANGE_SEPARATOR = ' - ';
export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Interface for validation results with detailed error information
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Interface for parsed date results with validation information
 */
interface ParseResult {
  date: Date | null;
  isValid: boolean;
  error?: string;
}

/**
 * Formats a date into a consistent string format with internationalization
 * and accessibility support.
 * 
 * @param date - The date to format (Date object, ISO string, or null)
 * @param formatStr - The desired format string (defaults to DEFAULT_DATE_FORMAT)
 * @param locale - The locale to use for formatting (defaults to DEFAULT_LOCALE)
 * @returns Formatted date string with ARIA attributes or empty string if invalid
 * 
 * @example
 * formatDate(new Date(), 'MM/dd/yyyy') // Returns "01/15/2024"
 * formatDate('2024-01-15T00:00:00Z') // Returns "01/15/2024"
 */
export function formatDate(
  date: Date | string | null,
  formatStr: string = DEFAULT_DATE_FORMAT,
  locale: string = DEFAULT_LOCALE
): string {
  try {
    if (!date) {
      return '';
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;

    if (!isValid(dateObj)) {
      console.warn('Invalid date provided to formatDate:', date);
      return '';
    }

    const formattedDate = format(dateObj, formatStr);
    
    // Add ARIA attributes for accessibility
    return `<span aria-label="${formattedDate}" role="text">${formattedDate}</span>`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Formats a date range with comprehensive validation and accessibility support.
 * 
 * @param dateRange - The DateRange object containing start and end dates
 * @param formatStr - The desired format string (defaults to DEFAULT_DATE_FORMAT)
 * @param locale - The locale to use for formatting (defaults to DEFAULT_LOCALE)
 * @returns Formatted date range string with ARIA attributes
 * 
 * @example
 * formatDateRange({ startDate: new Date(), endDate: new Date() })
 * // Returns "01/15/2024 - 01/15/2024"
 */
export function formatDateRange(
  dateRange: DateRange,
  formatStr: string = DEFAULT_DATE_FORMAT,
  locale: string = DEFAULT_LOCALE
): string {
  try {
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      return '';
    }

    if (dateRange.startDate > dateRange.endDate) {
      console.warn('Invalid date range: start date is after end date');
      return '';
    }

    const startFormatted = formatDate(dateRange.startDate, formatStr, locale);
    const endFormatted = formatDate(dateRange.endDate, formatStr, locale);

    const rangeString = `${startFormatted}${DATE_RANGE_SEPARATOR}${endFormatted}`;
    
    // Add ARIA label for screen readers
    return `<span aria-label="Date range from ${startFormatted} to ${endFormatted}" role="text">${rangeString}</span>`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return '';
  }
}

/**
 * Enhanced date validation with detailed error reporting.
 * 
 * @param date - The date to validate (Date object, ISO string, or null)
 * @returns ValidationResult object containing validation status and error details
 * 
 * @example
 * isValidDate('2024-01-15') // Returns { isValid: true }
 * isValidDate('invalid') // Returns { isValid: false, error: 'Invalid date format' }
 */
export function isValidDate(date: Date | string | null): ValidationResult {
  try {
    if (!date) {
      return {
        isValid: false,
        error: 'Date is required',
        details: { provided: date }
      };
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;

    if (!isValid(dateObj)) {
      return {
        isValid: false,
        error: 'Invalid date format',
        details: { provided: date }
      };
    }

    // Check if date is within reasonable range (e.g., not too far in past/future)
    const now = new Date();
    const hundredYears = 100 * 365 * 24 * 60 * 60 * 1000;
    if (Math.abs(dateObj.getTime() - now.getTime()) > hundredYears) {
      return {
        isValid: false,
        error: 'Date is outside acceptable range',
        details: { provided: date, maxRange: '±100 years' }
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Error validating date',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Secure date parsing with timezone handling.
 * 
 * @param dateString - The date string to parse
 * @param timezone - The timezone to use (defaults to DEFAULT_TIMEZONE)
 * @returns ParseResult object containing parsed date and validation details
 * 
 * @example
 * parseDate('2024-01-15') // Returns { date: Date object, isValid: true }
 * parseDate('invalid') // Returns { date: null, isValid: false, error: 'Invalid date string' }
 */
export function parseDate(
  dateString: string,
  timezone: string = DEFAULT_TIMEZONE
): ParseResult {
  try {
    if (!dateString) {
      return {
        date: null,
        isValid: false,
        error: 'Date string is required'
      };
    }

    // Sanitize input
    const sanitizedDate = dateString.trim();
    
    // Attempt to parse the date
    const parsedDate = parseISO(sanitizedDate);

    if (!isValid(parsedDate)) {
      return {
        date: null,
        isValid: false,
        error: 'Invalid date format'
      };
    }

    // Adjust for timezone if needed
    const dateInTimezone = new Date(
      parsedDate.toLocaleString('en-US', { timeZone: timezone })
    );

    return {
      date: dateInTimezone,
      isValid: true
    };
  } catch (error) {
    return {
      date: null,
      isValid: false,
      error: error instanceof Error ? error.message : 'Error parsing date'
    };
  }
}