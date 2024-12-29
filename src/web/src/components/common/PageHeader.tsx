// React core - version ^18.2.0
import React, { useCallback, useMemo } from 'react';

// Material UI components - version ^5.0.0
import { Box, Typography, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal imports
import Breadcrumbs, { BreadcrumbsProps, BreadcrumbAnalytics } from './Breadcrumbs';
import { useTheme, Theme } from '../../hooks/useTheme';
import { trackNavigation } from '../../hooks/useAnalytics';

/**
 * Enhanced props interface for the PageHeader component with comprehensive type safety
 */
export interface PageHeaderProps {
  /** Page title text with required aria-label */
  title: string;
  /** Array of breadcrumb items with analytics data */
  breadcrumbs?: BreadcrumbsProps['items'];
  /** Optional action buttons or controls with keyboard support */
  actions?: React.ReactNode;
  /** Optional subtitle text with proper contrast */
  subtitle?: string;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Enable high contrast mode override */
  highContrast?: boolean;
  /** Custom analytics data for tracking */
  analyticsData?: {
    pageId: string;
    section: string;
    subsection?: string;
  };
}

// Styled components with enhanced accessibility and responsive design
const HeaderRoot = styled(Box, {
  shouldForwardProp: prop => prop !== 'highContrast',
})<{ highContrast?: boolean }>(({ theme, highContrast }) => ({
  padding: theme.spacing(3),
  backgroundColor: highContrast 
    ? theme.palette.background.default 
    : theme.palette.background.paper,
  borderBottom: '1px solid',
  borderColor: highContrast 
    ? theme.palette.primary.main 
    : theme.palette.divider,
  position: 'relative',
  direction: theme.direction === 'rtl' ? 'rtl' : 'ltr',
}));

const TitleContainer = styled(Stack)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: theme.spacing(2),
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
}));

const TitleContent = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
}));

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  fontSize: {
    xs: theme.typography.h3.fontSize,
    sm: theme.typography.h2.fontSize,
    md: theme.typography.h2.fontSize,
  },
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const Subtitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(0.5),
  fontSize: {
    xs: theme.typography.body2.fontSize,
    sm: theme.typography.body1.fontSize,
  },
}));

const Actions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
  flexShrink: 0,
  [theme.breakpoints.down('sm')]: {
    width: '100%',
    justifyContent: 'flex-end',
  },
}));

/**
 * PageHeader component providing consistent layout and styling for page titles,
 * breadcrumb navigation, and optional action buttons following Material Design 3.0
 * specifications with enhanced accessibility and analytics tracking.
 *
 * @component
 * @example
 * ```tsx
 * <PageHeader
 *   title="Prior Authorization Requests"
 *   subtitle="Manage and track authorization requests"
 *   breadcrumbs={[
 *     { label: 'Home', path: '/' },
 *     { label: 'Requests', path: '/requests' }
 *   ]}
 *   actions={<Button variant="contained">New Request</Button>}
 * />
 * ```
 */
export const PageHeader: React.FC<PageHeaderProps> = React.memo(({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
  highContrast: highContrastProp,
  analyticsData,
}) => {
  // Hooks
  const { theme, isHighContrast } = useTheme();
  
  // Determine final high contrast mode
  const effectiveHighContrast = highContrastProp ?? isHighContrast;

  /**
   * Handles navigation tracking when breadcrumbs are clicked
   */
  const handleBreadcrumbClick = useCallback((path: string, label: string) => {
    trackNavigation({
      type: 'breadcrumb',
      path,
      label,
      pageId: analyticsData?.pageId,
      section: analyticsData?.section,
      subsection: analyticsData?.subsection,
      timestamp: new Date().toISOString(),
    });
  }, [analyticsData]);

  // Error boundary for breadcrumbs
  const renderBreadcrumbs = useMemo(() => {
    if (!breadcrumbs?.length) return null;

    try {
      return (
        <Breadcrumbs
          items={breadcrumbs}
          maxItems={4}
          ariaLabel={`${title} navigation`}
        />
      );
    } catch (error) {
      console.error('Error rendering breadcrumbs:', error);
      return null;
    }
  }, [breadcrumbs, title]);

  return (
    <HeaderRoot 
      className={className}
      highContrast={effectiveHighContrast}
      component="header"
      role="banner"
    >
      {renderBreadcrumbs}
      
      <TitleContainer>
        <TitleContent>
          <Title
            variant="h1"
            component="h1"
            aria-label={title}
          >
            {title}
          </Title>
          
          {subtitle && (
            <Subtitle
              variant="subtitle1"
              aria-label={subtitle}
            >
              {subtitle}
            </Subtitle>
          )}
        </TitleContent>

        {actions && (
          <Actions role="toolbar" aria-label="Page actions">
            {actions}
          </Actions>
        )}
      </TitleContainer>
    </HeaderRoot>
  );
});

// Display name for debugging
PageHeader.displayName = 'PageHeader';

// Default export
export default PageHeader;