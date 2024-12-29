/**
 * @fileoverview Form-related constants and configurations for the Enhanced PA System
 * Implements healthcare-specific form requirements, accessibility standards, and 
 * HIPAA-compliant configurations.
 * @version 1.0.0
 */

/**
 * Comprehensive form field types including healthcare-specific inputs
 */
export enum FORM_FIELD_TYPES {
  TEXT = 'text',
  SELECT = 'select',
  DATE = 'date',
  FILE = 'file',
  TEXTAREA = 'textarea',
  CLINICAL_CODE = 'clinical-code', // For ICD-10, CPT, etc.
  MEDICATION_SEARCH = 'medication-search' // Enhanced medication search field
}

/**
 * Enhanced form submission states including healthcare workflow states
 */
export enum FORM_STATES {
  INITIAL = 'initial',
  VALIDATING = 'validating',
  SUBMITTING = 'submitting',
  SUBMITTED = 'submitted',
  ERROR = 'error',
  PENDING_DOCUMENTS = 'pending-documents' // Healthcare-specific state
}

/**
 * Form layout configurations supporting healthcare UX patterns
 */
export const FORM_LAYOUTS = {
  SINGLE_COLUMN: 'single-column',
  TWO_COLUMNS: 'two-columns',
  THREE_COLUMNS: 'three-columns',
  F_PATTERN: 'f-pattern', // Healthcare-optimized F-pattern layout
  PROGRESSIVE: 'progressive' // Progressive disclosure pattern
} as const;

/**
 * Healthcare-specific form section identifiers
 */
export const FORM_SECTIONS = {
  PATIENT_INFO: 'patient-info',
  INSURANCE_INFO: 'insurance-info',
  CLINICAL_INFO: 'clinical-info',
  MEDICATION_INFO: 'medication-info',
  DOCUMENTS: 'documents',
  REVIEW: 'review'
} as const;

/**
 * Global form configuration defaults
 */
export const DEFAULT_FORM_STATE = FORM_STATES.INITIAL;
export const DEFAULT_FORM_LAYOUT = FORM_LAYOUTS.F_PATTERN;
export const FORM_GRID_GAP = '24px';
export const FORM_SECTION_GAP = '32px';
export const FORM_VALIDATION_DEBOUNCE = 300; // milliseconds
export const FORM_AUTOSAVE_INTERVAL = 30000; // milliseconds

/**
 * Validation rule interface for form field validation
 */
interface ValidationRule {
  type: string;
  message: string;
  value?: any;
}

/**
 * Enhanced configuration interface for form fields with accessibility 
 * and healthcare requirements
 */
export interface FormFieldConfig {
  type: FORM_FIELD_TYPES;
  label: string;
  placeholder?: string;
  helperText?: string;
  width?: string | number;
  ariaLabel: string; // Required for accessibility
  ariaDescribedBy?: string;
  validationRules?: ValidationRule[];
  maskPattern?: string; // For formatted inputs like SSN, phone
  autoComplete?: string; // WCAG 2.1 compliance
  dataTestId: string; // Required for testing
}

/**
 * Enhanced configuration interface for form sections with 
 * healthcare-specific features
 */
export interface FormSectionConfig {
  id: keyof typeof FORM_SECTIONS;
  title: string;
  layout?: keyof typeof FORM_LAYOUTS;
  fields: FormFieldConfig[];
  progressiveDisclosure?: boolean;
  dependsOn?: Array<keyof typeof FORM_SECTIONS>;
  validationGroup?: string;
  auditTrail?: boolean; // HIPAA compliance requirement
}

/**
 * ARIA label constants for accessibility compliance
 */
export const ARIA_LABELS = {
  REQUIRED_FIELD: 'This field is required',
  OPTIONAL_FIELD: 'This field is optional',
  ERROR_MESSAGE: 'Error message',
  HELP_TEXT: 'Help text',
  LOADING_STATE: 'Form is processing',
  FILE_UPLOAD: 'Upload medical documents',
  SECTION_NAVIGATION: 'Form section navigation'
} as const;

/**
 * Healthcare-specific validation patterns
 */
export const VALIDATION_PATTERNS = {
  NPI: /^\d{10}$/, // National Provider Identifier
  DEA: /^[A-Z]\d{8}$/, // DEA Number
  ICD10: /^[A-Z]\d{2}(\.\d{1,2})?$/, // ICD-10 Code
  PHONE: /^\d{10}$/, // Phone number
  SSN: /^\d{3}-\d{2}-\d{4}$/, // Social Security Number
  ZIP: /^\d{5}(-\d{4})?$/ // ZIP Code
} as const;

/**
 * Form field width presets for consistent layouts
 */
export const FIELD_WIDTHS = {
  FULL: '100%',
  HALF: '48%',
  THIRD: '31%',
  QUARTER: '23%',
  FIXED_SMALL: '120px',
  FIXED_MEDIUM: '200px',
  FIXED_LARGE: '300px'
} as const;

/**
 * Form autosave configuration
 */
export const AUTOSAVE_CONFIG = {
  ENABLED: true,
  INTERVAL: FORM_AUTOSAVE_INTERVAL,
  STORAGE_KEY: 'pa_form_autosave',
  MAX_ENTRIES: 5
} as const;

/**
 * Form analytics event types
 */
export const FORM_EVENTS = {
  SECTION_VIEW: 'section_view',
  FIELD_INTERACTION: 'field_interaction',
  VALIDATION_ERROR: 'validation_error',
  FORM_SUBMIT: 'form_submit',
  DOCUMENT_UPLOAD: 'document_upload',
  AUTOSAVE: 'autosave'
} as const;