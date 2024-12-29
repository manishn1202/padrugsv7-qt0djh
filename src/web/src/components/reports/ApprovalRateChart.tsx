// React Chart.js v4.0.0, React v18.2.0
import React, { memo, useEffect, useMemo } from 'react';
import { ChartOptions } from 'chart.js';

// Internal imports
import AnalyticsChart from './AnalyticsChart';
import { useAnalytics } from '../../hooks/useAnalytics';
import { ChartData } from '../../types/analytics.types';

// Constants for healthcare-optimized visualization
const TARGET_APPROVAL_RATE = 90; // From technical spec success criteria

const CHART_COLORS = {
  success: '#28A745',
  warning: '#FFC107',
  error: '#DC3545',
  target: '#666666',
  background: '#FFFFFF',
  text: '#333333'
} as const;

// WCAG 2.1 compliant accessibility configuration
const ACCESSIBILITY_CONFIG = {
  announceOnUpdate: true,
  keyboardNavigation: true,
  screenReaderDescriptions: {
    chart: 'Approval rate trend chart showing percentage over time',
    target: `Target approval rate of ${TARGET_APPROVAL_RATE} percent`,
    current: 'Current approval rate is {value} percent'
  }
} as const;

interface ApprovalRateChartProps {
  height?: number;
  width?: number;
  role?: string;
  timeRange?: string;
  exportable?: boolean;
}

/**
 * Healthcare-optimized approval rate chart component with enhanced accessibility
 * and real-time update capabilities.
 * 
 * @param props - Component properties
 * @returns JSX.Element - Rendered chart component
 */
const ApprovalRateChart: React.FC<ApprovalRateChartProps> = memo(({
  height = 300,
  width,
  role = 'Healthcare Provider',
  timeRange = '30d',
  exportable = false
}) => {
  // Initialize analytics hook with real-time updates
  const { metrics, chartData, loading, error, wsStatus } = useAnalytics({
    timeRange,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    metricType: ['approvalRate'],
    userRole: [role]
  });

  // Healthcare-optimized chart options with WCAG compliance
  const chartOptions: ChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      annotation: {
        annotations: {
          targetLine: {
            type: 'line',
            yMin: TARGET_APPROVAL_RATE,
            yMax: TARGET_APPROVAL_RATE,
            borderColor: CHART_COLORS.target,
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              content: ACCESSIBILITY_CONFIG.screenReaderDescriptions.target,
              enabled: true,
              position: 'end'
            }
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: CHART_COLORS.background,
        titleColor: CHART_COLORS.text,
        bodyColor: CHART_COLORS.text,
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            return `Approval Rate: ${value.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (value: number) => `${value}%`,
          color: CHART_COLORS.text,
          font: {
            size: 12
          }
        },
        grid: {
          color: `${CHART_COLORS.text}22`
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: CHART_COLORS.text,
          font: {
            size: 12
          }
        }
      }
    }
  }), []);

  // Prepare chart data with healthcare-optimized styling
  const enhancedChartData: ChartData = useMemo(() => ({
    type: 'line',
    labels: chartData?.labels || [],
    datasets: [{
      label: 'Approval Rate',
      data: chartData?.datasets[0]?.data || [],
      backgroundColor: CHART_COLORS.success + '33',
      borderColor: CHART_COLORS.success,
      fill: true,
      tension: 0.4
    }]
  }), [chartData]);

  // Announce significant changes to screen readers
  useEffect(() => {
    if (ACCESSIBILITY_CONFIG.announceOnUpdate && metrics?.approvalRate) {
      const announcement = ACCESSIBILITY_CONFIG.screenReaderDescriptions.current
        .replace('{value}', metrics.approvalRate.toFixed(1));
      
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.textContent = announcement;
      document.body.appendChild(ariaLive);
      
      setTimeout(() => {
        document.body.removeChild(ariaLive);
      }, 1000);
    }
  }, [metrics?.approvalRate]);

  return (
    <div
      role="region"
      aria-label={ACCESSIBILITY_CONFIG.screenReaderDescriptions.chart}
      style={{ height, width: width || '100%' }}
    >
      <AnalyticsChart
        type="line"
        data={enhancedChartData}
        options={chartOptions}
        height={height}
        width={width}
        accessibilityLabel={ACCESSIBILITY_CONFIG.screenReaderDescriptions.chart}
        role={role}
      />
      
      {/* Real-time connection status indicator */}
      {wsStatus === 'connected' && (
        <div 
          role="status" 
          aria-live="polite"
          style={{ 
            position: 'absolute', 
            top: 8, 
            right: 8,
            fontSize: '12px',
            color: CHART_COLORS.success 
          }}
        >
          ● Live
        </div>
      )}
    </div>
  );
});

ApprovalRateChart.displayName = 'ApprovalRateChart';

export default ApprovalRateChart;