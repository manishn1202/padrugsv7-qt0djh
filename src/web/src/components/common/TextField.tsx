import React, { useState, useCallback } from 'react';
import { TextField as MuiTextField } from '@mui/material'; // v5.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import InputMask from 'react-input-mask'; // v2.0.4

import { validateRequired } from '../../utils/validation.utils';
import { theme } from '../../assets/styles/theme';
import { ERROR_MESSAGES } from '../../constants/validation.constants';

// Healthcare-optimized styled TextField with enhanced accessibility
const StyledTextField = styled(MuiTextField)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  width: props => props.fullWidth ? '100%' : 'auto',
  '& .MuiInputLabel-root': {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: '4px',
    transition: 'all 0.2s ease-in-out',
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
      borderWidth: '2px',
    },
    '&.Mui-error fieldset': {
      borderColor: theme.palette.error.main,
    },
  },
  '& .MuiFormHelperText-root': {
    fontSize: theme.typography.caption.fontSize,
    marginTop: '4px',
  },
}));

export interface TextFieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  mask?: string;
  sensitiveData?: boolean;
  validationPattern?: RegExp;
  organizationTheme?: Record<string, unknown>;
}

/**
 * Healthcare-optimized TextField component with HIPAA compliance and accessibility features
 * 
 * @component
 * @example
 * ```tsx
 * <TextField
 *   name="patientId"
 *   label="Patient ID"
 *   value={patientId}
 *   onChange={handlePatientIdChange}
 *   required
 *   sensitiveData
 *   mask="999-99-9999"
 * />
 * ```
 */
const TextField: React.FC<TextFieldProps> = ({
  name,
  label,
  value,
  onChange,
  required = false,
  error,
  disabled = false,
  placeholder,
  type = 'text',
  fullWidth = true,
  size = 'medium',
  mask,
  sensitiveData = false,
  validationPattern,
  organizationTheme,
  ...props
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [touched, setTouched] = useState(false);

  // Enhanced validation handling with support for custom patterns
  const validateField = useCallback((value: string): string => {
    if (required) {
      const requiredValidation = validateRequired(value);
      if (!requiredValidation.isValid) {
        return ERROR_MESSAGES.REQUIRED;
      }
    }

    if (validationPattern && value) {
      if (!validationPattern.test(value)) {
        return ERROR_MESSAGES.INVALID_FORMAT;
      }
    }

    return '';
  }, [required, validationPattern]);

  // Enhanced change handler with input sanitization
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    
    // Sanitize input for sensitive data
    let sanitizedValue = sensitiveData ? 
      newValue.replace(/[^a-zA-Z0-9-]/g, '') : 
      newValue;

    // Apply validation
    const validationError = validateField(sanitizedValue);
    setInternalError(validationError);
    
    // Notify parent component
    onChange(sanitizedValue);
  }, [onChange, validateField, sensitiveData]);

  // Enhanced blur handler with validation
  const handleBlur = useCallback(() => {
    setTouched(true);
    const validationError = validateField(value);
    setInternalError(validationError);
  }, [value, validateField]);

  // Determine final error message
  const displayError = touched ? (error || internalError) : '';

  // Render input with or without mask
  const renderInput = () => {
    const inputProps = {
      'aria-label': label,
      'aria-required': required,
      'aria-invalid': !!displayError,
      'data-testid': `textfield-${name}`,
      ...(sensitiveData && { 'autoComplete': 'off' }),
    };

    if (mask) {
      return (
        <InputMask
          mask={mask}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
        >
          {(inputProps: any) => (
            <StyledTextField
              {...props}
              {...inputProps}
              name={name}
              label={label}
              error={!!displayError}
              helperText={displayError}
              placeholder={placeholder}
              type={type}
              fullWidth={fullWidth}
              size={size}
              disabled={disabled}
              required={required}
              InputProps={{
                ...inputProps,
                'aria-describedby': displayError ? `${name}-error` : undefined,
              }}
            />
          )}
        </InputMask>
      );
    }

    return (
      <StyledTextField
        {...props}
        name={name}
        label={label}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        error={!!displayError}
        helperText={displayError}
        placeholder={placeholder}
        type={type}
        fullWidth={fullWidth}
        size={size}
        disabled={disabled}
        required={required}
        InputProps={{
          ...inputProps,
          'aria-describedby': displayError ? `${name}-error` : undefined,
        }}
      />
    );
  };

  return renderInput();
};

export default TextField;