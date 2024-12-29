// React Chart.js v4.0.0, React v18.2.0
import React, { memo, useEffect, useRef } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';

// Internal imports
import { ChartData, ChartType } from '../../types/analytics.types';
import { useAnalytics } from '../../hooks/useAnalytics';

// Register Chart.js components and plugins
ChartJS.register(...registerables, annotationPlugin);

// Constants for healthcare-optimized styling
const CHART_COLORS = {
  primary: '#0066CC',
  secondary: '#3399FF',
  success: '#28A745',
  warning: '#FFC107',
  error: '#DC3545',
  neutral: '#666666',
  background: '#FFFFFF',
  text: '#333333'
} as const;

const DEFAULT_HEIGHT = 300;
const DEFAULT_WIDTH = '100%';

// Accessibility configurations
const ACCESSIBILITY_CONFIG = {
  minContrast: '4.5:1',
  focusOutlineWidth: '2px',
  focusOutlineColor: '#0066CC',
  interactionTimeout: 5000
} as const;

interface AnalyticsChartProps {
  type: ChartType;
  data: ChartData;
  height?: number;
  width?: number | string;
  options?: any;
  accessibilityLabel?: string;
  role?: string;
}

/**
 * Healthcare-optimized analytics chart component with accessibility support
 * and real-time update capabilities.
 */
const AnalyticsChart: React.FC<AnalyticsChartProps> = memo(({
  type,
  data,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  options = {},
  accessibilityLabel = 'Analytics Chart',
  role = 'img'
}) => {
  const chartRef = useRef<ChartJS | null>(null);
  const { loading, error } = useAnalytics();

  // Get appropriate chart component based on type
  const getChartComponent = (chartType: ChartType) => {
    switch (chartType) {
      case 'line':
        return Line;
      case 'bar':
        return Bar;
      case 'pie':
        return Pie;
      default:
        console.warn(`Unsupported chart type: ${chartType}, falling back to Line`);
        return Line;
    }
  };

  // Healthcare-optimized default options
  const getDefaultOptions = (chartType: ChartType) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: CHART_COLORS.text,
          font: {
            family: "'Inter', sans-serif",
            size: 12
          },
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: CHART_COLORS.background,
        titleColor: CHART_COLORS.text,
        titleFont: {
          size: 14,
          weight: 'bold' as const
        },
        bodyColor: CHART_COLORS.text,
        bodyFont: {
          size: 12
        },
        borderColor: CHART_COLORS.neutral,
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            // Format numbers for healthcare metrics
            const value = context.raw;
            if (typeof value === 'number') {
              return new Intl.NumberFormat('en-US', {
                style: 'decimal',
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              }).format(value);
            }
            return context.raw;
          }
        }
      },
      annotation: {
        annotations: {
          // Add threshold lines for healthcare KPIs
          threshold: {
            type: 'line',
            yMin: 90,
            yMax: 90,
            borderColor: CHART_COLORS.warning,
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              content: 'Target Threshold',
              enabled: true
            }
          }
        }
      }
    },
    scales: chartType !== 'pie' ? {
      x: {
        grid: {
          color: `${CHART_COLORS.neutral}33`,
          drawBorder: false
        },
        ticks: {
          color: CHART_COLORS.text,
          font: {
            size: 12
          }
        }
      },
      y: {
        grid: {
          color: `${CHART_COLORS.neutral}33`,
          drawBorder: false
        },
        ticks: {
          color: CHART_COLORS.text,
          font: {
            size: 12
          },
          callback: (value: number) => {
            // Format Y-axis labels for healthcare metrics
            return new Intl.NumberFormat('en-US', {
              style: 'decimal',
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            }).format(value);
          }
        }
      }
    } : undefined
  });

  // Apply healthcare-optimized styling to datasets
  const enhanceDatasets = (chartData: ChartData) => {
    return {
      ...chartData,
      datasets: chartData.datasets.map((dataset, index) => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor || 
          (type === 'pie' ? 
            Object.values(CHART_COLORS).slice(0, chartData.datasets.length) :
            CHART_COLORS.primary),
        borderColor: dataset.borderColor || CHART_COLORS.primary,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: dataset.fill !== undefined ? dataset.fill : false
      }))
    };
  };

  // Handle chart updates
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update();
    }
  }, [data]);

  // Error handling
  if (error) {
    return (
      <div 
        role="alert" 
        aria-label="Chart error"
        style={{ 
          color: CHART_COLORS.error,
          textAlign: 'center',
          padding: '20px'
        }}
      >
        Error loading chart: {error}
      </div>
    );
  }

  // Loading state
  if (loading === 'loading') {
    return (
      <div 
        role="status" 
        aria-label="Loading chart"
        style={{ 
          textAlign: 'center',
          padding: '20px'
        }}
      >
        Loading chart data...
      </div>
    );
  }

  const ChartComponent = getChartComponent(type);
  const enhancedData = enhanceDatasets(data);
  const mergedOptions = {
    ...getDefaultOptions(type),
    ...options
  };

  return (
    <div
      style={{ 
        height, 
        width,
        position: 'relative' 
      }}
      role={role}
      aria-label={accessibilityLabel}
    >
      <ChartComponent
        ref={chartRef}
        data={enhancedData}
        options={mergedOptions}
        plugins={[annotationPlugin]}
      />
    </div>
  );
});

AnalyticsChart.displayName = 'AnalyticsChart';

export default AnalyticsChart;