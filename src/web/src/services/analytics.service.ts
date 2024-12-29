// chart.js version ^4.0.0
// socket.io-client version ^4.7.0
import { Chart, ChartConfiguration } from 'chart.js';
import { Socket, io } from 'socket.io-client';
import { Subject, BehaviorSubject } from 'rxjs';
import { 
  MetricsSummary, 
  ChartData, 
  AnalyticsFilter,
  ChartType,
  MetricsComparison,
  AnalyticsExportConfig,
  RealTimeConfig,
  DrillDownConfig
} from '../types/analytics.types';
import { LoadingState, ApiResponse, ErrorResponse } from '../types/common.types';

// Configuration constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const WEBSOCKET_CONFIG = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  path: '/analytics-ws'
};

const CHART_CONFIG: Partial<ChartConfiguration> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 },
  plugins: {
    legend: { display: true },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  }
};

/**
 * Enhanced Analytics Service for real-time metrics and visualization
 */
export class AnalyticsService {
  private chartInstance: Chart | null = null;
  private cachedMetrics: Map<string, { data: MetricsSummary; timestamp: number }> = new Map();
  private wsConnection: Socket;
  private metricsStream: BehaviorSubject<MetricsSummary | null>;
  private loadingState: BehaviorSubject<LoadingState>;

  constructor() {
    // Initialize WebSocket connection
    this.wsConnection = io(process.env.REACT_APP_WS_URL || 'ws://localhost:3000', WEBSOCKET_CONFIG);
    this.metricsStream = new BehaviorSubject<MetricsSummary | null>(null);
    this.loadingState = new BehaviorSubject<LoadingState>('idle');

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();
  }

  /**
   * Retrieves analytics metrics with real-time updates and comparative analysis
   * @param filter Analytics filter parameters
   * @returns Promise resolving to metrics summary with comparisons
   */
  public async getMetrics(filter: AnalyticsFilter): Promise<ApiResponse<MetricsSummary>> {
    try {
      this.loadingState.next('loading');
      
      // Check cache for recent data
      const cacheKey = this.generateCacheKey(filter);
      const cachedData = this.getCachedData(cacheKey);
      
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          error: null,
          timestamp: new Date().toISOString(),
          metadata: { fromCache: true }
        };
      }

      // Fetch fresh data
      const response = await fetch(`${process.env.REACT_APP_API_URL}/analytics/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filter)
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const metricsData: MetricsSummary = await response.json();
      
      // Cache the new data
      this.cacheData(cacheKey, metricsData);
      
      // Update real-time stream
      this.metricsStream.next(metricsData);
      
      this.loadingState.next('succeeded');
      
      return {
        success: true,
        data: metricsData,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: { fromCache: false }
      };

    } catch (error) {
      this.loadingState.next('failed');
      const errorResponse: ErrorResponse = {
        code: 'ANALYTICS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch analytics metrics',
        details: {},
        timestamp: new Date().toISOString()
      };

      return {
        success: false,
        data: null as unknown as MetricsSummary,
        error: errorResponse,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    }
  }

  /**
   * Retrieves and processes chart data with advanced visualization options
   * @param filter Analytics filter parameters
   * @param chartType Type of chart to generate
   * @returns Promise resolving to formatted chart data
   */
  public async getChartData(filter: AnalyticsFilter, chartType: ChartType): Promise<ApiResponse<ChartData>> {
    try {
      this.loadingState.next('loading');

      const response = await fetch(`${process.env.REACT_APP_API_URL}/analytics/chart-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...filter, chartType })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }

      const chartData: ChartData = await response.json();
      
      // Apply chart configuration
      const enhancedChartData: ChartData = {
        ...chartData,
        options: {
          ...CHART_CONFIG,
          ...chartData.options
        }
      };

      this.loadingState.next('succeeded');
      
      return {
        success: true,
        data: enhancedChartData,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: { chartType }
      };

    } catch (error) {
      this.loadingState.next('failed');
      const errorResponse: ErrorResponse = {
        code: 'CHART_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch chart data',
        details: {},
        timestamp: new Date().toISOString()
      };

      return {
        success: false,
        data: null as unknown as ChartData,
        error: errorResponse,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    }
  }

  /**
   * Generates and downloads analytics reports with progress tracking
   * @param filter Analytics filter parameters
   * @param exportConfig Export configuration options
   * @returns Promise resolving when download is complete
   */
  public async downloadReport(filter: AnalyticsFilter, exportConfig: AnalyticsExportConfig): Promise<ApiResponse<void>> {
    try {
      this.loadingState.next('loading');

      const response = await fetch(`${process.env.REACT_APP_API_URL}/analytics/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filter, exportConfig })
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportConfig.fileName || `analytics-report-${new Date().toISOString()}.${exportConfig.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      this.loadingState.next('succeeded');
      
      return {
        success: true,
        data: undefined,
        error: null,
        timestamp: new Date().toISOString(),
        metadata: { exportConfig }
      };

    } catch (error) {
      this.loadingState.next('failed');
      const errorResponse: ErrorResponse = {
        code: 'EXPORT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to download report',
        details: {},
        timestamp: new Date().toISOString()
      };

      return {
        success: false,
        data: undefined,
        error: errorResponse,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
    }
  }

  /**
   * Sets up WebSocket event handlers for real-time updates
   * @private
   */
  private setupWebSocketHandlers(): void {
    this.wsConnection.on('connect', () => {
      console.log('Connected to analytics websocket');
    });

    this.wsConnection.on('metrics_update', (data: MetricsSummary) => {
      this.metricsStream.next(data);
    });

    this.wsConnection.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.loadingState.next('failed');
    });

    this.wsConnection.on('disconnect', () => {
      console.log('Disconnected from analytics websocket');
    });
  }

  /**
   * Generates a cache key based on filter parameters
   * @private
   */
  private generateCacheKey(filter: AnalyticsFilter): string {
    return JSON.stringify({
      timeRange: filter.timeRange,
      startDate: filter.startDate,
      endDate: filter.endDate,
      userRole: filter.userRole
    });
  }

  /**
   * Retrieves cached data if valid
   * @private
   */
  private getCachedData(key: string): MetricsSummary | null {
    const cached = this.cachedMetrics.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  /**
   * Caches metrics data with timestamp
   * @private
   */
  private cacheData(key: string, data: MetricsSummary): void {
    this.cachedMetrics.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Cleanup method to be called when service is destroyed
   */
  public destroy(): void {
    this.wsConnection.disconnect();
    this.metricsStream.complete();
    this.loadingState.complete();
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }
}