// @reduxjs/toolkit version ^1.9.7
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  MetricsSummary, 
  ChartData, 
  TimeRange, 
  AnalyticsFilter,
  MetricsComparison,
  RoleBasedAnalytics,
  DrillDownConfig
} from '../../types/analytics.types';
import { LoadingState } from '../../types/common.types';

/**
 * Interface for the analytics state slice
 */
interface AnalyticsState {
  metrics: MetricsSummary | null;
  chartData: Record<string, ChartData>;
  timeRange: TimeRange;
  filters: AnalyticsFilter | null;
  loading: LoadingState;
  error: string | null;
  comparativeAnalysis: MetricsComparison | null;
  roleBasedConfig: RoleBasedAnalytics | null;
  drillDown: DrillDownConfig | null;
  lastUpdated: string | null;
  cacheValidity: number;
  wsConnectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  pendingUpdates: any[];
  batchSize: number;
}

/**
 * Initial state for analytics reducer
 */
const initialState: AnalyticsState = {
  metrics: null,
  chartData: {},
  timeRange: '24h',
  filters: null,
  loading: 'idle',
  error: null,
  comparativeAnalysis: null,
  roleBasedConfig: null,
  drillDown: null,
  lastUpdated: null,
  cacheValidity: 300000, // 5 minutes in milliseconds
  wsConnectionStatus: 'disconnected',
  pendingUpdates: [],
  batchSize: 10
};

/**
 * Analytics reducer slice with enhanced functionality
 */
const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    /**
     * Updates time range and invalidates cache if necessary
     */
    setTimeRange: (state, action: PayloadAction<TimeRange>) => {
      state.timeRange = action.payload;
      state.lastUpdated = null; // Invalidate cache
      state.loading = 'idle';
      state.error = null;
    },

    /**
     * Updates metrics with new data and handles comparative analysis
     */
    updateMetrics: (state, action: PayloadAction<MetricsSummary>) => {
      state.metrics = action.payload;
      state.lastUpdated = new Date().toISOString();
      state.loading = 'succeeded';
    },

    /**
     * Updates chart data with new visualizations
     */
    updateChartData: (state, action: PayloadAction<Record<string, ChartData>>) => {
      state.chartData = {
        ...state.chartData,
        ...action.payload
      };
    },

    /**
     * Sets analytics filters and triggers data refresh
     */
    setFilters: (state, action: PayloadAction<AnalyticsFilter>) => {
      state.filters = action.payload;
      state.lastUpdated = null; // Invalidate cache
      state.loading = 'idle';
    },

    /**
     * Updates comparative analysis data
     */
    setComparativeAnalysis: (state, action: PayloadAction<MetricsComparison>) => {
      state.comparativeAnalysis = action.payload;
    },

    /**
     * Updates role-based analytics configuration
     */
    setRoleBasedConfig: (state, action: PayloadAction<RoleBasedAnalytics>) => {
      state.roleBasedConfig = action.payload;
    },

    /**
     * Updates drill-down configuration and state
     */
    setDrillDown: (state, action: PayloadAction<DrillDownConfig>) => {
      state.drillDown = action.payload;
    },

    /**
     * Handles WebSocket connection status changes
     */
    setWsConnectionStatus: (state, action: PayloadAction<'connected' | 'disconnected' | 'reconnecting'>) => {
      state.wsConnectionStatus = action.payload;
    },

    /**
     * Processes real-time WebSocket updates with batching
     */
    handleWebSocketUpdate: (state, action: PayloadAction<any>) => {
      state.pendingUpdates.push(action.payload);
      
      if (state.pendingUpdates.length >= state.batchSize) {
        // Process batch updates
        const updates = state.pendingUpdates.reduce((acc, update) => {
          // Merge updates based on type
          if (update.type === 'metrics') {
            acc.metrics = { ...acc.metrics, ...update.data };
          } else if (update.type === 'chartData') {
            acc.chartData = { ...acc.chartData, ...update.data };
          }
          return acc;
        }, { metrics: state.metrics, chartData: state.chartData });

        // Apply batched updates
        state.metrics = updates.metrics;
        state.chartData = updates.chartData;
        state.pendingUpdates = [];
        state.lastUpdated = new Date().toISOString();
      }
    },

    /**
     * Sets loading state for async operations
     */
    setLoading: (state, action: PayloadAction<LoadingState>) => {
      state.loading = action.payload;
    },

    /**
     * Sets error state when operations fail
     */
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = 'failed';
    },

    /**
     * Resets analytics state to initial values
     */
    resetState: (state) => {
      return initialState;
    }
  }
});

// Export actions
export const {
  setTimeRange,
  updateMetrics,
  updateChartData,
  setFilters,
  setComparativeAnalysis,
  setRoleBasedConfig,
  setDrillDown,
  setWsConnectionStatus,
  handleWebSocketUpdate,
  setLoading,
  setError,
  resetState
} = analyticsSlice.actions;

// Export reducer
export default analyticsSlice.reducer;

/**
 * Selector to check if cache is valid
 */
export const selectIsCacheValid = (state: { analytics: AnalyticsState }): boolean => {
  if (!state.analytics.lastUpdated) return false;
  
  const lastUpdate = new Date(state.analytics.lastUpdated).getTime();
  const now = new Date().getTime();
  return (now - lastUpdate) < state.analytics.cacheValidity;
};

/**
 * Selector to get filtered metrics based on role
 */
export const selectFilteredMetrics = (state: { analytics: AnalyticsState }) => {
  if (!state.analytics.metrics || !state.analytics.roleBasedConfig) {
    return null;
  }

  const allowedMetrics = state.analytics.roleBasedConfig.allowedMetrics;
  return Object.fromEntries(
    Object.entries(state.analytics.metrics)
      .filter(([key]) => allowedMetrics.includes(key as keyof MetricsSummary))
  );
};