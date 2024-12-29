/**
 * @fileoverview Enhanced main layout component providing the base structure for the
 * Enhanced Prior Authorization System with comprehensive authentication, accessibility,
 * and responsive design features.
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Layout, LayoutProps } from '../components/common/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useAnalytics } from '../hooks/useAnalytics';

/**
 * Props interface for the MainLayout component
 */
interface MainLayoutProps {
  /** Child components to render in the layout */
  children: React.ReactNode;
  /** Toggle for high contrast theme support */
  highContrastMode?: boolean;
  /** Toggle for RTL layout support */
  isRTL?: boolean;
}

/**
 * Enhanced main layout wrapper component that handles authentication, MFA,
 * enterprise SSO, and responsive layout with accessibility features.
 *
 * @component
 * @example
 * ```tsx
 * <MainLayout>
 *   <YourPageContent />
 * </MainLayout>
 * ```
 */
export const MainLayout: React.FC<MainLayoutProps> = React.memo(({
  children,
  highContrastMode = false,
  isRTL = false
}) => {
  // Hooks
  const location = useLocation();
  const { 
    isAuthenticated, 
    user, 
    checkMfaStatus, 
    validateEnterpriseConnection,
    error: authError 
  } = useAuth();
  const { theme, isHighContrast } = useTheme();
  const { trackNavigation } = useAnalytics();

  // Track page navigation
  useEffect(() => {
    if (isAuthenticated && user) {
      trackNavigation({
        type: 'page',
        path: location.pathname,
        userId: user.sub,
        timestamp: new Date().toISOString()
      });
    }
  }, [location.pathname, isAuthenticated, user, trackNavigation]);

  // Verify MFA and enterprise connection
  useEffect(() => {
    const verifyAuth = async () => {
      if (isAuthenticated && user) {
        try {
          // Check MFA status
          const mfaStatus = await checkMfaStatus();
          if (!mfaStatus.required) {
            throw new Error('MFA verification required');
          }

          // Validate enterprise connection if applicable
          const isEnterpriseUser = user.email?.includes('@enterprise.com');
          if (isEnterpriseUser) {
            const isValidConnection = await validateEnterpriseConnection();
            if (!isValidConnection) {
              throw new Error('Enterprise connection validation failed');
            }
          }
        } catch (error) {
          console.error('Authentication verification failed:', error);
        }
      }
    };

    verifyAuth();
  }, [isAuthenticated, user, checkMfaStatus, validateEnterpriseConnection]);

  // Handle authentication errors
  const handleAuthError = useCallback(() => {
    if (authError) {
      // Implement error handling UI
      console.error('Authentication error:', authError);
      return <Navigate to="/auth/error" state={{ error: authError }} />;
    }
    return null;
  }, [authError]);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Layout props
  const layoutProps: LayoutProps = {
    children,
    pageTitle: document.title,
    isLoading: false,
    highContrastMode: highContrastMode || isHighContrast
  };

  return (
    <>
      {handleAuthError()}
      <Layout {...layoutProps} />
    </>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

// Default export
export default MainLayout;

// Type exports
export type { MainLayoutProps };