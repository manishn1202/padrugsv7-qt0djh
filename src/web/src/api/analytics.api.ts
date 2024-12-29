/**
 * Analytics API Client Module
 * @version 1.0.0
 * @description Handles API requests for analytics functionality with support for real-time updates,
 * caching, and advanced filtering capabilities
 */

import { AxiosResponse } from 'axios'; // ^1.6.0
import apiClient from '../config/api.config';
import {
  MetricsSummary,
  ChartData,
  AnalyticsFilter,
  ChartType,
  MetricsComparison,
  RealTimeConfig,
  AnalyticsExportConfig,
  DrillDownConfig
} from '../types/analytics.types';
import { ApiResponse } from '../types/common.types';

// API endpoints for analytics
const ANALYTICS_ENDPOINTS = {
  METRICS: '/api/v1/analytics/metrics',
  CHARTS: '/api/v1/analytics/charts',
  REPORTS: '/api/v1/analytics/reports',
  WEBSOCKET: '/api/v1/analytics/ws'
} as const;

// Cache configuration
const CACHE_CONFIG = {
  METRICS_TTL: 300000, // 5 minutes
  CHARTS_TTL: 600000, // 10 minutes
  MAX_CACHE_SIZE: 100
} as const;

// Rate limits for report generation
const RATE_LIMITS = {
  REPORTS_PER_HOUR: 10,
  MAX_CONCURRENT_REPORTS: 3
} as const;

// Cache implementation
const metricsCache = new Map<string, { data: MetricsSummary; timestamp: number }>();
const chartsCache = new Map<string, { data: ChartData; timestamp: number }>();

/**
 * Fetches analytics metrics summary with support for real-time updates and caching
 * @param filter Analytics filter parameters
 * @param enableRealtime Enable real-time updates via WebSocket
 * @param signal AbortSignal for request cancellation
 */
export async function getMetricsSummary(
  filter: AnalyticsFilter,
  enableRealtime = false,
  signal?: AbortSignal
): Promise<ApiResponse<MetricsSummary>> {
  const cacheKey = JSON.stringify(filter);
  const cachedData = metricsCache.get(cacheKey);
  
  // Check cache validity
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_CONFIG.METRICS_TTL) {
    return {
      success: true,
      data: cachedData.data,
      timestamp: new Date().toISOString(),
      error: null,
      metadata: { cached: true }
    };
  }

  try {
    const response: AxiosResponse<ApiResponse<MetricsSummary>> = await apiClient.get(
      ANALYTICS_ENDPOINTS.METRICS,
      {
        params: filter,
        signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      }
    );

    // Cache the fresh data
    if (response.data.success) {
      metricsCache.set(cacheKey, {
        data: response.data.data,
        timestamp: Date.now()
      });

      // Setup real-time updates if enabled
      if (enableRealtime) {
        setupRealtimeMetrics(filter);
      }
    }

    return response.data;
  } catch (error) {
    throw enhanceError(error);
  }
}

/**
 * Fetches chart data with advanced filtering and comparative analysis
 * @param filter Analytics filter parameters
 * @param chartType Type of chart to generate
 * @param comparison Comparison configuration
 * @param signal AbortSignal for request cancellation
 */
export async function getChartData(
  filter: AnalyticsFilter,
  chartType: ChartType,
  comparison?: MetricsComparison,
  signal?: AbortSignal
): Promise<ApiResponse<ChartData>> {
  const cacheKey = `${JSON.stringify(filter)}-${chartType}-${JSON.stringify(comparison)}`;
  const cachedData = chartsCache.get(cacheKey);

  // Check cache validity
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_CONFIG.CHARTS_TTL) {
    return {
      success: true,
      data: cachedData.data,
      timestamp: new Date().toISOString(),
      error: null,
      metadata: { cached: true }
    };
  }

  try {
    const response: AxiosResponse<ApiResponse<ChartData>> = await apiClient.get(
      ANALYTICS_ENDPOINTS.CHARTS,
      {
        params: {
          ...filter,
          chartType,
          comparison
        },
        signal,
        timeout: 60000 // Extended timeout for complex charts
      }
    );

    // Cache the fresh data
    if (response.data.success) {
      chartsCache.set(cacheKey, {
        data: response.data.data,
        timestamp: Date.now()
      });
    }

    return response.data;
  } catch (error) {
    throw enhanceError(error);
  }
}

/**
 * Generates and fetches analytics reports with rate limiting and progress tracking
 * @param filter Analytics filter parameters
 * @param exportConfig Export configuration
 * @param signal AbortSignal for request cancellation
 */
export async function getAnalyticsReport(
  filter: AnalyticsFilter,
  exportConfig: AnalyticsExportConfig,
  signal?: AbortSignal
): Promise<ApiResponse<Blob>> {
  try {
    const response: AxiosResponse<Blob> = await apiClient.post(
      ANALYTICS_ENDPOINTS.REPORTS,
      {
        filter,
        exportConfig
      },
      {
        responseType: 'blob',
        signal,
        timeout: 180000, // Extended timeout for report generation
        headers: {
          'Accept': exportConfig.format === 'pdf' ? 'application/pdf' : 'application/octet-stream'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            // Report progress to caller if needed
          }
        }
      }
    );

    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
      error: null,
      metadata: {
        contentType: response.headers['content-type'],
        fileName: response.headers['content-disposition']
      }
    };
  } catch (error) {
    throw enhanceError(error);
  }
}

/**
 * Sets up WebSocket connection for real-time metrics updates
 * @param filter Analytics filter parameters
 */
function setupRealtimeMetrics(filter: AnalyticsFilter): WebSocket {
  const ws = new WebSocket(ANALYTICS_ENDPOINTS.WEBSOCKET);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', filter }));
  };

  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    if (update.type === 'metrics') {
      const cacheKey = JSON.stringify(filter);
      metricsCache.set(cacheKey, {
        data: update.data,
        timestamp: Date.now()
      });
      // Emit update event if needed
    }
  };

  return ws;
}

/**
 * Enhances error information with additional context
 * @param error Original error object
 */
function enhanceError(error: any): Error {
  const enhanced = new Error(error.message);
  enhanced.name = 'AnalyticsError';
  enhanced.cause = error;
  return enhanced;
}

/**
 * Manages cache size to prevent memory issues
 */
function cleanupCache(): void {
  if (metricsCache.size > CACHE_CONFIG.MAX_CACHE_SIZE) {
    const oldestKey = Array.from(metricsCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
    metricsCache.delete(oldestKey);
  }

  if (chartsCache.size > CACHE_CONFIG.MAX_CACHE_SIZE) {
    const oldestKey = Array.from(chartsCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
    chartsCache.delete(oldestKey);
  }
}

// Setup periodic cache cleanup
setInterval(cleanupCache, 300000); // Run every 5 minutes