import React, { useCallback, useEffect, useState } from 'react';
import { Grid, Box, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Internal components
import StatusSummary from '../components/dashboard/StatusSummary';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import QuickActions from '../components/dashboard/QuickActions';
import AnalyticsSummary from '../components/dashboard/AnalyticsSummary';
import PendingRequests from '../components/dashboard/PendingRequests';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Hooks and utilities
import { useRequest } from '../hooks/useRequest';
import { AuthorizationRequest } from '../types/request.types';

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds
const GRID_SPACING = 3;

/**
 * Props interface for Dashboard component
 */
interface DashboardProps {
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Enable WebSocket updates */
  enableWebSocket?: boolean;
}

/**
 * Main dashboard page component that provides a comprehensive overview of the PA system
 * Implements real-time updates, responsive layout, and accessibility features
 */
const Dashboard: React.FC<DashboardProps> = ({
  refreshInterval = REFRESH_INTERVAL,
  enableWebSocket = true
}) => {
  // Hooks
  const theme = useTheme();
  const navigate = useNavigate();
  const { searchRequests } = useRequest();
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  /**
   * Handles navigation to request details
   */
  const handleRequestClick = useCallback((request: AuthorizationRequest) => {
    navigate(`/requests/${request.id}`);
  }, [navigate]);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = useCallback(() => (
    <Box
      sx={{
        p: 3,
        textAlign: 'center',
        color: 'error.main'
      }}
      role="alert"
    >
      An error occurred loading the dashboard. Please try refreshing the page.
    </Box>
  ), []);

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        p: { xs: 2, sm: 3 },
        overflow: 'auto'
      }}
      role="main"
      aria-label="Dashboard"
    >
      <Grid container spacing={GRID_SPACING}>
        {/* Status Summary Section */}
        <Grid item xs={12}>
          <ErrorBoundary fallback={<ErrorFallback />}>
            <StatusSummary />
          </ErrorBoundary>
        </Grid>

        {/* Analytics Summary Section */}
        <Grid item xs={12}>
          <ErrorBoundary fallback={<ErrorFallback />}>
            <AnalyticsSummary 
              refreshInterval={refreshInterval}
              showTrends
              colorCoded
            />
          </ErrorBoundary>
        </Grid>

        {/* Main Content Area */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={GRID_SPACING}>
            {/* Pending Requests Section */}
            <Grid item xs={12}>
              <ErrorBoundary fallback={<ErrorFallback />}>
                <PendingRequests
                  maxItems={10}
                  onRequestClick={handleRequestClick}
                  refreshInterval={refreshInterval}
                />
              </ErrorBoundary>
            </Grid>

            {/* Activity Feed Section */}
            <Grid item xs={12}>
              <ErrorBoundary fallback={<ErrorFallback />}>
                <ActivityFeed
                  limit={isMobile ? 5 : isTablet ? 8 : 10}
                  pollingInterval={refreshInterval}
                />
              </ErrorBoundary>
            </Grid>
          </Grid>
        </Grid>

        {/* Quick Actions Sidebar */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'sticky', top: theme.spacing(3) }}>
            <ErrorBoundary fallback={<ErrorFallback />}>
              <QuickActions
                onActionComplete={() => {
                  // Refresh dashboard data after action completion
                  searchRequests(
                    {},
                    {
                      page: 0,
                      pageSize: 10,
                      sortBy: 'createdAt',
                      sortOrder: 'desc',
                      filters: {}
                    }
                  );
                }}
              />
            </ErrorBoundary>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// Apply error boundary and export
export default ErrorBoundary(Dashboard);