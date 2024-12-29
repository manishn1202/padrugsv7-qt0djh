/**
 * @fileoverview A reusable badge component for displaying authorization request status
 * with WCAG 2.1 compliant color coding and responsive size variants.
 * @version 1.0.0
 * @license MIT
 */

import React from 'react'; // ^18.2.0
import { Chip } from '@mui/material'; // ^5.0.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { AuthorizationStatus } from '../types/request.types';

/**
 * Interface for StatusBadge component props
 */
interface StatusBadgeProps {
  /** The current status of the authorization request */
  status: AuthorizationStatus;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Optional flag for small size variant */
  small?: boolean;
  /** Optional ARIA label for improved accessibility */
  ariaLabel?: string;
}

/**
 * Mapping of status values to Material UI color variants
 */
const STATUS_COLORS = {
  [AuthorizationStatus.DRAFT]: 'default',
  [AuthorizationStatus.SUBMITTED]: 'primary',
  [AuthorizationStatus.PENDING_DOCUMENTS]: 'warning',
  [AuthorizationStatus.UNDER_REVIEW]: 'info',
  [AuthorizationStatus.APPROVED]: 'success',
  [AuthorizationStatus.DENIED]: 'error',
  [AuthorizationStatus.CANCELLED]: 'default'
} as const;

/**
 * Human-readable labels for status values
 */
const STATUS_LABELS = {
  [AuthorizationStatus.DRAFT]: 'Draft',
  [AuthorizationStatus.SUBMITTED]: 'Submitted',
  [AuthorizationStatus.PENDING_DOCUMENTS]: 'Pending Documents',
  [AuthorizationStatus.UNDER_REVIEW]: 'Under Review',
  [AuthorizationStatus.APPROVED]: 'Approved',
  [AuthorizationStatus.DENIED]: 'Denied',
  [AuthorizationStatus.CANCELLED]: 'Cancelled'
} as const;

/**
 * Styled Chip component with enhanced accessibility and responsive sizing
 */
const StyledChip = styled(Chip)(({ theme, size }) => ({
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  height: size === 'small' ? 24 : 32,
  '& .MuiChip-label': {
    fontSize: size === 'small' ? '0.75rem' : '0.875rem',
    padding: size === 'small' ? '0 8px' : '0 12px',
  },
  // Ensure RTL support
  '&[dir="rtl"]': {
    '& .MuiChip-label': {
      paddingRight: size === 'small' ? '8px' : '12px',
      paddingLeft: size === 'small' ? '8px' : '12px',
    },
  },
  // High contrast mode support
  '@media (forced-colors: active)': {
    border: '1px solid currentColor',
  },
}));

/**
 * Get the appropriate theme color for a status that ensures WCAG compliance
 */
const getStatusColor = (status: AuthorizationStatus): string => {
  const theme = useTheme();
  const colorKey = STATUS_COLORS[status];
  
  // Return theme-specific color that meets WCAG 2.1 contrast requirements
  switch (colorKey) {
    case 'primary':
      return theme.palette.primary.main;
    case 'warning':
      return theme.palette.warning.dark; // Using dark variant for better contrast
    case 'info':
      return theme.palette.info.main;
    case 'success':
      return theme.palette.success.main;
    case 'error':
      return theme.palette.error.main;
    default:
      return theme.palette.grey[500];
  }
};

/**
 * StatusBadge component for displaying authorization request status
 * with appropriate color coding and accessibility features
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  small = false,
  ariaLabel,
}) => {
  const theme = useTheme();
  const label = STATUS_LABELS[status];
  const color = STATUS_COLORS[status];

  return (
    <StyledChip
      label={label}
      color={color}
      size={small ? 'small' : 'medium'}
      className={className}
      aria-label={ariaLabel || `Status: ${label}`}
      role="status"
      // Support for high contrast mode
      sx={{
        backgroundColor: getStatusColor(status),
        color: theme.palette.getContrastText(getStatusColor(status)),
      }}
    />
  );
};

// Default export for convenient importing
export default StatusBadge;