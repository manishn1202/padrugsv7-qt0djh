// React Chart.js v4.0.0, React v18.2.0, Lodash v4.17.21
import React, { memo, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';

// Internal imports
import { ChartType, ChartProps, TimeRange } from './AnalyticsChart';
import { useAnalytics } from '../../hooks/useAnalytics';
import AnalyticsChart from './AnalyticsChart';

// Constants for chart configuration
const DEFAULT_HEIGHT = 300;
const DEFAULT_WIDTH = '100%';
const DEFAULT_UPDATE_INTERVAL = 30000; // 30 seconds
const TARGET_PROCESSING_TIME = 60; // Target processing time in minutes
const CHART_COLORS = {
  primary: '#0066CC',
  target: '#28A745',
  grid: '#E5E5E5'
} as const;

// Interface for component props
interface ProcessingTimeChartProps {
  height?: number;
  width?: number | string;
  timeRange: TimeRange;
  updateInterval?: number;
  showTargetLine?: boolean;
}

/**
 * ProcessingTimeChart Component
 * 
 * A specialized chart component for visualizing prior authorization processing time metrics
 * with real-time updates and healthcare-optimized styling.
 * 
 * @param props - Component properties
 * @returns JSX.Element - Rendered chart component
 */
const ProcessingTimeChart: React.FC<ProcessingTimeChartProps> = memo(({
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  timeRange,
  updateInterval = DEFAULT_UPDATE_INTERVAL,
  showTargetLine = true
}) => {
  // Analytics hook for real-time data
  const { 
    chartData: processingTimeData, 
    loading, 
    error,
    wsStatus 
  } = useAnalytics({
    timeRange,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    metricType: ['processingTime'],
    userRole: ['all']
  }, {
    refreshInterval: updateInterval,
    metrics: ['processingTime'],
    enabled: true
  });

  // Memoized chart options with healthcare-specific configuration
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Processing Time (minutes)',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        ticks: {
          callback: (value: number) => {
            return `${value}m`;
          }
        },
        grid: {
          color: CHART_COLORS.grid
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time Period',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        grid: {
          display: false
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `Processing Time: ${context.raw}m`;
          }
        }
      },
      annotation: showTargetLine ? {
        annotations: {
          targetLine: {
            type: 'line',
            yMin: TARGET_PROCESSING_TIME,
            yMax: TARGET_PROCESSING_TIME,
            borderColor: CHART_COLORS.target,
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              content: '80% Reduction Target',
              display: true,
              position: 'end'
            }
          }
        }
      } : undefined,
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      }
    }
  }), [showTargetLine]);

  // Debounced update handler for performance optimization
  const handleDataUpdate = useMemo(
    () => debounce((newData) => {
      console.log('Processing time data updated:', newData);
    }, 500),
    []
  );

  // Effect for handling WebSocket status changes
  useEffect(() => {
    if (wsStatus === 'error') {
      console.error('WebSocket connection error - falling back to polling');
    }
  }, [wsStatus]);

  // Error state
  if (error) {
    return (
      <div 
        role="alert"
        aria-live="polite"
        className="chart-error"
        style={{ 
          color: '#DC3545',
          textAlign: 'center',
          padding: '20px'
        }}
      >
        Error loading processing time data: {error}
      </div>
    );
  }

  // Loading state
  if (loading === 'loading' && !processingTimeData) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="chart-loading"
        style={{ 
          textAlign: 'center',
          padding: '20px'
        }}
      >
        Loading processing time metrics...
      </div>
    );
  }

  return (
    <div
      className="processing-time-chart"
      style={{ height, width }}
      role="region"
      aria-label="Prior Authorization Processing Time Chart"
    >
      <AnalyticsChart
        type={ChartType.line}
        data={processingTimeData || {
          labels: [],
          datasets: [{
            label: 'Processing Time',
            data: [],
            borderColor: CHART_COLORS.primary,
            tension: 0.4
          }]
        }}
        options={chartOptions}
        height={height}
        width={width}
        accessibilityLabel="Processing time trends with target line"
      />
      {wsStatus === 'connected' && (
        <div 
          className="real-time-indicator"
          aria-live="polite"
          style={{ 
            fontSize: '12px',
            color: '#28A745',
            textAlign: 'right',
            marginTop: '4px'
          }}
        >
          Real-time updates active
        </div>
      )}
    </div>
  );
});

ProcessingTimeChart.displayName = 'ProcessingTimeChart';

export default ProcessingTimeChart;