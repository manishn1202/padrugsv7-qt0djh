import React, { useCallback, useMemo } from 'react';
import { Grid, Typography, CircularProgress, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal imports
import { useAnalytics } from '../../hooks/useAnalytics';
import Card from '../common/Card';
import { MetricsSummary } from '../../types/analytics.types';

// Version comments for external dependencies
// @mui/material version: ^5.14.0
// react version: ^18.2.0

interface AnalyticsSummaryProps {
  /** Optional CSS class name */
  className?: string;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Show trend indicators */
  showTrends?: boolean;
  /** Enable color coding based on thresholds */
  colorCoded?: boolean;
  /** Custom ARIA labels for accessibility */
  ariaLabels?: Record<string, string>;
}

// Styled components
const StyledGrid = styled(Grid)(({ theme }) => ({
  gap: theme.spacing(3),
  width: '100%',
  margin: 0,
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  fontSize: '2rem',
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: 1.2,
  marginBottom: theme.spacing(1),
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
}));

const UpdateTime = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
  marginTop: theme.spacing(2),
}));

/**
 * Formats metric values with appropriate units and localization
 */
const formatMetric = (value: number, type: keyof MetricsSummary): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });

  switch (type) {
    case 'processingTime':
      return `${formatter.format(value)} min`;
    case 'approvalRate':
    case 'firstPassApproval':
    case 'costReduction':
      return `${formatter.format(value)}%`;
    case 'requestVolume':
      return formatter.format(value);
    default:
      return formatter.format(value);
  }
};

/**
 * Determines color coding based on metric thresholds
 */
const getMetricColor = (value: number, type: keyof MetricsSummary, theme: any): string => {
  const thresholds = {
    processingTime: { success: 30, warning: 60 }, // minutes
    approvalRate: { success: 90, warning: 80 }, // percentage
    firstPassApproval: { success: 90, warning: 80 }, // percentage
    costReduction: { success: 60, warning: 40 }, // percentage
  };

  const threshold = thresholds[type];
  if (!threshold) return theme.palette.text.primary;

  if (type === 'processingTime') {
    if (value <= threshold.success) return theme.palette.success.main;
    if (value <= threshold.warning) return theme.palette.warning.main;
    return theme.palette.error.main;
  }

  if (value >= threshold.success) return theme.palette.success.main;
  if (value >= threshold.warning) return theme.palette.warning.main;
  return theme.palette.error.main;
};

/**
 * Analytics Summary component displaying key performance metrics
 * in a responsive grid layout with real-time updates
 */
const AnalyticsSummary: React.FC<AnalyticsSummaryProps> = React.memo(({
  className,
  refreshInterval = 300000, // 5 minutes
  showTrends = true,
  colorCoded = true,
  ariaLabels = {
    processingTime: 'Average processing time',
    approvalRate: 'Overall approval rate',
    firstPassApproval: 'First-pass approval rate',
    requestVolume: 'Total request volume',
    costReduction: 'Cost reduction achieved',
  },
}) => {
  // Analytics hook with real-time updates
  const { metrics, loading, error, cacheStatus } = useAnalytics({
    enabled: true,
    refreshInterval,
  });

  // Memoized metric cards configuration
  const metricCards = useMemo(() => [
    {
      key: 'processingTime',
      label: 'Processing Time',
      target: '30 min',
    },
    {
      key: 'approvalRate',
      label: 'Approval Rate',
      target: '90%',
    },
    {
      key: 'firstPassApproval',
      label: 'First-Pass Approval',
      target: '90%',
    },
    {
      key: 'requestVolume',
      label: 'Request Volume',
      target: 'N/A',
    },
    {
      key: 'costReduction',
      label: 'Cost Reduction',
      target: '60%',
    },
  ], []);

  // Format last updated time
  const formatLastUpdated = useCallback((date: Date) => {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
      .format(-Math.round((Date.now() - date.getTime()) / 60000), 'minutes');
  }, []);

  if (error) {
    return (
      <Card
        variant="outlined"
        role="alert"
        aria-label="Analytics error"
        className={className}
      >
        <Typography color="error">
          Failed to load analytics: {error}
        </Typography>
      </Card>
    );
  }

  return (
    <StyledGrid
      container
      spacing={3}
      className={className}
      role="region"
      aria-label="Analytics Summary"
    >
      {metricCards.map(({ key, label, target }) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={key}>
          <Card
            elevation={1}
            role="article"
            aria-label={ariaLabels[key as keyof MetricsSummary]}
          >
            {loading === 'loading' ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <MetricValue
                  component="p"
                  color={colorCoded ? getMetricColor(metrics?.[key as keyof MetricsSummary] || 0, key as keyof MetricsSummary, theme) : 'inherit'}
                >
                  {formatMetric(metrics?.[key as keyof MetricsSummary] || 0, key as keyof MetricsSummary)}
                </MetricValue>
                <MetricLabel component="h3">
                  {label}
                  <Tooltip title={`Target: ${target}`}>
                    <span role="img" aria-label="target" style={{ marginLeft: 8 }}>
                      🎯
                    </span>
                  </Tooltip>
                </MetricLabel>
              </>
            )}
          </Card>
        </Grid>
      ))}
      
      {metrics?.lastUpdated && (
        <UpdateTime>
          Last updated {formatLastUpdated(new Date(metrics.lastUpdated))}
          {cacheStatus === 'stale' && (
            <Tooltip title="Data may be outdated">
              <span role="img" aria-label="stale data warning" style={{ marginLeft: 4 }}>
                ⚠️
              </span>
            </Tooltip>
          )}
        </UpdateTime>
      )}
    </StyledGrid>
  );
});

AnalyticsSummary.displayName = 'AnalyticsSummary';

export default AnalyticsSummary;