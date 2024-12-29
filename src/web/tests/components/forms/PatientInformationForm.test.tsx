import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, jest } from '@jest/globals';
import { axe, toHaveNoViolations } from '@axe-core/react';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../src/assets/styles/theme';
import PatientInformationForm from '../../../src/components/forms/PatientInformationForm';

// Version comments for external dependencies
// @testing-library/react: ^13.4.0
// @testing-library/user-event: ^14.0.0
// @jest/globals: ^29.0.0
// @axe-core/react: ^4.7.0
// @mui/material: ^5.0.0

expect.extend(toHaveNoViolations);

// Test data setup
const validPatientData = {
  name: 'Jane Smith',
  dateOfBirth: '1985-06-15',
  patientId: 'P789012',
  gender: 'F',
  phone: '987-654-3210',
  email: 'jane.smith@example.com',
};

const invalidPatientData = {
  name: '',
  dateOfBirth: 'invalid',
  patientId: 'invalid',
  gender: '',
  phone: 'invalid',
  email: 'invalid-email',
};

// Helper function to render component with theme
const renderWithTheme = (props = {}) => {
  const defaultProps = {
    initialValues: validPatientData,
    onSubmit: jest.fn(),
  };

  return render(
    <ThemeProvider theme={theme}>
      <PatientInformationForm {...defaultProps} {...props} />
    </ThemeProvider>
  );
};

describe('PatientInformationForm Component', () => {
  describe('Rendering and Accessibility', () => {
    test('renders all required form fields with proper accessibility attributes', async () => {
      const { container } = renderWithTheme();

      // Check for required fields
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Patient ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Gender/i)).toBeInTheDocument();

      // Check optional fields
      expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();

      // Run accessibility tests
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('applies proper ARIA attributes and roles', () => {
      renderWithTheme();

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label');

      // Check required field indicators
      const requiredFields = ['name', 'dateOfBirth', 'patientId', 'gender'];
      requiredFields.forEach(fieldName => {
        const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
        expect(field).toHaveAttribute('aria-required', 'true');
      });
    });

    test('supports keyboard navigation', async () => {
      renderWithTheme();
      const user = userEvent.setup();

      // Test tab navigation
      await user.tab();
      expect(screen.getByLabelText(/Full Name/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/Date of Birth/i)).toHaveFocus();

      // Continue testing tab order for all fields
    });
  });

  describe('Form Validation', () => {
    test('validates required fields', async () => {
      const onSubmit = jest.fn();
      renderWithTheme({ initialValues: invalidPatientData, onSubmit });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/This field is required/i)).toBeInTheDocument();
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('validates HIPAA-compliant data formats', async () => {
      const onSubmit = jest.fn();
      renderWithTheme({ initialValues: validPatientData, onSubmit });
      const user = userEvent.setup();

      // Test patient ID format
      const patientIdField = screen.getByLabelText(/Patient ID/i);
      await user.clear(patientIdField);
      await user.type(patientIdField, 'invalid-id');

      await waitFor(() => {
        expect(screen.getByText(/Patient ID must be 6-10 characters/i)).toBeInTheDocument();
      });
    });

    test('handles sensitive data appropriately', async () => {
      renderWithTheme();

      // Check for autocomplete off on sensitive fields
      const sensitiveFields = ['name', 'patientId', 'phone', 'email'];
      sensitiveFields.forEach(fieldName => {
        const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
        expect(field).toHaveAttribute('autocomplete', 'off');
      });
    });
  });

  describe('Form Submission', () => {
    test('submits valid form data successfully', async () => {
      const onSubmit = jest.fn();
      renderWithTheme({ initialValues: validPatientData, onSubmit });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(validPatientData);
      });
    });

    test('handles submission errors appropriately', async () => {
      const onSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));
      renderWithTheme({ initialValues: validPatientData, onSubmit });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to submit patient information/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Display', () => {
    test('displays field-specific error messages', async () => {
      renderWithTheme();
      const user = userEvent.setup();

      // Test email validation
      const emailField = screen.getByLabelText(/Email Address/i);
      await user.type(emailField, 'invalid-email');
      fireEvent.blur(emailField);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    test('clears errors on valid input', async () => {
      renderWithTheme();
      const user = userEvent.setup();

      const emailField = screen.getByLabelText(/Email Address/i);
      await user.type(emailField, 'invalid-email');
      fireEvent.blur(emailField);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      });

      await user.clear(emailField);
      await user.type(emailField, 'valid@example.com');
      fireEvent.blur(emailField);

      await waitFor(() => {
        expect(screen.queryByText(/Please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme and Styling', () => {
    test('applies organization theme correctly', () => {
      renderWithTheme();

      const form = screen.getByRole('form');
      expect(form).toHaveStyle(`font-family: ${theme.typography.fontFamily}`);
    });

    test('maintains WCAG contrast requirements', async () => {
      const { container } = renderWithTheme();

      // Run specific contrast checks
      const results = await axe(container, {
        rules: ['color-contrast']
      });
      expect(results).toHaveNoViolations();
    });
  });
});