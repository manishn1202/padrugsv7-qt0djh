/**
 * @fileoverview Enhanced dashboard layout component implementing Material Design 3.0
 * with comprehensive accessibility features, responsive behavior, and analytics integration.
 * @version 1.0.0
 */

import React, { useEffect, useCallback, memo, useState } from 'react';
import {
  Box,
  Container,
  useTheme,
  useMediaQuery,
  Drawer,
  AppBar,
  styled
} from '@mui/material';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';

// Internal imports
import Layout, { LayoutProps } from '../components/common/Layout';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';

// Styled components with enhanced accessibility
const StyledRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  position: 'relative'
}));

const StyledContent = styled(Container)(({ theme }) => ({
  flexGrow: 1,
  padding: {
    xs: theme.spacing(2),
    sm: theme.spacing(3),
    md: theme.spacing(4)
  },
  marginTop: '64px',
  transition: 'margin 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms'
}));

// Interface definitions
export interface DashboardLayoutProps extends Omit<LayoutProps, 'children'> {
  /** Child components to render in the dashboard layout */
  children: React.ReactNode;
  /** Title for the current dashboard page */
  pageTitle: string;
  /** Optional action buttons for the dashboard header */
  pageActions?: React.ReactNode[];
  /** Required permissions for accessing this dashboard page */
  requiredPermissions?: string[];
}

/**
 * Enhanced dashboard layout component providing authentication, authorization,
 * responsive layout, and analytics tracking following Material Design 3.0 specifications.
 *
 * @component
 * @example
 * ```tsx
 * <DashboardLayout
 *   pageTitle="Prior Authorization Dashboard"
 *   pageActions={[<Button>New Request</Button>]}
 *   requiredPermissions={['VIEW_DASHBOARD']}
 * >
 *   <DashboardContent />
 * </DashboardLayout>
 * ```
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = memo(({
  children,
  pageTitle,
  pageActions,
  requiredPermissions = [],
  ...layoutProps
}) => {
  // Hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, checkRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackPageView, trackUserInteraction } = useAnalytics();

  // State
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [isLoading, setIsLoading] = useState(false);

  // Handle authentication check
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Handle permission validation
  const hasRequiredPermissions = requiredPermissions.every(permission => 
    user.permissions?.includes(permission)
  );

  if (!hasRequiredPermissions) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Track page view on mount and route changes
  useEffect(() => {
    trackPageView({
      pageTitle,
      path: location.pathname,
      timestamp: new Date().toISOString()
    });
  }, [pageTitle, location.pathname, trackPageView]);

  // Handle drawer toggle with analytics
  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => {
      const newState = !prev;
      trackUserInteraction({
        type: 'drawer',
        action: newState ? 'open' : 'close',
        timestamp: new Date().toISOString()
      });
      return newState;
    });
  }, [trackUserInteraction]);

  // Handle keyboard navigation
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setDrawerOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Handle responsive drawer behavior
  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  return (
    <Layout
      pageTitle={pageTitle}
      pageActions={pageActions}
      isLoading={isLoading}
      {...layoutProps}
    >
      <StyledRoot>
        {/* Accessibility status announcer */}
        <div
          id="dashboard-status"
          role="status"
          aria-live="polite"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}
        />

        {/* Main content */}
        <StyledContent
          maxWidth="xl"
          component="main"
          role="main"
          aria-label={`${pageTitle} content`}
        >
          {/* Error boundary wrapped content */}
          <React.Suspense fallback={<div>Loading...</div>}>
            {children}
          </React.Suspense>
        </StyledContent>
      </StyledRoot>
    </Layout>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;