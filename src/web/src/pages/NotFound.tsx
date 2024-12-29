/**
 * @fileoverview 404 Not Found page component implementing Material Design 3.0 principles
 * with comprehensive accessibility features and user-friendly error handling.
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, useTheme } from '@mui/material';

// Internal imports
import { MainLayout } from '../layouts/MainLayout';
import Button from '../components/common/Button';

/**
 * NotFound component that provides a user-friendly 404 error page with
 * clear messaging and navigation options following Material Design specifications.
 *
 * @component
 * @example
 * ```tsx
 * <NotFound />
 * ```
 */
const NotFound: React.FC = React.memo(() => {
  // Hooks
  const theme = useTheme();
  const navigate = useNavigate();

  /**
   * Handles navigation back to dashboard with error boundary
   */
  const handleBackToDashboard = useCallback(() => {
    try {
      navigate('/dashboard');
    } catch (error) {
      console.error('Navigation failed:', error);
    }
  }, [navigate]);

  return (
    <MainLayout>
      <Box
        component="main"
        role="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: theme.spacing(3),
        }}
      >
        {/* Error Status */}
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: {
              xs: '4rem',
              sm: '6rem',
              md: '8rem'
            },
            color: theme.palette.primary.main,
            marginBottom: theme.spacing(2),
            fontWeight: theme.typography.fontWeightBold,
          }}
          aria-label="404 Error"
        >
          404
        </Typography>

        {/* Error Message */}
        <Typography
          variant="h2"
          component="h2"
          sx={{
            fontSize: {
              xs: '1.5rem',
              sm: '2rem',
              md: '2.5rem'
            },
            color: theme.palette.text.primary,
            marginBottom: theme.spacing(2),
            fontWeight: theme.typography.fontWeightMedium,
          }}
        >
          Page Not Found
        </Typography>

        {/* Error Description */}
        <Typography
          variant="body1"
          sx={{
            color: theme.palette.text.secondary,
            marginBottom: theme.spacing(4),
            maxWidth: '600px',
          }}
        >
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </Typography>

        {/* Navigation Button */}
        <Button
          variant="contained"
          color="primary"
          onClick={handleBackToDashboard}
          size="large"
          aria-label="Return to dashboard"
          startIcon={null}
          sx={{
            minWidth: '200px',
            marginTop: theme.spacing(2),
          }}
        >
          Back to Dashboard
        </Button>
      </Box>
    </MainLayout>
  );
});

// Display name for debugging
NotFound.displayName = 'NotFound';

export default NotFound;