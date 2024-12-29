import React from 'react';
import { Card as MuiCard, CardContent as MuiCardContent } from '@mui/material';
import { styled } from '@mui/material/styles';
import { theme } from '../../assets/styles/theme';

// Interface for Card component props
interface CardProps {
  /**
   * Visual style variant of the card
   * @default "elevation"
   */
  variant?: 'elevation' | 'outlined';
  
  /**
   * Shadow depth for elevation variant
   * @default 1
   */
  elevation?: number;
  
  /**
   * Removes internal padding for custom layouts
   * @default false
   */
  noPadding?: boolean;
  
  /**
   * Expands card to container width
   * @default false
   */
  fullWidth?: boolean;
  
  /**
   * Optional click handler for interactive cards
   */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  
  /**
   * Card content elements
   */
  children: React.ReactNode;
  
  /**
   * ARIA role for accessibility
   * @default "region"
   */
  role?: string;
  
  /**
   * Optional CSS class name
   */
  className?: string;
  
  /**
   * Optional test ID for testing
   */
  'data-testid'?: string;
}

// Styled card component with healthcare-specific styling
const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => 
    !['fullWidth', 'noPadding', 'onClick'].includes(prop as string),
})<CardProps>(({ theme, variant, elevation = 1, fullWidth, onClick }) => ({
  width: fullWidth ? '100%' : 'auto',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.shorter,
  }),
  cursor: onClick ? 'pointer' : 'default',
  position: 'relative',
  
  // Variant-specific styles
  ...(variant === 'elevation' && {
    boxShadow: theme.shadows[elevation],
  }),
  
  ...(variant === 'outlined' && {
    border: `1px solid ${theme.palette.divider}`,
  }),
  
  // Interactive states
  ...(onClick && {
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[elevation + 1],
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  }),
  
  // Accessibility focus styles
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  // High contrast mode support
  '@media (forced-colors: active)': {
    border: '1px solid CanvasText',
  },
}));

// Styled card content with configurable padding
const StyledCardContent = styled(MuiCardContent, {
  shouldForwardProp: (prop) => prop !== 'noPadding',
})<{ noPadding?: boolean }>(({ theme, noPadding }) => ({
  padding: noPadding ? 0 : theme.spacing(3),
  '&:last-child': {
    paddingBottom: noPadding ? 0 : theme.spacing(3),
  },
}));

/**
 * A reusable card component implementing Material Design 3.0 specification.
 * Provides an accessible and themeable container with configurable elevation,
 * padding, and border radius for content organization.
 */
const Card = React.memo<CardProps>(({
  variant = 'elevation',
  elevation = 1,
  noPadding = false,
  fullWidth = false,
  onClick,
  children,
  role = 'region',
  className,
  'data-testid': testId,
  ...props
}) => {
  // Handle keyboard interaction for interactive cards
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
  }, [onClick]);

  return (
    <StyledCard
      variant={variant}
      elevation={elevation}
      fullWidth={fullWidth}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={role}
      tabIndex={onClick ? 0 : undefined}
      className={className}
      data-testid={testId}
      aria-disabled={!onClick}
      {...props}
    >
      <StyledCardContent noPadding={noPadding}>
        {children}
      </StyledCardContent>
    </StyledCard>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;