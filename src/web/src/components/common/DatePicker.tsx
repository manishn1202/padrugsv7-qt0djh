import React, { useState, useCallback, useMemo } from 'react';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers'; // v6.0.0
import { useTranslation } from 'react-i18next'; // v13.0.0
import { TextField } from './TextField';
import { formatDate, isValidDate, parseDate } from '../../utils/date.utils';
import { useAnalytics } from '../../hooks/useAnalytics';

/**
 * Interface for healthcare-specific date validation rules
 */
interface DateValidationRules {
  minDate?: Date;
  maxDate?: Date;
  disallowWeekends?: boolean;
  disallowHolidays?: boolean;
  allowedDaysOfWeek?: number[];
  facilityHours?: {
    start: string;
    end: string;
  };
}

/**
 * Props interface for the DatePicker component
 */
export interface DatePickerProps {
  /** Input field name for form integration */
  name: string;
  /** Selected date value */
  value: Date | null;
  /** Change handler for date selection */
  onChange: (date: Date | null) => void;
  /** Label for the date picker */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Timezone for date handling */
  timezone?: string;
  /** Healthcare-specific validation rules */
  validationRules?: DateValidationRules;
  /** Label for analytics tracking */
  analyticsLabel?: string;
  /** Custom placeholder text */
  placeholder?: string;
  /** Whether to show the clear button */
  clearable?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Error boundary class for handling DatePicker errors
 */
class DatePickerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('DatePicker Error:', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <TextField
          name="date-error"
          value=""
          onChange={() => {}}
          error="An error occurred with the date picker. Please try again."
          disabled
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Enhanced DatePicker component with healthcare-specific validation and accessibility features
 */
const DatePickerComponent: React.FC<DatePickerProps> = ({
  name,
  value,
  onChange,
  label,
  error,
  required = false,
  disabled = false,
  timezone = 'America/New_York',
  validationRules,
  analyticsLabel,
  placeholder,
  clearable = true,
  className,
}) => {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const [internalError, setInternalError] = useState<string>('');
  const { trackDateSelection } = useAnalytics();

  /**
   * Validates the selected date against healthcare-specific rules
   */
  const validateDate = useCallback((date: Date | null): string => {
    if (!date) {
      return required ? t('validation.required') : '';
    }

    const validation = isValidDate(date);
    if (!validation.isValid) {
      return validation.error || t('validation.invalidDate');
    }

    if (validationRules) {
      const {
        minDate,
        maxDate,
        disallowWeekends,
        disallowHolidays,
        allowedDaysOfWeek,
        facilityHours,
      } = validationRules;

      if (minDate && date < minDate) {
        return t('validation.dateTooEarly');
      }

      if (maxDate && date > maxDate) {
        return t('validation.dateTooLate');
      }

      if (disallowWeekends && [0, 6].includes(date.getDay())) {
        return t('validation.weekendsNotAllowed');
      }

      if (allowedDaysOfWeek && !allowedDaysOfWeek.includes(date.getDay())) {
        return t('validation.dayNotAllowed');
      }

      // Additional healthcare-specific validations can be added here
    }

    return '';
  }, [required, t, validationRules]);

  /**
   * Handles date change with validation and analytics tracking
   */
  const handleDateChange = useCallback((newDate: Date | null) => {
    const validationError = validateDate(newDate);
    setInternalError(validationError);
    setTouched(true);

    // Track date selection for analytics
    if (analyticsLabel && newDate) {
      trackDateSelection({
        field_name: name,
        selected_date: formatDate(newDate),
        validation_status: validationError ? 'error' : 'success',
      });
    }

    onChange(newDate);
  }, [analyticsLabel, name, onChange, trackDateSelection, validateDate]);

  /**
   * Memoized date picker props for performance
   */
  const datePickerProps = useMemo(() => ({
    value,
    onChange: handleDateChange,
    disabled,
    clearable,
    format: 'MM/dd/yyyy',
    slotProps: {
      textField: {
        name,
        label,
        required,
        error: !!(touched && (error || internalError)),
        helperText: touched && (error || internalError),
        placeholder: placeholder || t('datePicker.placeholder'),
        inputProps: {
          'aria-label': label || t('datePicker.ariaLabel'),
          'data-testid': `date-picker-${name}`,
        },
      },
    },
  }), [
    value,
    handleDateChange,
    disabled,
    clearable,
    name,
    label,
    required,
    touched,
    error,
    internalError,
    placeholder,
    t,
  ]);

  return (
    <div className={className} role="presentation">
      <MuiDatePicker
        {...datePickerProps}
        className="healthcare-date-picker"
        componentsProps={{
          actionBar: {
            actions: ['clear', 'today'],
          },
        }}
      />
    </div>
  );
};

/**
 * Memoized and error-bounded DatePicker component
 */
export const DatePicker = React.memo((props: DatePickerProps) => (
  <DatePickerErrorBoundary>
    <DatePickerComponent {...props} />
  </DatePickerErrorBoundary>
));

DatePicker.displayName = 'DatePicker';

export type { DateValidationRules };