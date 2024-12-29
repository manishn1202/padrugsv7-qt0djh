import React, { useCallback, useMemo, useRef } from 'react';
import { Select, MenuItem, FormControl, SelectProps } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTheme } from '../../hooks/useTheme';
import { theme } from '../../assets/styles/theme';

// Constants for virtualization and accessibility
const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MAX_MENU_HEIGHT = 300;

export interface DropdownOption {
  value: string | number;
  label: string;
  code?: string;         // Medical/diagnosis code
  abbreviation?: string; // Medical abbreviation
  metadata?: any;        // Additional medical context
}

export interface DropdownProps extends Omit<SelectProps, 'onChange'> {
  label: string;
  value: string | number | Array<string | number>;
  options: Array<DropdownOption>;
  onChange: (value: string | number | Array<string | number>) => void;
  multiple?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  loading?: boolean;
  virtualScroll?: boolean;
  renderOption?: (option: DropdownOption) => React.ReactNode;
}

/**
 * Healthcare-optimized dropdown component with enhanced accessibility and performance features.
 * Implements WCAG 2.1 Level AA standards and supports medical terminology.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options,
  onChange,
  multiple = false,
  disabled = false,
  error = false,
  helperText,
  placeholder,
  size = 'medium',
  loading = false,
  virtualScroll = false,
  renderOption,
  ...props
}) => {
  const { mode } = useTheme();
  const parentRef = useRef<HTMLDivElement>(null);

  // Setup virtualization if enabled
  const rowVirtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  // Memoize menu styling
  const menuStyles = useMemo(() => ({
    PaperProps: {
      style: {
        maxHeight: MAX_MENU_HEIGHT,
        boxShadow: theme.shadows[2],
        backgroundColor: mode === 'light' ? theme.palette.background.paper : theme.palette.background.default,
      },
    },
    MenuListProps: {
      style: {
        padding: ITEM_PADDING_TOP,
      },
    },
  }), [mode]);

  // Handle change events with validation
  const handleChange = useCallback((event: any) => {
    const newValue = event.target.value;
    if (multiple && Array.isArray(newValue)) {
      onChange(newValue.filter(v => options.some(opt => opt.value === v)));
    } else {
      onChange(newValue);
    }
  }, [multiple, onChange, options]);

  // Render option with medical context
  const renderOptionContent = useCallback((option: DropdownOption) => {
    if (renderOption) {
      return renderOption(option);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{option.label}</span>
          {option.code && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: mode === 'light' ? theme.palette.text.secondary : theme.palette.text.primary,
              backgroundColor: mode === 'light' ? theme.palette.grey[100] : theme.palette.grey[800],
              padding: '2px 4px',
              borderRadius: '4px'
            }}>
              {option.code}
            </span>
          )}
        </div>
        {option.abbreviation && (
          <span style={{ 
            fontSize: '0.75rem',
            color: theme.palette.text.secondary 
          }}>
            {option.abbreviation}
          </span>
        )}
      </div>
    );
  }, [mode, renderOption]);

  return (
    <FormControl 
      fullWidth 
      error={error}
      disabled={disabled}
      size={size}
    >
      <Select
        value={value}
        onChange={handleChange}
        displayEmpty
        multiple={multiple}
        disabled={disabled || loading}
        renderValue={(selected) => {
          if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            return <em style={{ color: theme.palette.text.secondary }}>{placeholder || 'Select option'}</em>;
          }
          if (multiple && Array.isArray(selected)) {
            return selected
              .map(val => options.find(opt => opt.value === val)?.label)
              .filter(Boolean)
              .join(', ');
          }
          return options.find(opt => opt.value === selected)?.label;
        }}
        {...menuStyles}
        {...props}
        // Enhanced accessibility attributes
        aria-label={label}
        aria-describedby={helperText ? `${label}-helper-text` : undefined}
        role="listbox"
        data-testid="healthcare-dropdown"
      >
        {virtualScroll ? (
          <div
            ref={parentRef}
            style={{
              height: Math.min(options.length * ITEM_HEIGHT, MAX_MENU_HEIGHT),
              width: '100%',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const option = options[virtualRow.index];
                return (
                  <MenuItem
                    key={option.value}
                    value={option.value}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderOptionContent(option)}
                  </MenuItem>
                );
              })}
            </div>
          </div>
        ) : (
          options.map((option) => (
            <MenuItem 
              key={option.value} 
              value={option.value}
              aria-label={`${option.label}${option.code ? ` - ${option.code}` : ''}`}
            >
              {renderOptionContent(option)}
            </MenuItem>
          ))
        )}
      </Select>
      {helperText && (
        <span
          id={`${label}-helper-text`}
          style={{
            fontSize: '0.75rem',
            color: error ? theme.palette.error.main : theme.palette.text.secondary,
            marginTop: '4px',
          }}
        >
          {helperText}
        </span>
      )}
    </FormControl>
  );
};