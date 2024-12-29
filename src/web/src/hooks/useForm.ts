import { useState, useCallback, ChangeEvent, FocusEvent, FormEvent } from 'react'; // v18.2.0
import { validateRequired, validateEmail, validatePhone } from '../utils/validation.utils';
import { LoadingState } from '../types/common.types';
import debounce from 'lodash/debounce'; // v4.17.21

// Constants for form handling
const DEFAULT_ERROR_MESSAGE = 'Please check your entry and try again. Ensure all medical information is accurate.';
const DEBOUNCE_DELAY = 300;
const VALIDATION_MODES = {
  BLUR: 'blur',
  CHANGE: 'change',
  SUBMIT: 'submit'
} as const;

// Types for form handling
type FormValues = Record<string, any>;
type FormErrors = Record<string, string>;
type FormTouched = Record<string, boolean>;
type ValidationFunction = (value: any) => Promise<string | undefined> | string | undefined;
type ValidationSchema = Record<string, ValidationFunction>;

interface FormState {
  values: FormValues;
  errors: FormErrors;
  touched: FormTouched;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  submitCount: number;
  submitError: string | null;
  loadingState: LoadingState;
}

interface UseFormOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  revalidateOnChange?: boolean;
  shouldUnregister?: boolean;
}

/**
 * Advanced custom hook for managing healthcare form state with HIPAA-compliant validation
 * @param initialValues - Initial form values
 * @param validationSchema - Object containing field validation functions
 * @param onSubmit - Form submission handler
 * @param options - Form configuration options
 */
const useForm = (
  initialValues: FormValues,
  validationSchema: ValidationSchema,
  onSubmit: (values: FormValues) => Promise<void>,
  options: UseFormOptions = {}
) => {
  // Initialize form state
  const [formState, setFormState] = useState<FormState>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
    isDirty: false,
    submitCount: 0,
    submitError: null,
    loadingState: 'idle' as LoadingState
  });

  /**
   * Validates a single field with healthcare-specific rules
   * @param field - Field name to validate
   * @param value - Field value to validate
   */
  const validateField = useCallback(async (
    field: string,
    value: any
  ): Promise<string | undefined> => {
    try {
      if (!validationSchema[field]) return undefined;

      // Required field validation
      const requiredValidation = validateRequired(value);
      if (!requiredValidation.isValid) {
        return requiredValidation.errors[0];
      }

      // Field-specific validation
      const validation = await validationSchema[field](value);
      
      // Special handling for healthcare-specific fields
      if (field.toLowerCase().includes('email')) {
        const emailValidation = validateEmail(value);
        if (!emailValidation.isValid) return emailValidation.errors[0];
      }
      
      if (field.toLowerCase().includes('phone')) {
        const phoneValidation = validatePhone(value);
        if (!phoneValidation.isValid) return phoneValidation.errors[0];
      }

      return validation;
    } catch (error) {
      console.error(`Validation error for field ${field}:`, error);
      return DEFAULT_ERROR_MESSAGE;
    }
  }, [validationSchema]);

  /**
   * Validates entire form
   * @returns boolean indicating form validity
   */
  const validateForm = useCallback(async (): Promise<boolean> => {
    try {
      const validationPromises = Object.keys(formState.values).map(async (field) => {
        const error = await validateField(field, formState.values[field]);
        return { field, error };
      });

      const validationResults = await Promise.all(validationPromises);
      const newErrors: FormErrors = {};
      
      validationResults.forEach(({ field, error }) => {
        if (error) newErrors[field] = error;
      });

      setFormState(prev => ({
        ...prev,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0
      }));

      return Object.keys(newErrors).length === 0;
    } catch (error) {
      console.error('Form validation error:', error);
      return false;
    }
  }, [formState.values, validateField]);

  /**
   * Debounced change handler for improved performance
   */
  const debouncedValidation = useCallback(
    debounce(async (field: string, value: any) => {
      const error = await validateField(field, value);
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [field]: error || ''
        }
      }));
    }, DEBOUNCE_DELAY),
    [validateField]
  );

  /**
   * Handles form field changes with validation
   */
  const handleChange = useCallback((
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      isDirty: true
    }));

    if (options.validateOnChange) {
      debouncedValidation(name, value);
    }
  }, [options.validateOnChange, debouncedValidation]);

  /**
   * Handles field blur events with validation
   */
  const handleBlur = useCallback(async (
    e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): Promise<void> => {
    const { name, value } = e.target;

    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [name]: true }
    }));

    if (options.validateOnBlur) {
      const error = await validateField(name, value);
      setFormState(prev => ({
        ...prev,
        errors: { ...prev.errors, [name]: error || '' }
      }));
    }
  }, [options.validateOnBlur, validateField]);

  /**
   * Handles form submission with validation
   */
  const handleSubmit = useCallback(async (
    e: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    setFormState(prev => ({
      ...prev,
      isSubmitting: true,
      loadingState: 'loading',
      submitCount: prev.submitCount + 1
    }));

    try {
      const isValid = await validateForm();
      
      if (!isValid) {
        setFormState(prev => ({
          ...prev,
          isSubmitting: false,
          loadingState: 'failed',
          submitError: 'Please correct the errors before submitting.'
        }));
        return;
      }

      await onSubmit(formState.values);
      
      setFormState(prev => ({
        ...prev,
        isSubmitting: false,
        loadingState: 'succeeded',
        submitError: null
      }));
    } catch (error) {
      console.error('Form submission error:', error);
      setFormState(prev => ({
        ...prev,
        isSubmitting: false,
        loadingState: 'failed',
        submitError: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
      }));
    }
  }, [formState.values, validateForm, onSubmit]);

  /**
   * Resets form to initial state
   */
  const resetForm = useCallback((): void => {
    setFormState({
      values: initialValues,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValid: true,
      isDirty: false,
      submitCount: 0,
      submitError: null,
      loadingState: 'idle'
    });
  }, [initialValues]);

  /**
   * Sets a field value programmatically
   */
  const setFieldValue = useCallback((field: string, value: any): void => {
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      isDirty: true
    }));

    if (options.validateOnChange) {
      debouncedValidation(field, value);
    }
  }, [options.validateOnChange, debouncedValidation]);

  /**
   * Sets a field's touched state programmatically
   */
  const setFieldTouched = useCallback((field: string, touched: boolean = true): void => {
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [field]: touched }
    }));
  }, []);

  return {
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isSubmitting: formState.isSubmitting,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    submitCount: formState.submitCount,
    submitError: formState.submitError,
    loadingState: formState.loadingState,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateForm
  };
};

export default useForm;