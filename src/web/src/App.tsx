/**
 * @fileoverview Root application component that handles routing, layouts, theme configuration,
 * accessibility, and security for the Enhanced Prior Authorization System.
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Internal imports
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ROUTES, withProtectedRoute } from './config/routes.config';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';

/**
 * Root application component that sets up secure routing, accessible theming,
 * error boundaries, and analytics tracking.
 */
const App: React.FC = () => {
  // Hooks
  const { isAuthenticated, isLoading, error } = useAuth();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Handle system theme changes
  useEffect(() => {
    if (prefersDarkMode !== isDarkMode) {
      toggleTheme();
    }
  }, [prefersDarkMode, isDarkMode, toggleTheme]);

  /**
   * Renders routes with appropriate layout wrappers and security checks
   */
  const renderRoutes = useCallback(() => {
    return Object.values(ROUTES).map(route => {
      const Component = route.component;
      const WrappedComponent = withProtectedRoute(Component, route);

      // Determine appropriate layout based on route
      const getLayout = (children: React.ReactNode) => {
        if (route.path === '/login') {
          return <AuthLayout>{children}</AuthLayout>;
        }
        if (route.path.startsWith('/dashboard')) {
          return (
            <DashboardLayout
              pageTitle={route.path.split('/').pop() || 'Dashboard'}
              requiredPermissions={route.allowedRoles}
            >
              {children}
            </DashboardLayout>
          );
        }
        return <MainLayout>{children}</MainLayout>;
      };

      return (
        <Route
          key={route.path}
          path={route.path}
          element={getLayout(<WrappedComponent />)}
        />
      );
    });
  }, []);

  // Show loading state while authenticating
  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Loading overlay size="large" />
      </ThemeProvider>
    );
  }

  // Handle authentication errors
  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary
          fallback={
            <div>Authentication error. Please try again later.</div>
          }
        >
          <Navigate to="/login" replace />
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <BrowserRouter>
            <Routes>
              {/* Default redirect */}
              <Route
                path="/"
                element={
                  <Navigate
                    to={isAuthenticated ? '/dashboard' : '/login'}
                    replace
                  />
                }
              />
              
              {/* Application routes */}
              {renderRoutes()}

              {/* Catch-all route for 404 */}
              <Route
                path="*"
                element={
                  <MainLayout>
                    <Navigate to="/404" replace />
                  </MainLayout>
                }
              />
            </Routes>
          </BrowserRouter>
        </LocalizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

// Display name for debugging
App.displayName = 'App';

export default App;