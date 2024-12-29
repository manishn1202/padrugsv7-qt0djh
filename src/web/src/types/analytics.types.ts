// chart.js version ^4.0.0
import { ChartConfiguration } from 'chart.js';
import { LoadingState } from './common.types';

/**
 * Comprehensive metrics summary interface capturing all key performance indicators
 * for the Enhanced PA System
 */
export interface MetricsSummary {
  /** Average processing time in minutes */
  processingTime: number;
  /** Approval rate as percentage */
  approvalRate: number;
  /** Total request volume */
  requestVolume: number;
  /** Error rate as percentage */
  errorRate: number;
  /** Cost reduction percentage compared to baseline */
  costReduction: number;
  /** User adoption rate as percentage */
  userAdoption: number;
  /** First-pass approval rate as percentage */
  firstPassApproval: number;
  /** Average processing time in minutes */
  averageProcessingTime: number;
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Supported time ranges for analytics filtering
 */
export type TimeRange = 
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | '1y'
  | 'custom';

/**
 * Enhanced analytics filter interface supporting role-based
 * and comparative analysis
 */
export interface AnalyticsFilter {
  /** Selected time range */
  timeRange: TimeRange;
  /** Custom start date for analysis */
  startDate: Date;
  /** Custom end date for analysis */
  endDate: Date;
  /** Comparison period for trend analysis */
  comparisonPeriod?: TimeRange;
  /** Selected metric types for analysis */
  metricType: string[];
  /** User roles for filtered analysis */
  userRole: string[];
  /** Department filters */
  department?: string[];
  /** Status filters */
  status?: string[];
}

/**
 * Supported chart types for analytics visualization
 */
export type ChartType = 
  | 'line'
  | 'bar'
  | 'pie'
  | 'doughnut'
  | 'radar';

/**
 * Chart data structure for visualization components
 */
export interface ChartData {
  /** Chart type */
  type: ChartType;
  /** Chart labels */
  labels: string[];
  /** Dataset configurations */
  datasets: ChartDataset[];
  /** Chart configuration options */
  options?: ChartConfiguration['options'];
}

/**
 * Dataset structure for chart visualization
 */
export interface ChartDataset {
  /** Dataset label */
  label: string;
  /** Data points */
  data: number[];
  /** Background colors */
  backgroundColor?: string | string[];
  /** Border colors */
  borderColor?: string | string[];
  /** Fill configuration */
  fill?: boolean;
  /** Line tension for smooth curves */
  tension?: number;
}

/**
 * Analytics dashboard state interface
 */
export interface AnalyticsDashboardState {
  /** Current metrics summary */
  metrics: MetricsSummary;
  /** Applied filters */
  filters: AnalyticsFilter;
  /** Loading state */
  loadingState: LoadingState;
  /** Chart configurations */
  charts: Record<string, ChartData>;
  /** Error state */
  error?: string;
}

/**
 * Analytics export configuration
 */
export interface AnalyticsExportConfig {
  /** Export format */
  format: 'csv' | 'xlsx' | 'pdf';
  /** Metrics to include */
  includeMetrics: (keyof MetricsSummary)[];
  /** Include charts */
  includeCharts: boolean;
  /** Custom file name */
  fileName?: string;
}

/**
 * Real-time analytics update configuration
 */
export interface RealTimeConfig {
  /** Update interval in seconds */
  refreshInterval: number;
  /** Metrics to update in real-time */
  metrics: (keyof MetricsSummary)[];
  /** Enable/disable real-time updates */
  enabled: boolean;
}

/**
 * Analytics comparison result interface
 */
export interface MetricsComparison {
  /** Current period metrics */
  current: MetricsSummary;
  /** Previous period metrics */
  previous: MetricsSummary;
  /** Percentage changes */
  changes: Record<keyof MetricsSummary, number>;
  /** Comparison period description */
  comparisonPeriod: string;
}

/**
 * Role-based analytics view configuration
 */
export interface RoleBasedAnalytics {
  /** Accessible metrics for role */
  allowedMetrics: (keyof MetricsSummary)[];
  /** Available chart types */
  allowedCharts: ChartType[];
  /** Custom dashboard layouts */
  dashboardLayout: string[];
  /** Export permissions */
  exportPermissions: Partial<AnalyticsExportConfig>;
}

/**
 * Analytics drill-down configuration
 */
export interface DrillDownConfig {
  /** Available dimensions */
  dimensions: string[];
  /** Maximum drill-down levels */
  maxLevels: number;
  /** Current level */
  currentLevel: number;
  /** Selected dimension path */
  path: string[];
}