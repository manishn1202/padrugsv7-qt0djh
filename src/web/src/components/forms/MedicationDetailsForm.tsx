import React, { useCallback, useMemo } from 'react';
import { Grid, TextField } from '@mui/material';
import { Form } from '../common/Form';
import { Dropdown } from '../common/Dropdown';
import { MedicationInfo } from '../../types/request.types';
import { validateRequired } from '../../utils/validation.utils';
import { VALIDATION_PATTERNS, ERROR_MESSAGES } from '../../constants/validation.constants';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.2.0

interface MedicationDetailsFormProps {
  initialValues: MedicationInfo;
  onSubmit: (values: MedicationInfo) => Promise<void>;
  onChange?: (values: MedicationInfo) => void;
  insuranceLimits?: {
    maxQuantity?: number;
    maxDaysSupply?: number;
    allowedDosageForms?: string[];
  };
  disabled?: boolean;
}

// Dosage form options based on standard medical forms
const DOSAGE_FORMS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'solution', label: 'Solution' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'injection', label: 'Injection' },
  { value: 'cream', label: 'Cream' },
  { value: 'ointment', label: 'Ointment' },
  { value: 'patch', label: 'Patch' },
  { value: 'inhaler', label: 'Inhaler' }
];

/**
 * Validates medication details against insurance limits and medical standards
 */
const validateMedicationDetails = (
  values: MedicationInfo,
  insuranceLimits?: MedicationDetailsFormProps['insuranceLimits']
) => {
  const errors: Record<string, string> = {};

  // Required field validation
  const requiredFields: (keyof MedicationInfo)[] = [
    'drug_name',
    'strength',
    'dosage_form',
    'quantity',
    'days_supply',
    'directions',
    'ndc_code'
  ];

  requiredFields.forEach(field => {
    const validation = validateRequired(values[field]);
    if (!validation.isValid) {
      errors[field] = ERROR_MESSAGES.REQUIRED;
    }
  });

  // NDC code validation
  if (values.ndc_code && !VALIDATION_PATTERNS.NDC.test(values.ndc_code)) {
    errors.ndc_code = ERROR_MESSAGES.INVALID_NDC;
  }

  // Quantity validation
  if (values.quantity) {
    if (values.quantity <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    }
    if (insuranceLimits?.maxQuantity && values.quantity > insuranceLimits.maxQuantity) {
      errors.quantity = `Quantity cannot exceed ${insuranceLimits.maxQuantity}`;
    }
  }

  // Days supply validation
  if (values.days_supply) {
    if (values.days_supply <= 0) {
      errors.days_supply = 'Days supply must be greater than 0';
    }
    if (values.days_supply > 365) {
      errors.days_supply = 'Days supply cannot exceed 365 days';
    }
    if (insuranceLimits?.maxDaysSupply && values.days_supply > insuranceLimits.maxDaysSupply) {
      errors.days_supply = `Days supply cannot exceed ${insuranceLimits.maxDaysSupply}`;
    }
  }

  // Dosage form validation
  if (
    values.dosage_form &&
    insuranceLimits?.allowedDosageForms &&
    !insuranceLimits.allowedDosageForms.includes(values.dosage_form)
  ) {
    errors.dosage_form = 'Selected dosage form is not covered by insurance';
  }

  // Strength format validation
  if (values.strength && !/^\d+(\.\d+)?\s*(mg|mcg|g|ml|%|unit)$/i.test(values.strength)) {
    errors.strength = 'Invalid strength format (e.g., 50 mg, 100 mcg)';
  }

  return errors;
};

/**
 * MedicationDetailsForm component for capturing detailed medication information
 * with comprehensive validation and insurance limit checks
 */
export const MedicationDetailsForm: React.FC<MedicationDetailsFormProps> = ({
  initialValues,
  onSubmit,
  onChange,
  insuranceLimits,
  disabled = false
}) => {
  // Memoize validation schema
  const validationSchema = useMemo(() => ({
    validateForm: (values: MedicationInfo) => validateMedicationDetails(values, insuranceLimits)
  }), [insuranceLimits]);

  // Handle form changes
  const handleChange = useCallback((values: MedicationInfo) => {
    onChange?.(values);
  }, [onChange]);

  return (
    <Form
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={onSubmit}
      onChange={handleChange}
      submitButtonText="Save Medication Details"
      disabled={disabled}
    >
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Dropdown
            name="drug_name"
            label="Medication Name"
            placeholder="Select medication"
            options={[]} // Would be populated from medication database
            required
            disabled={disabled}
            virtualScroll
            aria-label="Select medication name"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            name="ndc_code"
            label="NDC Code"
            placeholder="xxxxx-xxxx-xx"
            required
            disabled={disabled}
            inputProps={{
              'aria-label': 'Enter NDC code',
              pattern: VALIDATION_PATTERNS.NDC.source
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            name="strength"
            label="Strength"
            placeholder="e.g., 50 mg"
            required
            disabled={disabled}
            inputProps={{
              'aria-label': 'Enter medication strength'
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Dropdown
            name="dosage_form"
            label="Dosage Form"
            options={DOSAGE_FORMS}
            required
            disabled={disabled}
            aria-label="Select dosage form"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            name="quantity"
            label="Quantity"
            type="number"
            required
            disabled={disabled}
            inputProps={{
              min: 1,
              max: insuranceLimits?.maxQuantity || 999,
              'aria-label': 'Enter quantity'
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            name="days_supply"
            label="Days Supply"
            type="number"
            required
            disabled={disabled}
            inputProps={{
              min: 1,
              max: insuranceLimits?.maxDaysSupply || 365,
              'aria-label': 'Enter days supply'
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            name="directions"
            label="Directions for Use"
            multiline
            rows={3}
            required
            disabled={disabled}
            inputProps={{
              'aria-label': 'Enter medication directions'
            }}
          />
        </Grid>
      </Grid>
    </Form>
  );
};

export default MedicationDetailsForm;