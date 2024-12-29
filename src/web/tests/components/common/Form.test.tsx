import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import Form from '../../../src/components/common/Form';
import Button from '../../../src/components/common/Button';
import { VALIDATION_PATTERNS, ERROR_MESSAGES } from '../../../src/constants/validation.constants';

// Version comments for external dependencies
// @testing-library/react: ^13.4.0
// @testing-library/user-event: ^14.0.0
// jest-axe: ^4.7.0

expect.extend(toHaveNoViolations);

// Test data constants
const TEST_DATA = {
  initialValues: {
    patientName: '',
    patientId: '',
    diagnosisCode: '',
    npiNumber: '',
    medicationDetails: '',
  },
  validValues: {
    patientName: 'John Doe',
    patientId: 'P123456',
    diagnosisCode: 'A69.20',
    npiNumber: '1234567890',
    medicationDetails: 'Aspirin 81mg daily',
  },
  invalidValues: {
    patientName: '',
    patientId: 'invalid',
    diagnosisCode: 'invalid-code',
    npiNumber: 'invalid-npi',
    medicationDetails: '',
  },
};

// Mock functions
const mockOnSubmit = jest.fn();
const mockOnValidate = jest.fn();

// Helper function to render form with test props
const renderForm = (customProps = {}) => {
  const defaultProps = {
    initialValues: TEST_DATA.initialValues,
    validationSchema: {
      patientName: (value: string) => value ? undefined : ERROR_MESSAGES.REQUIRED,
      patientId: (value: string) => /^P\d{6}$/.test(value) ? undefined : 'Invalid patient ID',
      diagnosisCode: (value: string) => 
        VALIDATION_PATTERNS.ICD10.test(value) ? undefined : ERROR_MESSAGES.INVALID_ICD10,
      npiNumber: (value: string) => 
        VALIDATION_PATTERNS.NPI.test(value) ? undefined : ERROR_MESSAGES.INVALID_NPI,
      medicationDetails: (value: string) => value ? undefined : ERROR_MESSAGES.REQUIRED,
    },
    onSubmit: mockOnSubmit,
    children: (
      <>
        <input name="patientName" aria-label="Patient Name" />
        <input name="patientId" aria-label="Patient ID" />
        <input name="diagnosisCode" aria-label="Diagnosis Code" />
        <input name="npiNumber" aria-label="NPI Number" />
        <input name="medicationDetails" aria-label="Medication Details" />
      </>
    ),
  };

  const props = { ...defaultProps, ...customProps };
  return render(<Form {...props} />);
};

describe('Form Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Initialization', () => {
    it('should render form with all fields', () => {
      renderForm();
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText('Patient Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Patient ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Diagnosis Code')).toBeInTheDocument();
      expect(screen.getByLabelText('NPI Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Medication Details')).toBeInTheDocument();
    });

    it('should initialize with correct default values', () => {
      renderForm();
      Object.keys(TEST_DATA.initialValues).forEach(fieldName => {
        expect(screen.getByLabelText(fieldName.replace(/([A-Z])/g, ' $1').trim())).toHaveValue('');
      });
    });

    it('should have no accessibility violations', async () => {
      const { container } = renderForm();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Healthcare Data Validation', () => {
    it('should validate ICD-10 codes correctly', async () => {
      renderForm();
      const diagnosisInput = screen.getByLabelText('Diagnosis Code');

      await userEvent.type(diagnosisInput, 'invalid');
      fireEvent.blur(diagnosisInput);
      await waitFor(() => {
        expect(screen.getByText(ERROR_MESSAGES.INVALID_ICD10)).toBeInTheDocument();
      });

      await userEvent.clear(diagnosisInput);
      await userEvent.type(diagnosisInput, 'A69.20');
      fireEvent.blur(diagnosisInput);
      await waitFor(() => {
        expect(screen.queryByText(ERROR_MESSAGES.INVALID_ICD10)).not.toBeInTheDocument();
      });
    });

    it('should validate NPI numbers correctly', async () => {
      renderForm();
      const npiInput = screen.getByLabelText('NPI Number');

      await userEvent.type(npiInput, 'invalid');
      fireEvent.blur(npiInput);
      await waitFor(() => {
        expect(screen.getByText(ERROR_MESSAGES.INVALID_NPI)).toBeInTheDocument();
      });

      await userEvent.clear(npiInput);
      await userEvent.type(npiInput, '1234567890');
      fireEvent.blur(npiInput);
      await waitFor(() => {
        expect(screen.queryByText(ERROR_MESSAGES.INVALID_NPI)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    it('should handle form submission with valid data', async () => {
      renderForm();
      
      // Fill form with valid data
      for (const [field, value] of Object.entries(TEST_DATA.validValues)) {
        const input = screen.getByLabelText(field.replace(/([A-Z])/g, ' $1').trim());
        await userEvent.type(input, value);
      }

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(TEST_DATA.validValues, expect.any(Object));
      });
    });

    it('should prevent submission with invalid data', async () => {
      renderForm();
      
      // Fill form with invalid data
      for (const [field, value] of Object.entries(TEST_DATA.invalidValues)) {
        const input = screen.getByLabelText(field.replace(/([A-Z])/g, ' $1').trim());
        await userEvent.type(input, value);
      }

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/please correct the following errors/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('should support keyboard navigation', async () => {
      renderForm();
      const firstInput = screen.getByLabelText('Patient Name');
      const submitButton = screen.getByRole('button', { name: /submit/i });

      firstInput.focus();
      expect(document.activeElement).toBe(firstInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(screen.getByLabelText('Patient ID'));

      // Tab through all fields
      for (let i = 0; i < 3; i++) {
        await userEvent.tab();
      }

      expect(document.activeElement).toBe(submitButton);
    });

    it('should announce form errors to screen readers', async () => {
      renderForm();
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      await userEvent.click(submitButton);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/please correct the following errors/i);
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });
  });
});