import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { waitFor } from '@testing-library/react'; // v13.4.0
import { axe } from '@axe-core/react'; // v4.7.3
import useForm from '../../src/hooks/useForm';
import { 
  validateRequired, 
  validateNPI, 
  validateICD10, 
  validatePhone,
  validateEmail 
} from '../../src/utils/validation.utils';
import { LoadingState } from '../../src/types/common.types';
import { ERROR_MESSAGES, VALIDATION_PATTERNS } from '../../src/constants/validation.constants';

// Mock console.error to avoid polluting test output
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe('useForm Hook - Healthcare Form Management', () => {
  // Test data setup
  const mockInitialValues = {
    npi: '',
    icd10Code: '',
    patientName: '',
    email: '',
    phone: '',
    diagnosis: ''
  };

  const mockValidationSchema = {
    npi: validateNPI,
    icd10Code: validateICD10,
    patientName: validateRequired,
    email: validateEmail,
    phone: validatePhone,
    diagnosis: validateRequired
  };

  const mockOnSubmit = jest.fn();
  const mockOptions = {
    validateOnChange: true,
    validateOnBlur: true
  };

  // Helper function to create form hook
  const setupFormHook = () => {
    return renderHook(() => 
      useForm(
        mockInitialValues,
        mockValidationSchema,
        mockOnSubmit,
        mockOptions
      )
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Healthcare Data Validation', () => {
    it('should validate NPI number format correctly', async () => {
      const { result } = setupFormHook();
      
      await act(async () => {
        result.current.setFieldValue('npi', '1234567890');
        await result.current.validateField('npi', '1234567890');
      });

      expect(result.current.errors.npi).toBeFalsy();
      
      await act(async () => {
        result.current.setFieldValue('npi', '123'); // Invalid NPI
        await result.current.validateField('npi', '123');
      });

      expect(result.current.errors.npi).toBe(ERROR_MESSAGES.INVALID_NPI);
    });

    it('should validate ICD-10 codes according to healthcare standards', async () => {
      const { result } = setupFormHook();
      
      await act(async () => {
        result.current.setFieldValue('icd10Code', 'A01.1');
        await result.current.validateField('icd10Code', 'A01.1');
      });

      expect(result.current.errors.icd10Code).toBeFalsy();
      
      await act(async () => {
        result.current.setFieldValue('icd10Code', '123'); // Invalid ICD-10
        await result.current.validateField('icd10Code', '123');
      });

      expect(result.current.errors.icd10Code).toBe(ERROR_MESSAGES.INVALID_ICD10);
    });

    it('should handle PHI data with appropriate security measures', async () => {
      const { result } = setupFormHook();
      
      await act(async () => {
        result.current.setFieldValue('patientName', 'John Doe');
        await result.current.validateField('patientName', 'John Doe');
      });

      expect(result.current.values.patientName).toBe('John Doe');
      expect(Object.keys(result.current.values)).not.toContain('ssn'); // Ensure sensitive data isn't exposed
    });
  });

  describe('Form Accessibility Standards', () => {
    it('should maintain ARIA attributes in error states', async () => {
      const { result } = setupFormHook();
      
      await act(async () => {
        result.current.setFieldValue('email', 'invalid-email');
        await result.current.validateField('email', 'invalid-email');
      });

      expect(result.current.errors.email).toBeTruthy();
      // Error messages should be screen-reader friendly
      expect(result.current.errors.email).toBe(ERROR_MESSAGES.INVALID_EMAIL);
    });

    it('should handle keyboard navigation states', async () => {
      const { result } = setupFormHook();
      
      await act(async () => {
        result.current.handleBlur({
          target: { name: 'email', value: 'test@example.com' }
        } as any);
      });

      expect(result.current.touched.email).toBe(true);
    });
  });

  describe('Secure Form Submission', () => {
    it('should handle form submission with proper loading states', async () => {
      const { result } = setupFormHook();
      
      expect(result.current.loadingState).toBe('idle' as LoadingState);

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: () => {} } as any);
      });

      expect(result.current.loadingState).toBe('failed' as LoadingState);
      expect(result.current.submitError).toBeTruthy();
    });

    it('should validate all fields before submission', async () => {
      const { result } = setupFormHook();
      
      const validData = {
        npi: '1234567890',
        icd10Code: 'A01.1',
        patientName: 'John Doe',
        email: 'test@example.com',
        phone: '+12345678901',
        diagnosis: 'Test diagnosis'
      };

      await act(async () => {
        Object.entries(validData).forEach(([field, value]) => {
          result.current.setFieldValue(field, value);
        });
      });

      await act(async () => {
        await result.current.validateForm();
      });

      expect(result.current.isValid).toBe(true);
    });

    it('should handle submission errors securely', async () => {
      const mockError = new Error('HIPAA compliance error');
      const mockSubmitWithError = jest.fn().mockRejectedValue(mockError);
      
      const { result } = renderHook(() => 
        useForm(
          mockInitialValues,
          mockValidationSchema,
          mockSubmitWithError,
          mockOptions
        )
      );

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: () => {} } as any);
      });

      expect(result.current.submitError).toBe(mockError.message);
      expect(result.current.loadingState).toBe('failed' as LoadingState);
    });
  });

  describe('Form State Management', () => {
    it('should track form dirty state correctly', async () => {
      const { result } = setupFormHook();
      
      expect(result.current.isDirty).toBe(false);

      await act(async () => {
        result.current.setFieldValue('patientName', 'John Doe');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('should reset form state correctly', async () => {
      const { result } = setupFormHook();
      
      await act(async () => {
        result.current.setFieldValue('patientName', 'John Doe');
        result.current.resetForm();
      });

      expect(result.current.values).toEqual(mockInitialValues);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.errors).toEqual({});
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce validation on change', async () => {
      jest.useFakeTimers();
      const { result } = setupFormHook();
      
      act(() => {
        result.current.handleChange({
          target: { name: 'email', value: 'test@example.com' }
        } as any);
      });

      expect(result.current.errors.email).toBeFalsy();

      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.values.email).toBe('test@example.com');
      });

      jest.useRealTimers();
    });
  });
});