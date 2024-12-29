import React, { useCallback, useEffect, useRef } from 'react';
import { Tooltip as MuiTooltip, TooltipProps as MuiTooltipProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { theme } from '../../assets/styles/theme';

// Constants for tooltip configuration
const DEFAULT_ENTER_DELAY = 200;
const DEFAULT_LEAVE_DELAY = 0;
const DEFAULT_PLACEMENT = 'bottom';

const TOOLTIP_ROLES = {
  tooltip: 'tooltip',
  description: 'description'
} as const;

// Extend MUI's TooltipProps to include our custom props
export interface TooltipProps extends Omit<MuiTooltipProps, 'title'> {
  title: string | React.ReactNode;
  placement?: MuiTooltipProps['placement'];
  arrow?: boolean;
  enterDelay?: number;
  leaveDelay?: number;
  disabled?: boolean;
  children: React.ReactElement;
  role?: string;
  id?: string;
}

// Styled component extending MUI Tooltip with healthcare-optimized styling
const StyledTooltip = styled(MuiTooltip)(({ theme }) => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[2], // Using dropdown shadow from theme
    padding: theme.spacing(1, 1.5),
    fontSize: '0.875rem',
    maxWidth: 300,
    borderRadius: theme.shape.borderRadius,
    lineHeight: 1.5,
    zIndex: theme.zIndex.tooltip,
    border: `1px solid ${theme.palette.divider}`,
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none'
    }
  },
  '& .MuiTooltip-arrow': {
    color: theme.palette.background.paper,
    '&::before': {
      border: `1px solid ${theme.palette.divider}`
    }
  },
  '& .MuiTooltip-popper': {
    filter: 'drop-shadow(0px 2px 8px rgba(0, 0, 0, 0.15))'
  }
}));

/**
 * A reusable tooltip component implementing Material Design 3.0 specification.
 * Provides informative text on hover/focus with full accessibility support.
 *
 * @param {TooltipProps} props - The props for the Tooltip component
 * @returns {JSX.Element} Rendered tooltip component
 */
const Tooltip: React.FC<TooltipProps> = ({
  title,
  placement = DEFAULT_PLACEMENT,
  arrow = true,
  enterDelay = DEFAULT_ENTER_DELAY,
  leaveDelay = DEFAULT_LEAVE_DELAY,
  disabled = false,
  children,
  role = TOOLTIP_ROLES.tooltip,
  id,
  ...restProps
}) => {
  const tooltipId = useRef(id || `tooltip-${Math.random().toString(36).substr(2, 9)}`);
  const childRef = useRef<HTMLElement>(null);

  // Handle keyboard focus management
  const handleKeyboardFocus = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && childRef.current) {
      childRef.current.blur();
    }
  }, []);

  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardFocus);
    return () => {
      window.removeEventListener('keydown', handleKeyboardFocus);
    };
  }, [handleKeyboardFocus]);

  // Don't render tooltip if disabled or no title
  if (disabled || !title) {
    return children;
  }

  // Clone child element to add accessibility attributes
  const childWithProps = React.cloneElement(children, {
    ref: childRef,
    'aria-describedby': tooltipId.current,
    tabIndex: children.props.tabIndex ?? 0,
    role: children.props.role ?? role
  });

  return (
    <StyledTooltip
      id={tooltipId.current}
      title={title}
      placement={placement}
      arrow={arrow}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      PopperProps={{
        modifiers: [{
          name: 'offset',
          options: {
            offset: [0, 8] // Consistent with 8px grid system
          }
        }]
      }}
      {...restProps}
    >
      {childWithProps}
    </StyledTooltip>
  );
};

// Error boundary wrapper for custom content
const TooltipWithErrorBoundary: React.FC<TooltipProps> = (props) => {
  try {
    return <Tooltip {...props} />;
  } catch (error) {
    console.error('Tooltip rendering error:', error);
    return props.children;
  }
};

export default TooltipWithErrorBoundary;