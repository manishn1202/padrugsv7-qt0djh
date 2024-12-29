import React, { useCallback, useEffect, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { Grid } from '@mui/material';
import { debounce } from 'lodash'; // v4.17.21

import Form from '../common/Form';
import TextField from '../common/TextField';
import { InsuranceInfo } from '../../types/request.types';
import { VALIDATION_PATTERNS, ERROR_MESSAGES } from '../../constants/validation.constants';

// Props interface with comprehensive type definitions
interface InsuranceDetailsFormProps {
  initialValues: InsuranceInfo;
  onSubmit: (values: InsuranceInfo) => void | Promise<void>;
  onChange?: (values: InsuranceInfo) => void;
  disabled?: boolean;
  onError?: (errors: Record<string, string>) => void;
  ariaLabels?: Record<string, string>;
}

// Styled components for enhanced layout and accessibility
const FormContainer = styled(Grid)(({ theme }) => ({
  container: true,
  spacing: theme.spacing(3),
  marginTop: theme.spacing(2),
  position: 'relative',
  '& .MuiTextField-root': {
    marginBottom: theme.spacing(2),
  },
  '& .form-section': {
    marginBottom: theme.spacing(3),
  },
}));

/**
 * Validates insurance details with enhanced security and format checking
 * @param values Insurance form values
 * @returns Validation error messages
 */
const validateInsuranceDetails = (values: InsuranceInfo): Record<string, string> => {
  const errors: Record<string, string> = {};

  // Payer ID validation
  if (!values.payer_id) {
    errors.payer_id = ERROR_MESSAGES.REQUIRED;
  } else if (!VALIDATION_PATTERNS.INSURANCE_ID.test(values.payer_id)) {
    errors.payer_id = ERROR_MESSAGES.INVALID_INSURANCE_ID;
  }

  // Plan ID validation
  if (!values.plan_id) {
    errors.plan_id = ERROR_MESSAGES.REQUIRED;
  } else if (!VALIDATION_PATTERNS.INSURANCE_ID.test(values.plan_id)) {
    errors.plan_id = ERROR_MESSAGES.INVALID_INSURANCE_ID;
  }

  // Member ID validation
  if (!values.member_id) {
    errors.member_id = ERROR_MESSAGES.REQUIRED;
  } else if (!VALIDATION_PATTERNS.INSURANCE_ID.test(values.member_id)) {
    errors.member_id = ERROR_MESSAGES.INVALID_INSURANCE_ID;
  }

  // Group number validation (optional)
  if (values.group_number && !VALIDATION_PATTERNS.INSURANCE_ID.test(values.group_number)) {
    errors.group_number = ERROR_MESSAGES.INVALID_INSURANCE_ID;
  }

  // Coverage type validation
  if (!values.coverage_type) {
    errors.coverage_type = ERROR_MESSAGES.REQUIRED;
  }

  return errors;
};

/**
 * Enhanced insurance details form component with HIPAA compliance
 * and comprehensive validation
 */
export const InsuranceDetailsForm: React.FC<InsuranceDetailsFormProps> = ({
  initialValues,
  onSubmit,
  onChange,
  disabled = false,
  onError,
  ariaLabels = {},
}) => {
  // Memoized validation schema
  const validationSchema = useMemo(() => ({
    payer_id: (value: string) => validateInsuranceDetails({ ...initialValues, payer_id: value }).payer_id,
    plan_id: (value: string) => validateInsuranceDetails({ ...initialValues, plan_id: value }).plan_id,
    member_id: (value: string) => validateInsuranceDetails({ ...initialValues, member_id: value }).member_id,
    group_number: (value: string) => validateInsuranceDetails({ ...initialValues, group_number: value }).group_number,
    coverage_type: (value: string) => validateInsuranceDetails({ ...initialValues, coverage_type: value }).coverage_type,
  }), [initialValues]);

  // Debounced change handler
  const handleChange = useCallback(
    debounce((values: InsuranceInfo) => {
      const errors = validateInsuranceDetails(values);
      if (onError) {
        onError(errors);
      }
      if (onChange) {
        onChange(values);
      }
    }, 300),
    [onError, onChange]
  );

  // Effect to validate initial values
  useEffect(() => {
    const errors = validateInsuranceDetails(initialValues);
    if (onError) {
      onError(errors);
    }
  }, [initialValues, onError]);

  return (
    <Form
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={onSubmit}
      disabled={disabled}
    >
      <FormContainer role="form" aria-label={ariaLabels.form || 'Insurance Details Form'}>
        <Grid item xs={12} md={6}>
          <TextField
            name="payer_id"
            label="Payer ID"
            required
            sensitiveData
            disabled={disabled}
            aria-label={ariaLabels.payerId || 'Payer ID'}
            validationPattern={VALIDATION_PATTERNS.INSURANCE_ID}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            name="plan_id"
            label="Plan ID"
            required
            sensitiveData
            disabled={disabled}
            aria-label={ariaLabels.planId || 'Plan ID'}
            validationPattern={VALIDATION_PATTERNS.INSURANCE_ID}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            name="member_id"
            label="Member ID"
            required
            sensitiveData
            disabled={disabled}
            aria-label={ariaLabels.memberId || 'Member ID'}
            validationPattern={VALIDATION_PATTERNS.INSURANCE_ID}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            name="group_number"
            label="Group Number"
            sensitiveData
            disabled={disabled}
            aria-label={ariaLabels.groupNumber || 'Group Number'}
            validationPattern={VALIDATION_PATTERNS.INSURANCE_ID}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            name="coverage_type"
            label="Coverage Type"
            required
            disabled={disabled}
            aria-label={ariaLabels.coverageType || 'Coverage Type'}
          />
        </Grid>
      </FormContainer>
    </Form>
  );
};

export default InsuranceDetailsForm;