import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Stepper, 
  Step, 
  StepLabel, 
  Paper, 
  Typography,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { Analytics } from '@segment/analytics-next'; // v1.51.3
import { useFormPersist } from 'react-form-persist'; // v1.0.0
import { useForm, FormProvider } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import ErrorBoundary from '../components/common/ErrorBoundary';
import { useNotification } from '../hooks/useNotification';
import { LoadingState, ValidationState } from '../types/common.types';

// Form step components (imported from separate files)
import PatientInfoStep from '../components/forms/PatientInfoStep';
import InsuranceDetailsStep from '../components/forms/InsuranceDetailsStep';
import MedicationDetailsStep from '../components/forms/MedicationDetailsStep';
import ClinicalInfoStep from '../components/forms/ClinicalInfoStep';
import ReviewStep from '../components/forms/ReviewStep';

// Analytics instance
const analytics = new Analytics({
  writeKey: process.env.REACT_APP_SEGMENT_WRITE_KEY as string
});

// Form steps configuration
const FORM_STEPS = [
  { label: 'Patient Information', component: PatientInfoStep },
  { label: 'Insurance Details', component: InsuranceDetailsStep },
  { label: 'Medication Details', component: MedicationDetailsStep },
  { label: 'Clinical Information', component: ClinicalInfoStep },
  { label: 'Review & Submit', component: ReviewStep }
];

// Form validation schema
const validationSchema = yup.object().shape({
  patientInfo: yup.object({
    firstName: yup.string().required('First name is required'),
    lastName: yup.string().required('Last name is required'),
    dateOfBirth: yup.date().required('Date of birth is required').max(new Date(), 'Invalid date'),
    gender: yup.string().required('Gender is required'),
    phone: yup.string().required('Phone number is required'),
    email: yup.string().email('Invalid email').required('Email is required')
  }),
  insuranceDetails: yup.object({
    planName: yup.string().required('Insurance plan is required'),
    memberId: yup.string().required('Member ID is required'),
    groupNumber: yup.string().required('Group number is required'),
    pbmName: yup.string().required('PBM name is required')
  }),
  medicationDetails: yup.object({
    drugName: yup.string().required('Medication name is required'),
    strength: yup.string().required('Strength is required'),
    dosageForm: yup.string().required('Dosage form is required'),
    quantity: yup.number().required('Quantity is required').positive(),
    daysSupply: yup.number().required('Days supply is required').positive(),
    directions: yup.string().required('Directions are required')
  }),
  clinicalInfo: yup.object({
    diagnosis: yup.array().of(yup.string()).min(1, 'At least one diagnosis is required'),
    previousTreatments: yup.array().of(yup.string()),
    clinicalNotes: yup.string().required('Clinical notes are required'),
    attachments: yup.array().of(yup.mixed())
  })
});

/**
 * Interface for form validation state tracking
 */
interface FormValidationState {
  stepNumber: number;
  isValid: boolean;
  errors: ValidationState[];
  completionPercentage: number;
}

/**
 * NewRequest component for creating prior authorization requests
 * Implements multi-step form with validation, persistence, and analytics
 */
const NewRequest: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [activeStep, setActiveStep] = useState(0);
  const [submissionState, setSubmissionState] = useState<LoadingState>('idle');
  const [validationState, setValidationState] = useState<FormValidationState[]>([]);

  // Form setup with validation and persistence
  const methods = useForm({
    resolver: yupResolver(validationSchema),
    mode: 'onChange'
  });

  // Form persistence configuration
  const { persistForm, clearPersistedForm } = useFormPersist('pa-request-form', {
    storage: 'localStorage',
    timeout: 7200000, // 2 hours
    encrypt: true
  });

  /**
   * Handles real-time validation for the current step
   */
  const handleStepValidation = useCallback(async (stepNumber: number, stepData: any) => {
    try {
      await validationSchema.validateAt(`step${stepNumber}`, stepData);
      const completionPercentage = calculateStepCompletion(stepData);
      
      setValidationState(prev => [
        ...prev.filter(state => state.stepNumber !== stepNumber),
        { stepNumber, isValid: true, errors: [], completionPercentage }
      ]);

      // Track step completion in analytics
      analytics.track('PA Form Step Completed', {
        stepNumber,
        completionPercentage,
        timeSpent: calculateTimeSpent()
      });

      return { isValid: true, errors: [] };
    } catch (error) {
      const validationErrors = error.inner.map((err: any) => ({
        field: err.path,
        message: err.message
      }));

      setValidationState(prev => [
        ...prev.filter(state => state.stepNumber !== stepNumber),
        { stepNumber, isValid: false, errors: validationErrors, completionPercentage: 0 }
      ]);

      return { isValid: false, errors: validationErrors };
    }
  }, []);

  /**
   * Handles form submission with error handling and analytics
   */
  const handleSubmit = async (data: any) => {
    try {
      setSubmissionState('loading');

      // Track form submission attempt
      analytics.track('PA Form Submission', {
        formData: data,
        totalTimeSpent: calculateTimeSpent(),
        completionPercentage: calculateTotalCompletion()
      });

      const response = await submitPriorAuthRequest(data);

      if (response.success) {
        showNotification('success', 'Prior authorization request submitted successfully');
        clearPersistedForm();
        navigate(`/requests/${response.data.requestId}`);
      } else {
        throw new Error(response.error?.message || 'Submission failed');
      }
    } catch (error) {
      setSubmissionState('failed');
      showNotification('error', 'Failed to submit prior authorization request');
      
      // Track submission failure
      analytics.track('PA Form Submission Failed', {
        error: error.message,
        formData: data
      });
    }
  };

  // Navigation handlers
  const handleNext = async () => {
    const stepData = methods.getValues(`step${activeStep}`);
    const validation = await handleStepValidation(activeStep, stepData);
    
    if (validation.isValid) {
      persistForm(methods.getValues());
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Track form abandonment if not completed
      if (submissionState !== 'succeeded') {
        analytics.track('PA Form Abandoned', {
          lastCompletedStep: activeStep,
          timeSpent: calculateTimeSpent()
        });
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <FormProvider {...methods}>
        <Box sx={{ maxWidth: 'lg', mx: 'auto', p: 3 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              New Prior Authorization Request
            </Typography>

            <Stepper activeStep={activeStep} sx={{ my: 4 }}>
              {FORM_STEPS.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Box sx={{ mt: 4 }}>
              {activeStep === FORM_STEPS.length ? (
                <Box sx={{ textAlign: 'center' }}>
                  {submissionState === 'loading' ? (
                    <CircularProgress />
                  ) : (
                    <Typography variant="h6">
                      Processing your request...
                    </Typography>
                  )}
                </Box>
              ) : (
                <>
                  {/* Render current step component */}
                  {React.createElement(FORM_STEPS[activeStep].component)}

                  {/* Navigation buttons */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button
                      onClick={handleBack}
                      disabled={activeStep === 0}
                      variant="outlined"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={activeStep === FORM_STEPS.length - 1 ? methods.handleSubmit(handleSubmit) : handleNext}
                      variant="contained"
                      disabled={submissionState === 'loading'}
                    >
                      {activeStep === FORM_STEPS.length - 1 ? 'Submit' : 'Next'}
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </Paper>
        </Box>
      </FormProvider>
    </ErrorBoundary>
  );
};

export default NewRequest;