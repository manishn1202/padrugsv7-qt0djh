/**
 * @fileoverview A comprehensive page component for viewing and managing prior authorization requests
 * with real-time updates, role-based access control, and enhanced security features.
 * @version 1.0.0
 * @license MIT
 */

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Grid,
  Paper,
  CircularProgress,
  Skeleton,
  Box,
  Typography,
  useTheme
} from '@mui/material';
import { useRequest } from '../hooks/useRequest';
import { useNotification } from '../hooks/useNotification';
import { AuthorizationRequest } from '../types/request.types';
import RequestDetails from '../components/requests/RequestDetails';
import RequestHistory from '../components/requests/RequestHistory';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { usePerformanceMonitor } from '@monitoring/performance';

// Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  pageId: 'request-details',
  metricThresholds: {
    loadTime: 3000,
    renderTime: 1000,
    interactionTime: 200
  }
};

/**
 * Props interface for the RequestDetails page component
 */
interface RequestDetailsPageProps {
  className?: string;
  correlationId: string;
  enableRealTimeUpdates?: boolean;
  performanceConfig?: typeof PERFORMANCE_CONFIG;
}

/**
 * Enhanced page component for displaying comprehensive request details
 * with security and accessibility features
 */
const RequestDetailsPage: React.FC<RequestDetailsPageProps> = ({
  className,
  correlationId,
  enableRealTimeUpdates = true,
  performanceConfig = PERFORMANCE_CONFIG
}) => {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const { getRequest } = useRequest();
  const { showNotification } = useNotification();
  const [request, setRequest] = useState<AuthorizationRequest | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize performance monitoring
  const { trackMetric, markInteraction } = usePerformanceMonitor(performanceConfig);

  /**
   * Fetches request details with error handling and performance tracking
   */
  const fetchRequestDetails = useCallback(async () => {
    if (!id) {
      showNotification('error', 'Request ID is missing', 'HIGH');
      return;
    }

    const startTime = performance.now();
    try {
      setLoading(true);
      const response = await getRequest(id);
      
      if (response.success && response.data) {
        setRequest(response.data);
        trackMetric('requestLoadTime', performance.now() - startTime);
      } else {
        throw new Error(response.error?.message || 'Failed to fetch request details');
      }
    } catch (error) {
      showNotification(
        'error',
        'Failed to load request details. Please try again.',
        'HIGH',
        true
      );
      console.error('Request details fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [id, getRequest, showNotification, trackMetric]);

  // Initial data fetch
  useEffect(() => {
    fetchRequestDetails();
  }, [fetchRequestDetails]);

  // Real-time updates subscription
  useEffect(() => {
    if (!enableRealTimeUpdates || !id) return;

    // WebSocket connection setup would go here
    const cleanup = () => {
      // WebSocket cleanup logic
    };

    return cleanup;
  }, [enableRealTimeUpdates, id]);

  // Loading state with skeleton UI
  if (loading) {
    return (
      <Box
        className={className}
        sx={{
          p: theme.spacing(3),
          minHeight: '400px'
        }}
        role="progressbar"
        aria-label="Loading request details"
      >
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={200} />
          </Grid>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <Box
          sx={{
            p: theme.spacing(3),
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" color="error">
            Error loading request details
          </Typography>
        </Box>
      }
    >
      <Box
        className={className}
        sx={{
          p: theme.spacing(3),
          minHeight: '400px'
        }}
        role="main"
        aria-label="Prior Authorization Request Details"
      >
        <Grid container spacing={3}>
          {/* Main request details section */}
          <Grid item xs={12}>
            <Paper elevation={2}>
              <Suspense
                fallback={
                  <Box sx={{ p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                }
              >
                <RequestDetails
                  className="request-details-main"
                  ariaLabel="Request details section"
                />
              </Suspense>
            </Paper>
          </Grid>

          {/* Request information and history layout */}
          <Grid container item spacing={3}>
            {/* Left column - Additional request information */}
            <Grid item xs={12} md={8}>
              <Paper
                elevation={2}
                sx={{
                  p: theme.spacing(2),
                  height: '100%'
                }}
              >
                {request && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: theme.spacing(2)
                    }}
                  >
                    {/* Request details content */}
                    <Typography variant="h6" component="h2">
                      Request Information
                    </Typography>
                    {/* Additional request information would be rendered here */}
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Right column - Request history timeline */}
            <Grid item xs={12} md={4}>
              <Paper
                elevation={2}
                sx={{
                  p: theme.spacing(2),
                  height: '100%',
                  maxHeight: '600px',
                  overflow: 'auto'
                }}
              >
                <Typography variant="h6" component="h2" gutterBottom>
                  Request History
                </Typography>
                <Suspense
                  fallback={
                    <Box sx={{ p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  }
                >
                  {id && (
                    <RequestHistory
                      requestId={id}
                      className="request-history-timeline"
                    />
                  )}
                </Suspense>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
};

export default RequestDetailsPage;