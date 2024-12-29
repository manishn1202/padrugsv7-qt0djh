/**
 * @fileoverview Enhanced login page component with OAuth 2.0 + OIDC authentication
 * @version 1.0.0
 * @package react ^18.2.0
 * @package react-router-dom ^6.0.0
 * @package notistack ^3.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import AuthLayout from '../layouts/AuthLayout';
import LoginForm from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';
import { withSecurityMonitoring } from '../utils/security';

// Constants for routes and messages
const DASHBOARD_ROUTE = '/dashboard';
const SUCCESS_MESSAGE = 'Login successful! Redirecting...';
const ERROR_MESSAGE = 'Authentication failed. Please try again.';

/**
 * Enhanced login page component implementing secure authentication with
 * comprehensive monitoring and enterprise SSO support
 */
const LoginPage: React.FC = () => {
  // Hooks initialization
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isAuthenticated, isLoading, login, loginWithEnterprise } = useAuth();

  /**
   * Effect to handle authenticated state redirects
   */
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(DASHBOARD_ROUTE, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  /**
   * Handles successful login completion with security logging
   */
  const handleLoginSuccess = useCallback(() => {
    enqueueSnackbar(SUCCESS_MESSAGE, {
      variant: 'success',
      anchorOrigin: {
        vertical: 'top',
        horizontal: 'right',
      },
      autoHideDuration: 3000,
    });
    navigate(DASHBOARD_ROUTE, { replace: true });
  }, [enqueueSnackbar, navigate]);

  /**
   * Handles login failure with security monitoring
   */
  const handleLoginError = useCallback((error: string) => {
    enqueueSnackbar(error || ERROR_MESSAGE, {
      variant: 'error',
      anchorOrigin: {
        vertical: 'top',
        horizontal: 'right',
      },
      autoHideDuration: 5000,
    });
  }, [enqueueSnackbar]);

  /**
   * Detects and handles enterprise SSO configuration
   */
  const handleEnterpriseLogin = useCallback(async () => {
    try {
      await loginWithEnterprise();
    } catch (error) {
      handleLoginError((error as Error).message);
    }
  }, [loginWithEnterprise, handleLoginError]);

  return (
    <AuthLayout>
      <LoginForm
        onSuccess={handleLoginSuccess}
        onError={handleLoginError}
        organizationId={process.env.VITE_ORGANIZATION_ID}
      />
    </AuthLayout>
  );
};

// Export enhanced component with security monitoring
export default withSecurityMonitoring(LoginPage, {
  component: 'LoginPage',
  eventTypes: ['auth:login:attempt', 'auth:login:success', 'auth:login:failure'],
});