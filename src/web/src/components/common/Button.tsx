import React from 'react';
import { Button as MuiButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { theme } from '../../assets/styles/theme';
import Loading from './Loading';

// Button component props interface extending Material UI ButtonProps
interface ButtonProps {
  /**
   * The variant of the button
   * @default "contained"
   */
  variant?: 'contained' | 'outlined' | 'text';
  
  /**
   * The size of the button
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * The color scheme of the button
   * @default "primary"
   */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  
  /**
   * Whether the button is in a loading state
   * @default false
   */
  loading?: boolean;
  
  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;
  
  /**
   * Whether the button should take up full width
   * @default false
   */
  fullWidth?: boolean;
  
  /**
   * Icon to display before the button label
   */
  startIcon?: React.ReactNode;
  
  /**
   * Icon to display after the button label
   */
  endIcon?: React.ReactNode;
  
  /**
   * Click handler for the button
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  
  /**
   * Button content
   */
  children: React.ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Button ID for testing/tracking
   */
  id?: string;
  
  /**
   * Tab index for keyboard navigation
   */
  tabIndex?: number;
  
  /**
   * Accessibility label
   */
  ariaLabel?: string;
}

// Styled button component with enhanced accessibility and animations
const StyledButton = styled(MuiButton, {
  shouldForwardProp: (prop) => 
    !['loading'].includes(prop as string),
})<ButtonProps>(({ theme, size, loading }) => ({
  // Base styles
  textTransform: 'none',
  fontWeight: theme.typography.fontWeightMedium,
  borderRadius: theme.shape.borderRadius,
  position: 'relative',
  transition: theme.transitions.create([
    'background-color',
    'box-shadow',
    'border-color',
    'color',
    'transform',
    'opacity'
  ]),

  // Size variants
  ...(size === 'small' && {
    padding: theme.spacing(0.5, 2),
    fontSize: '0.875rem',
    minHeight: '32px',
  }),
  ...(size === 'medium' && {
    padding: theme.spacing(1, 3),
    fontSize: '1rem',
    minHeight: '40px',
  }),
  ...(size === 'large' && {
    padding: theme.spacing(1.5, 4),
    fontSize: '1.125rem',
    minHeight: '48px',
  }),

  // Accessibility and interaction states
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  '&:active': {
    transform: 'scale(0.98)',
  },

  // Loading state
  ...(loading && {
    pointerEvents: 'none',
    '& .MuiButton-startIcon, & .MuiButton-endIcon': {
      opacity: 0,
    },
  }),

  // Disabled state
  '&.Mui-disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    '&:focus': {
      outline: '2px solid ButtonText',
    },
  },
}));

/**
 * Enhanced button component following Material Design 3.0 specifications
 * with comprehensive accessibility support and loading states.
 */
export const Button = React.memo<ButtonProps>(({
  variant = 'contained',
  size = 'medium',
  color = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  startIcon,
  endIcon,
  onClick,
  children,
  className,
  id,
  tabIndex,
  ariaLabel,
  ...props
}) => {
  // Handle click with error boundary
  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!loading && !disabled && onClick) {
      onClick(event);
    }
  }, [loading, disabled, onClick]);

  return (
    <StyledButton
      variant={variant}
      size={size}
      color={color}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      startIcon={startIcon}
      endIcon={endIcon}
      onClick={handleClick}
      className={className}
      id={id}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      data-testid={`button-${id || 'unnamed'}`}
      loading={loading}
      {...props}
    >
      {children}
      {loading && (
        <Loading
          size={size === 'small' ? 16 : size === 'medium' ? 20 : 24}
          color={variant === 'contained' ? 'inherit' : color}
          aria-label="Loading"
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </StyledButton>
  );
});

Button.displayName = 'Button';

export default Button;