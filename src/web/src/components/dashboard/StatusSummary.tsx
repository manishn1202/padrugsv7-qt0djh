import React, { useEffect, useCallback, useState, memo } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { useRequest } from '../../hooks/useRequest';
import { AuthorizationStatus } from '../../types/request.types';
import Card from '../common/Card';

// Constants for refresh interval and error retry
const REFRESH_INTERVAL = 30000; // 30 seconds
const ERROR_RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRIES = 3;

/**
 * Interface for status metric data with loading and error states
 */
interface StatusMetric {
  current: number;
  total: number;
  label: string;
  status: AuthorizationStatus;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date;
}

/**
 * A dashboard component that displays real-time authorization request status metrics
 * using Material Design cards with progress indicators.
 */
const StatusSummary = memo(() => {
  // State for metrics data and loading
  const [metrics, setMetrics] = useState<StatusMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Get search function from request hook
  const { searchRequests } = useRequest();

  /**
   * Fetches and calculates status metrics with error handling
   */
  const fetchStatusMetrics = useCallback(async () => {
    try {
      // Fetch metrics for each status type
      const results = await Promise.all([
        searchRequests(
          { status: AuthorizationStatus.PENDING_DOCUMENTS },
          { page: 0, pageSize: 0, sortBy: 'createdAt', sortOrder: 'desc' }
        ),
        searchRequests(
          { status: AuthorizationStatus.UNDER_REVIEW },
          { page: 0, pageSize: 0, sortBy: 'createdAt', sortOrder: 'desc' }
        ),
        searchRequests(
          { status: AuthorizationStatus.APPROVED },
          { page: 0, pageSize: 0, sortBy: 'createdAt', sortOrder: 'desc' }
        ),
      ]);

      // Process results and update metrics
      const newMetrics: StatusMetric[] = [
        {
          label: 'Pending Documents',
          status: AuthorizationStatus.PENDING_DOCUMENTS,
          current: results[0].data?.totalItems || 0,
          total: 15,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        },
        {
          label: 'Under Review',
          status: AuthorizationStatus.UNDER_REVIEW,
          current: results[1].data?.totalItems || 0,
          total: 20,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        },
        {
          label: 'Approved Today',
          status: AuthorizationStatus.APPROVED,
          current: results[2].data?.totalItems || 0,
          total: 30,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        },
      ];

      setMetrics(newMetrics);
      setError(null);
      setRetryCount(0);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
      
      // Implement retry logic
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchStatusMetrics();
        }, ERROR_RETRY_DELAY);
      }
    }
  }, [searchRequests, retryCount]);

  // Set up initial fetch and refresh interval
  useEffect(() => {
    fetchStatusMetrics();

    const intervalId = setInterval(fetchStatusMetrics, REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchStatusMetrics]);

  // Render loading state
  if (loading) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  // Render error state
  if (error && retryCount >= MAX_RETRIES) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Typography color="error" variant="body1">
          Error loading status metrics. Please try again later.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          md: '1fr 1fr 1fr'
        },
        gap: 2,
        p: 2,
      }}
    >
      {metrics.map((metric) => (
        <Card
          key={metric.status}
          elevation={1}
          data-testid={`status-card-${metric.status.toLowerCase()}`}
        >
          <Box sx={{ p: 2 }}>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 500 }}
            >
              {metric.label}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="h4" component="span" sx={{ mr: 1 }}>
                {metric.current}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                / {metric.total}
              </Typography>
            </Box>

            <LinearProgress
              variant="determinate"
              value={(metric.current / metric.total) * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'background.paper',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                },
              }}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: 'block' }}
            >
              Last updated: {metric.lastUpdated.toLocaleTimeString()}
            </Typography>
          </Box>
        </Card>
      ))}
    </Box>
  );
});

// Display name for debugging
StatusSummary.displayName = 'StatusSummary';

export default StatusSummary;