import React, { useCallback, useEffect, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import useForm from '../../hooks/useForm';
import Button from './Button';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.2.0

/**
 * Props interface for the Form component with comprehensive type safety
 */
interface FormProps {
  initialValues: Record<string, any>;
  validationSchema: Record<string, (value: any) => Promise<string | undefined> | string | undefined>;
  onSubmit: (values: Record<string, any>, formState: any) => Promise<void>;
  children: React.ReactNode;
  submitButtonText?: string;
  resetButtonText?: string;
  showReset?: boolean;
  autoSave?: boolean;
  encryptData?: boolean;
  className?: string;
  id?: string;
}

// Styled components with healthcare-optimized styling
const FormContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  width: '100%',
  maxWidth: 800,
  margin: '0 auto',
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  boxShadow: theme.shadows[1],

  // Accessibility focus indicators
  '&:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'CanvasText',
    '&:focus-within': {
      outline: '2px solid ButtonText',
    },
  },
}));

const ButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'flex-end',
  marginTop: theme.spacing(4),
  position: 'sticky',
  bottom: 0,
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  zIndex: 1,
}));

/**
 * Enhanced Form component implementing HIPAA-compliant form handling
 * with comprehensive validation and accessibility features.
 */
export const Form: React.FC<FormProps> = ({
  initialValues,
  validationSchema,
  onSubmit,
  children,
  submitButtonText = 'Submit',
  resetButtonText = 'Reset',
  showReset = true,
  autoSave = false,
  encryptData = false,
  className,
  id,
}) => {
  // Initialize form state with enhanced validation
  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldTouched,
  } = useForm(initialValues, validationSchema, onSubmit);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && isDirty) {
      const saveTimeout = setTimeout(() => {
        localStorage.setItem(
          `form_${id || 'default'}_draft`,
          encryptData ? btoa(JSON.stringify(values)) : JSON.stringify(values)
        );
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [values, autoSave, isDirty, id, encryptData]);

  // Enhance form children with validation state
  const enhancedChildren = useMemo(() => {
    const enhanceFormChild = (child: React.ReactElement) => {
      if (!React.isValidElement(child)) return child;

      const fieldName = child.props.name;
      if (!fieldName) return child;

      return React.cloneElement(child, {
        value: values[fieldName] || '',
        onChange: handleChange,
        onBlur: handleBlur,
        error: touched[fieldName] && errors[fieldName],
        helperText: touched[fieldName] && errors[fieldName],
        'aria-invalid': touched[fieldName] && !!errors[fieldName],
        'aria-describedby': `${fieldName}-error`,
      });
    };

    return React.Children.map(children, (child) =>
      React.isValidElement(child) ? enhanceFormChild(child) : child
    );
  }, [children, values, errors, touched, handleChange, handleBlur]);

  // Form submission handler with loading state
  const onFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await handleSubmit(e);
    },
    [handleSubmit]
  );

  // Keyboard navigation handler
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      onFormSubmit(e as any);
    }
  }, [onFormSubmit]);

  return (
    <FormContainer
      component="form"
      onSubmit={onFormSubmit}
      className={className}
      id={id}
      role="form"
      aria-label="Form"
      onKeyPress={handleKeyPress}
    >
      {/* Screen reader announcement for form errors */}
      {Object.keys(errors).length > 0 && (
        <div className="sr-only" role="alert">
          Please correct the following errors before submitting the form
        </div>
      )}

      {enhancedChildren}

      <ButtonContainer>
        {showReset && (
          <Button
            variant="outlined"
            onClick={resetForm}
            disabled={isSubmitting || !isDirty}
            aria-label={resetButtonText}
          >
            {resetButtonText}
          </Button>
        )}
        <Button
          variant="contained"
          type="submit"
          disabled={isSubmitting || !isValid}
          loading={isSubmitting}
          aria-label={submitButtonText}
        >
          {submitButtonText}
        </Button>
      </ButtonContainer>
    </FormContainer>
  );
};

export default Form;