import React, { useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import Form from '../common/Form';
import TextField from '../common/TextField';
import { validateRequired, validateEmail, validatePhone } from '../../utils/validation.utils';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.2.0

/**
 * Props interface for PatientInformationForm component
 */
interface PatientInformationFormProps {
  initialValues: PatientInformation;
  onSubmit: (values: PatientInformation) => void | Promise<void>;
  className?: string;
}

/**
 * Interface for patient information data structure
 */
interface PatientInformation {
  name: string;
  dateOfBirth: string;
  patientId: string;
  gender: string;
  phone: string;
  email: string;
}

// Styled components for form layout
const FormContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  width: '100%',
  padding: theme.spacing(2),
  position: 'relative',

  // Accessibility focus indicators
  '&:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'CanvasText',
  },

  // Responsive adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
}));

const FormRow = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: theme.spacing(2),
  alignItems: 'start',
  position: 'relative',

  // Responsive layout
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
  },
}));

/**
 * Enhanced validation schema for patient information
 */
const validationSchema = {
  name: async (value: string) => {
    const required = validateRequired(value);
    if (!required.isValid) return required.errors[0];
    if (!/^[a-zA-Z\s-']{2,}$/.test(value)) {
      return 'Please enter a valid name';
    }
  },
  dateOfBirth: async (value: string) => {
    const required = validateRequired(value);
    if (!required.isValid) return required.errors[0];
    
    const date = new Date(value);
    const today = new Date();
    if (date > today) {
      return 'Date of birth cannot be in the future';
    }
    if (date.getFullYear() < 1900) {
      return 'Please enter a valid date of birth';
    }
  },
  patientId: async (value: string) => {
    const required = validateRequired(value);
    if (!required.isValid) return required.errors[0];
    if (!/^[A-Z0-9]{6,10}$/.test(value)) {
      return 'Patient ID must be 6-10 characters of letters and numbers';
    }
  },
  gender: async (value: string) => {
    const required = validateRequired(value);
    if (!required.isValid) return required.errors[0];
  },
  phone: async (value: string) => {
    if (!value) return undefined; // Optional field
    const phoneValidation = validatePhone(value);
    if (!phoneValidation.isValid) return phoneValidation.errors[0];
  },
  email: async (value: string) => {
    if (!value) return undefined; // Optional field
    const emailValidation = validateEmail(value);
    if (!emailValidation.isValid) return emailValidation.errors[0];
  },
};

/**
 * PatientInformationForm component for capturing and validating patient demographic information
 * Implements HIPAA compliance and accessibility standards
 */
export const PatientInformationForm: React.FC<PatientInformationFormProps> = ({
  initialValues,
  onSubmit,
  className,
}) => {
  // Form submission handler with validation
  const handleSubmit = useCallback(async (values: PatientInformation) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission error:', error);
      throw new Error('Failed to submit patient information');
    }
  }, [onSubmit]);

  return (
    <Form
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      className={className}
    >
      <FormContainer>
        <FormRow>
          <TextField
            name="name"
            label="Full Name"
            required
            fullWidth
            sensitiveData
            placeholder="Enter patient's full legal name"
            validationPattern={/^[a-zA-Z\s-']{2,}$/}
          />
          <TextField
            name="dateOfBirth"
            label="Date of Birth"
            type="date"
            required
            fullWidth
            sensitiveData
            InputLabelProps={{ shrink: true }}
          />
        </FormRow>

        <FormRow>
          <TextField
            name="patientId"
            label="Patient ID"
            required
            fullWidth
            sensitiveData
            placeholder="Enter patient ID"
            validationPattern={/^[A-Z0-9]{6,10}$/}
          />
          <TextField
            name="gender"
            label="Gender"
            required
            fullWidth
            type="text"
            placeholder="Specify gender identity"
          />
        </FormRow>

        <FormRow>
          <TextField
            name="phone"
            label="Phone Number"
            fullWidth
            mask="+1 (999) 999-9999"
            placeholder="Enter phone number"
            sensitiveData
          />
          <TextField
            name="email"
            label="Email Address"
            type="email"
            fullWidth
            placeholder="Enter email address"
            sensitiveData
          />
        </FormRow>
      </FormContainer>
    </Form>
  );
};

export default PatientInformationForm;