/**
 * @fileoverview Enhanced Layout component implementing Material Design 3.0 specifications
 * with comprehensive accessibility features, responsive behavior, and analytics tracking.
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  useTheme,
  useMediaQuery,
  IconButton,
  AppBar,
  Toolbar,
  CircularProgress,
  styled
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { useSwipeable } from 'react-swipeable';

// Internal imports
import { Sidebar } from './Sidebar';
import { PageHeader, PageHeaderProps } from './PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';

// Styled components with enhanced accessibility
const StyledRoot = styled(Box, {
  shouldForwardProp: prop => prop !== 'isHighContrast',
})<{ isHighContrast?: boolean }>(({ theme, isHighContrast }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: isHighContrast 
    ? theme.palette.background.default 
    : theme.palette.background.paper,
  direction: theme.direction === 'rtl' ? 'rtl' : 'ltr',
}));

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  position: 'fixed',
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  boxShadow: theme.shadows[2],
}));

const StyledContent = styled(Container)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: 64,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  zIndex: theme.zIndex.modal + 1,
}));

// Interface definitions
export interface LayoutProps {
  /** Child components to render in the layout */
  children: React.ReactNode;
  /** Title for the current page */
  pageTitle: string;
  /** Optional action buttons for the page header */
  pageActions?: React.ReactNode[];
  /** Loading state for dynamic content */
  isLoading?: boolean;
  /** Enable high contrast mode for accessibility */
  highContrastMode?: boolean;
}

/**
 * Enhanced Layout component providing the core structure for the Enhanced PA System
 * with comprehensive accessibility features and responsive behavior.
 */
export const Layout: React.FC<LayoutProps> = React.memo(({
  children,
  pageTitle,
  pageActions,
  isLoading = false,
  highContrastMode = false,
}) => {
  // Hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { trackNavigation } = useAnalytics();

  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Swipe handlers for mobile
  const swipeHandlers = useSwipeable({
    onSwipedRight: () => !isMobile && setIsSidebarOpen(true),
    onSwipedLeft: () => !isMobile && setIsSidebarOpen(false),
    trackMouse: false,
    preventDefaultTouchmoveEvent: true,
  });

  // Handle sidebar toggle with analytics
  const handleDrawerToggle = () => {
    setIsSidebarOpen(prev => {
      const newState = !prev;
      trackNavigation({
        type: 'sidebar',
        action: newState ? 'open' : 'close',
        timestamp: new Date().toISOString(),
      });
      // Announce state change for screen readers
      const message = `Navigation menu ${newState ? 'opened' : 'closed'}`;
      window.setTimeout(() => {
        document.getElementById('a11y-status')?.setAttribute('aria-label', message);
      }, 100);
      return newState;
    });
  };

  // Memoized page header props
  const headerProps: PageHeaderProps = useMemo(() => ({
    title: pageTitle,
    actions: pageActions,
    highContrast: highContrastMode,
    analyticsData: {
      pageId: pageTitle.toLowerCase().replace(/\s+/g, '-'),
      section: 'main',
    },
  }), [pageTitle, pageActions, highContrastMode]);

  return (
    <StyledRoot 
      isHighContrast={highContrastMode}
      {...swipeHandlers}
    >
      {/* Accessibility status announcer */}
      <div
        id="a11y-status"
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}
      />

      {/* App Bar */}
      <StyledAppBar>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            edge="start"
            onClick={handleDrawerToggle}
            sx={{
              marginRight: 2,
              display: { sm: 'none' },
            }}
          >
            <MenuIcon />
          </IconButton>
          {/* Additional app bar content can be added here */}
        </Toolbar>
      </StyledAppBar>

      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />

      {/* Main Content */}
      <StyledContent
        maxWidth="xl"
        component="main"
        role="main"
        aria-label="Main content"
      >
        <PageHeader {...headerProps} />
        
        {/* Loading Overlay */}
        {isLoading && (
          <LoadingOverlay>
            <CircularProgress
              size={48}
              aria-label="Loading content"
            />
          </LoadingOverlay>
        )}

        {/* Error Boundary wrapped content */}
        <React.Suspense fallback={<CircularProgress />}>
          {children}
        </React.Suspense>
      </StyledContent>
    </StyledRoot>
  );
});

// Display name for debugging
Layout.displayName = 'Layout';

export default Layout;