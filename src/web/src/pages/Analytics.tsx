// React v18.2.0, Material UI v5.14.0
import React, { useCallback, useEffect, useState } from 'react';
import { 
  Grid, 
  Card, 
  Select, 
  MenuItem, 
  Button, 
  CircularProgress,
  Typography,
  Box,
  useTheme
} from '@mui/material';
import { CloudDownload, Refresh } from '@mui/icons-material';

// Internal imports
import { ApprovalRateChart } from '../components/reports/ApprovalRateChart';
import { ProcessingTimeChart } from '../components/reports/ProcessingTimeChart';
import { RequestVolumeChart } from '../components/reports/RequestVolumeChart';
import { useAnalytics } from '../hooks/useAnalytics';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { TimeRange, AnalyticsExportConfig } from '../types/analytics.types';

// Constants
const CHART_HEIGHT = 400;
const EXPORT_RATE_LIMIT = 5; // exports per minute
const DATA_FRESHNESS_THRESHOLD = 30000; // 30 seconds
const TIME_RANGE_OPTIONS: TimeRange[] = ['24h', '7d', '30d', '90d', '1y'];

/**
 * Analytics Dashboard Component
 * 
 * Comprehensive analytics dashboard implementing real-time metrics visualization
 * with enhanced accessibility and performance optimizations.
 */
const Analytics: React.FC = () => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [exportCount, setExportCount] = useState(0);
  
  // Initialize analytics hook with WebSocket monitoring
  const {
    metrics,
    loading,
    error,
    wsStatus,
    cacheStatus,
    fetchAnalytics,
    downloadReport
  } = useAnalytics({
    timeRange,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    metricType: ['all'],
    userRole: ['all']
  });

  /**
   * Handles time range filter changes with debouncing
   */
  const handleTimeRangeChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    const newTimeRange = event.target.value as TimeRange;
    setTimeRange(newTimeRange);
    fetchAnalytics({
      timeRange: newTimeRange,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      metricType: ['all'],
      userRole: ['all']
    });
  }, [fetchAnalytics]);

  /**
   * Handles analytics report export with rate limiting
   */
  const handleExportReport = useCallback(async () => {
    if (exportCount >= EXPORT_RATE_LIMIT) {
      return;
    }

    const exportConfig: AnalyticsExportConfig = {
      format: 'xlsx',
      includeMetrics: ['processingTime', 'approvalRate', 'requestVolume'],
      includeCharts: true,
      fileName: `pa-analytics-${timeRange}-${new Date().toISOString()}`
    };

    try {
      setExportCount(prev => prev + 1);
      await downloadReport(exportConfig);
      
      // Reset export count after 1 minute
      setTimeout(() => {
        setExportCount(prev => Math.max(0, prev - 1));
      }, 60000);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [downloadReport, timeRange, exportCount]);

  // Effect for data freshness monitoring
  useEffect(() => {
    if (cacheStatus === 'stale') {
      fetchAnalytics();
    }
  }, [cacheStatus, fetchAnalytics]);

  // Render loading state
  if (loading === 'loading' && !metrics) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress 
          size={40}
          aria-label="Loading analytics data"
        />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box
        role="alert"
        aria-live="polite"
        p={3}
        textAlign="center"
        color="error.main"
      >
        <Typography variant="h6" gutterBottom>
          Error loading analytics
        </Typography>
        <Typography variant="body1">
          {error}
        </Typography>
        <Button
          startIcon={<Refresh />}
          onClick={() => fetchAnalytics()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box p={3}>
        {/* Header Section */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography variant="h4" component="h1">
            Analytics Dashboard
          </Typography>
          
          <Box display="flex" gap={2}>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              size="small"
              aria-label="Time range filter"
            >
              {TIME_RANGE_OPTIONS.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>

            <Button
              startIcon={<CloudDownload />}
              onClick={handleExportReport}
              disabled={exportCount >= EXPORT_RATE_LIMIT}
              aria-label="Export analytics report"
            >
              Export
            </Button>
          </Box>
        </Box>

        {/* Real-time Status Indicator */}
        {wsStatus === 'connected' && (
          <Box
            bgcolor="success.main"
            color="success.contrastText"
            px={2}
            py={0.5}
            borderRadius={1}
            display="inline-flex"
            alignItems="center"
            mb={2}
          >
            <Typography variant="body2">
              ● Live Updates Active
            </Typography>
          </Box>
        )}

        {/* Charts Grid */}
        <Grid container spacing={3}>
          {/* Processing Time Chart */}
          <Grid item xs={12} md={6}>
            <Card>
              <ProcessingTimeChart
                height={CHART_HEIGHT}
                timeRange={timeRange}
                updateInterval={DATA_FRESHNESS_THRESHOLD}
              />
            </Card>
          </Grid>

          {/* Approval Rate Chart */}
          <Grid item xs={12} md={6}>
            <Card>
              <ApprovalRateChart
                height={CHART_HEIGHT}
                timeRange={timeRange}
              />
            </Card>
          </Grid>

          {/* Request Volume Chart */}
          <Grid item xs={12}>
            <Card>
              <RequestVolumeChart
                height={CHART_HEIGHT}
              />
            </Card>
          </Grid>
        </Grid>

        {/* Summary Metrics */}
        {metrics && (
          <Grid container spacing={3} mt={2}>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Average Processing Time
                </Typography>
                <Typography variant="h5">
                  {metrics.processingTime.toFixed(1)} min
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Approval Rate
                </Typography>
                <Typography variant="h5">
                  {metrics.approvalRate.toFixed(1)}%
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  First-Pass Approval
                </Typography>
                <Typography variant="h5">
                  {metrics.firstPassApproval.toFixed(1)}%
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Cost Reduction
                </Typography>
                <Typography variant="h5">
                  {metrics.costReduction.toFixed(1)}%
                </Typography>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </ErrorBoundary>
  );
};

export default Analytics;