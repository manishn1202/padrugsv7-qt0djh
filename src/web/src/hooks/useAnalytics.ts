// React/Redux imports - v18.2.0, v8.1.0
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Type imports from internal modules
import { 
  MetricsSummary, 
  ChartData, 
  AnalyticsFilter,
  TimeRange,
  AnalyticsExportConfig,
  RealTimeConfig,
  MetricsComparison
} from '../types/analytics.types';
import { LoadingState, ApiResponse, ErrorResponse } from '../types/common.types';

// WebSocket status type
type WebSocketStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// Cache status type
type CacheStatus = 'valid' | 'stale' | 'updating' | 'error';

// Constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const WS_RETRY_ATTEMPTS = 3;
const WS_RETRY_DELAY = 2000; // 2 seconds

const DEFAULT_FILTER: AnalyticsFilter = {
  timeRange: '30d',
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
  metricType: ['all'],
  userRole: ['all'],
};

/**
 * Custom hook for managing analytics state and operations with real-time updates
 * @param initialFilter - Initial analytics filter configuration
 * @param wsConfig - WebSocket configuration for real-time updates
 * @returns Analytics state and methods
 */
export const useAnalytics = (
  initialFilter: AnalyticsFilter = DEFAULT_FILTER,
  wsConfig?: RealTimeConfig
) => {
  // Redux setup
  const dispatch = useDispatch();
  
  // Local state
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected');
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>('valid');
  
  // Refs for WebSocket and cache management
  const wsRef = useRef<WebSocket | null>(null);
  const cacheTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryAttemptsRef = useRef(0);

  /**
   * Initializes WebSocket connection with retry logic
   */
  const initializeWebSocket = useCallback(() => {
    if (!wsConfig?.enabled) return;

    try {
      setWsStatus('connecting');
      wsRef.current = new WebSocket(process.env.REACT_APP_WS_ANALYTICS_URL!);

      wsRef.current.onopen = () => {
        setWsStatus('connected');
        retryAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateMetrics(data);
      };

      wsRef.current.onerror = () => {
        setWsStatus('error');
        retryWebSocketConnection();
      };

      wsRef.current.onclose = () => {
        setWsStatus('disconnected');
        retryWebSocketConnection();
      };
    } catch (err) {
      setWsStatus('error');
      setError('WebSocket connection failed');
    }
  }, [wsConfig]);

  /**
   * Retries WebSocket connection with exponential backoff
   */
  const retryWebSocketConnection = useCallback(() => {
    if (retryAttemptsRef.current >= WS_RETRY_ATTEMPTS) {
      setError('WebSocket connection failed after maximum retry attempts');
      return;
    }

    setTimeout(() => {
      retryAttemptsRef.current++;
      initializeWebSocket();
    }, WS_RETRY_DELAY * Math.pow(2, retryAttemptsRef.current));
  }, [initializeWebSocket]);

  /**
   * Updates metrics with new data and manages cache
   */
  const updateMetrics = useCallback((newData: MetricsSummary) => {
    setMetrics(newData);
    setCacheStatus('valid');
    
    // Reset cache timer
    if (cacheTimerRef.current) {
      clearTimeout(cacheTimerRef.current);
    }
    
    cacheTimerRef.current = setTimeout(() => {
      setCacheStatus('stale');
    }, CACHE_DURATION);
  }, []);

  /**
   * Fetches analytics data based on current filters
   */
  const fetchAnalytics = useCallback(async (filter: AnalyticsFilter = initialFilter) => {
    try {
      setLoading('loading');
      setError(null);

      const response = await fetch('/api/v1/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filter),
      });

      const data: ApiResponse<{
        metrics: MetricsSummary;
        chartData: ChartData;
      }> = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch analytics');
      }

      setMetrics(data.data.metrics);
      setChartData(data.data.chartData);
      setLoading('succeeded');
      setCacheStatus('valid');

    } catch (err) {
      setLoading('failed');
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCacheStatus('error');
    }
  }, [initialFilter]);

  /**
   * Downloads analytics report with progress tracking
   */
  const downloadReport = useCallback(async (config: AnalyticsExportConfig) => {
    try {
      setLoading('loading');
      
      const response = await fetch('/api/v1/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.fileName || `analytics-report-${new Date().toISOString()}.${config.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setLoading('succeeded');
    } catch (err) {
      setLoading('failed');
      setError(err instanceof Error ? err.message : 'Failed to download report');
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (wsConfig?.enabled) {
      initializeWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (cacheTimerRef.current) {
        clearTimeout(cacheTimerRef.current);
      }
    };
  }, [wsConfig, initializeWebSocket]);

  // Fetch initial data
  useEffect(() => {
    fetchAnalytics(initialFilter);
  }, [fetchAnalytics, initialFilter]);

  return {
    metrics,
    chartData,
    loading,
    error,
    wsStatus,
    cacheStatus,
    fetchAnalytics,
    downloadReport,
  };
};