// @reduxjs/toolkit version ^1.9.0
import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppDispatch } from '@reduxjs/toolkit';
import { 
  MetricsSummary, 
  ChartData, 
  AnalyticsFilter,
  ChartType,
  MetricsComparison,
  RealTimeConfig
} from '../../types/analytics.types';
import AnalyticsService from '../../services/analytics.service';

// Constants for rate limiting and caching
const CACHE_DURATION = 300000; // 5 minutes
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// Initialize analytics service
const analyticsService = new AnalyticsService();

// Cache for storing metrics data
const metricsCache = new Map<string, { data: MetricsSummary; timestamp: number }>();

/**
 * Helper function to generate cache key from filter
 */
const generateCacheKey = (filter: AnalyticsFilter): string => {
  return JSON.stringify({
    timeRange: filter.timeRange,
    startDate: filter.startDate,
    endDate: filter.endDate,
    userRole: filter.userRole,
    metricType: filter.metricType
  });
};

/**
 * Helper function to check if cached data is valid
 */
const isValidCache = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

/**
 * Fetches analytics metrics summary with real-time updates and comparative analysis
 */
export const fetchMetricsSummary = createAsyncThunk<
  MetricsSummary,
  { filter: AnalyticsFilter; enableRealTime?: boolean },
  { dispatch: AppDispatch }
>(
  'analytics/fetchMetrics',
  async ({ filter, enableRealTime = false }, { rejectWithValue }) => {
    try {
      // Check cache first
      const cacheKey = generateCacheKey(filter);
      const cachedData = metricsCache.get(cacheKey);

      if (cachedData && isValidCache(cachedData.timestamp)) {
        return cachedData.data;
      }

      // Fetch fresh data
      const response = await analyticsService.getMetrics(filter);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch metrics');
      }

      // Cache the new data
      metricsCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      // Set up real-time updates if enabled
      if (enableRealTime) {
        analyticsService.wsConnection?.on('metrics_update', (updatedData: MetricsSummary) => {
          // Dispatch an action to update the metrics in real-time
          // This will be handled by the reducer
          dispatch(updateMetricsRealTime(updatedData));
        });
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'An error occurred');
    }
  }
);

/**
 * Fetches chart data with comparative visualization support
 */
export const fetchChartData = createAsyncThunk<
  ChartData,
  { filter: AnalyticsFilter; chartType: ChartType; config?: Partial<ChartData> },
  { dispatch: AppDispatch }
>(
  'analytics/fetchChartData',
  async ({ filter, chartType, config }, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getChartData(filter, chartType);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch chart data');
      }

      // Merge custom configuration if provided
      const enhancedChartData: ChartData = {
        ...response.data,
        ...(config || {}),
        datasets: response.data.datasets.map(dataset => ({
          ...dataset,
          borderWidth: 2,
          tension: 0.4 // Smooth line charts
        }))
      };

      return enhancedChartData;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'An error occurred');
    }
  }
);

/**
 * Downloads analytics report with specified configuration
 */
export const downloadAnalyticsReport = createAsyncThunk<
  void,
  { filter: AnalyticsFilter; format: 'csv' | 'xlsx' | 'pdf'; fileName?: string },
  { dispatch: AppDispatch }
>(
  'analytics/downloadReport',
  async ({ filter, format, fileName }, { rejectWithValue }) => {
    try {
      const response = await analyticsService.downloadReport(filter, {
        format,
        fileName,
        includeMetrics: ['processingTime', 'approvalRate', 'requestVolume', 'errorRate'],
        includeCharts: true
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to download report');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'An error occurred');
    }
  }
);

/**
 * Updates real-time metrics in the store
 */
export const updateMetricsRealTime = createAsyncThunk<
  MetricsSummary,
  MetricsSummary,
  { dispatch: AppDispatch }
>(
  'analytics/updateRealTime',
  async (metrics, { rejectWithValue }) => {
    try {
      return metrics;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'An error occurred');
    }
  }
);

/**
 * Configures real-time updates for analytics
 */
export const configureRealTimeUpdates = createAsyncThunk<
  void,
  RealTimeConfig,
  { dispatch: AppDispatch }
>(
  'analytics/configureRealTime',
  async (config, { rejectWithValue }) => {
    try {
      if (config.enabled) {
        analyticsService.wsConnection?.connect();
      } else {
        analyticsService.wsConnection?.disconnect();
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'An error occurred');
    }
  }
);

/**
 * Cleanup function to be called when unmounting
 */
export const cleanupAnalytics = createAsyncThunk(
  'analytics/cleanup',
  async (_, { rejectWithValue }) => {
    try {
      analyticsService.destroy();
      metricsCache.clear();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'An error occurred');
    }
  }
);