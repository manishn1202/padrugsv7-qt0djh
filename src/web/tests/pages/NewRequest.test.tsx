import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import NewRequest from '../../src/pages/NewRequest';
import { RequestService } from '../../src/services/request.service';
import { AuthorizationStatus } from '../../src/types/request.types';
import { ValidationState } from '../../src/types/common.types';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('../../src/services/request.service');
vi.mock('../../src/hooks/useNotification', () => ({
  useNotification: () => ({
    showNotification: vi.fn()
  })
}));
vi.mock('@segment/analytics-next', () => ({
  Analytics: vi.fn().mockImplementation(() => ({
    track: vi.fn()
  }))
}));

// Test data constants
const VALID_PATIENT_INFO = {
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
  gender: 'M',
  phone: '+12345678901',
  email: 'john.doe@example.com'
};

const VALID_INSURANCE_INFO = {
  planName: 'Test Insurance',
  memberId: '12345678',
  groupNumber: 'GRP123',
  pbmName: 'Test PBM'
};

const VALID_MEDICATION_INFO = {
  drugName: 'Test Drug',
  strength: '50mg',
  dosageForm: 'tablet',
  quantity: 30,
  daysSupply: 30,
  directions: 'Take one tablet daily'
};

const VALID_CLINICAL_INFO = {
  diagnosis: ['A01.1'],
  clinicalNotes: 'Test clinical notes',
  attachments: []
};

describe('NewRequest Page', () => {
  let mockRequestService: jest.Mocked<RequestService>;

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    mockRequestService = {
      createRequest: vi.fn(),
      validateRequest: vi.fn()
    } as any;

    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering and Navigation', () => {
    it('should render all form steps correctly', () => {
      renderWithProviders(<NewRequest />);
      
      expect(screen.getByText('New Prior Authorization Request')).toBeInTheDocument();
      expect(screen.getByText('Patient Information')).toBeInTheDocument();
      expect(screen.getByText('Insurance Details')).toBeInTheDocument();
      expect(screen.getByText('Medication Details')).toBeInTheDocument();
      expect(screen.getByText('Clinical Information')).toBeInTheDocument();
      expect(screen.getByText('Review & Submit')).toBeInTheDocument();
    });

    it('should navigate between steps when clicking next/back buttons', async () => {
      renderWithProviders(<NewRequest />);
      
      // Fill out patient info
      const nextButton = screen.getByText('Next');
      await fillPatientInfoForm(VALID_PATIENT_INFO);
      
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(screen.getByText('Insurance Details')).toBeInTheDocument();
      });

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);
      await waitFor(() => {
        expect(screen.getByText('Patient Information')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields in patient information step', async () => {
      renderWithProviders(<NewRequest />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('First name is required')).toBeInTheDocument();
        expect(screen.getByText('Last name is required')).toBeInTheDocument();
        expect(screen.getByText('Date of birth is required')).toBeInTheDocument();
      });
    });

    it('should validate email format in patient information', async () => {
      renderWithProviders(<NewRequest />);
      
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
      });
    });

    it('should validate phone number format', async () => {
      renderWithProviders(<NewRequest />);
      
      const phoneInput = screen.getByLabelText(/phone/i);
      fireEvent.change(phoneInput, { target: { value: 'invalid-phone' } });
      fireEvent.blur(phoneInput);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid phone number/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form successfully with valid data', async () => {
      mockRequestService.createRequest.mockResolvedValueOnce({
        id: '123',
        status: AuthorizationStatus.SUBMITTED
      });

      renderWithProviders(<NewRequest />);
      
      // Fill all form steps
      await completeAllFormSteps();
      
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRequestService.createRequest).toHaveBeenCalledTimes(1);
        expect(mockRequestService.createRequest).toHaveBeenCalledWith({
          patientInfo: VALID_PATIENT_INFO,
          insuranceInfo: VALID_INSURANCE_INFO,
          medicationInfo: VALID_MEDICATION_INFO,
          clinicalInfo: VALID_CLINICAL_INFO
        });
      });
    });

    it('should handle submission errors gracefully', async () => {
      mockRequestService.createRequest.mockRejectedValueOnce(new Error('Submission failed'));
      
      renderWithProviders(<NewRequest />);
      await completeAllFormSteps();
      
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to submit prior authorization request/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(<NewRequest />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain focus management during navigation', async () => {
      renderWithProviders(<NewRequest />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('aria-label', /first form field/i);
      });
    });
  });
});

// Helper functions
async function fillPatientInfoForm(data: typeof VALID_PATIENT_INFO) {
  const { firstName, lastName, dateOfBirth, gender, phone, email } = data;
  
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: firstName } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: lastName } });
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: dateOfBirth } });
  fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: gender } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: phone } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
}

async function completeAllFormSteps() {
  // Fill patient info
  await fillPatientInfoForm(VALID_PATIENT_INFO);
  fireEvent.click(screen.getByText('Next'));

  // Fill insurance info
  await waitFor(() => {
    const { planName, memberId, groupNumber, pbmName } = VALID_INSURANCE_INFO;
    fireEvent.change(screen.getByLabelText(/plan name/i), { target: { value: planName } });
    fireEvent.change(screen.getByLabelText(/member id/i), { target: { value: memberId } });
    fireEvent.change(screen.getByLabelText(/group number/i), { target: { value: groupNumber } });
    fireEvent.change(screen.getByLabelText(/pbm name/i), { target: { value: pbmName } });
  });
  fireEvent.click(screen.getByText('Next'));

  // Fill medication info
  await waitFor(() => {
    const { drugName, strength, dosageForm, quantity, daysSupply, directions } = VALID_MEDICATION_INFO;
    fireEvent.change(screen.getByLabelText(/drug name/i), { target: { value: drugName } });
    fireEvent.change(screen.getByLabelText(/strength/i), { target: { value: strength } });
    fireEvent.change(screen.getByLabelText(/dosage form/i), { target: { value: dosageForm } });
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: quantity } });
    fireEvent.change(screen.getByLabelText(/days supply/i), { target: { value: daysSupply } });
    fireEvent.change(screen.getByLabelText(/directions/i), { target: { value: directions } });
  });
  fireEvent.click(screen.getByText('Next'));

  // Fill clinical info
  await waitFor(() => {
    const { diagnosis, clinicalNotes } = VALID_CLINICAL_INFO;
    fireEvent.change(screen.getByLabelText(/diagnosis/i), { target: { value: diagnosis[0] } });
    fireEvent.change(screen.getByLabelText(/clinical notes/i), { target: { value: clinicalNotes } });
  });
  fireEvent.click(screen.getByText('Next'));
}