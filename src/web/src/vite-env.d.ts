/// <reference types="vite/client" version="^4.4.0" />

// Global constants injected by Vite at build time
declare const __APP_VERSION__: string;
declare const __API_URL__: string;
declare const __BUILD_TIME__: string;
declare const __ENV__: 'development' | 'production' | 'test';

/**
 * Type augmentation for Vite's ImportMeta.env to include custom environment variables
 * used throughout the Enhanced Prior Authorization System
 */
interface ImportMetaEnv {
  /**
   * Base URL for API endpoints
   * @example 'https://api.epa-system.com/v1'
   */
  readonly VITE_API_URL: string;

  /**
   * Auth0 domain for authentication
   * @example 'epa-system.us.auth0.com'
   */
  readonly VITE_AUTH0_DOMAIN: string;

  /**
   * Auth0 client ID for application authentication
   * @example 'abcdef123456'
   */
  readonly VITE_AUTH0_CLIENT_ID: string;

  /**
   * Auth0 API audience identifier
   * @example 'https://api.epa-system.com'
   */
  readonly VITE_AUTH0_AUDIENCE: string;

  /**
   * Application name used in UI elements
   * @example 'Enhanced Prior Authorization System'
   */
  readonly VITE_APP_NAME: string;

  /**
   * API request timeout in milliseconds
   * @example 30000
   */
  readonly VITE_API_TIMEOUT: number;

  /**
   * Feature flag for analytics tracking
   * @example true
   */
  readonly VITE_ENABLE_ANALYTICS: boolean;
}

/**
 * Type augmentation for Vite's ImportMeta to include our environment variables
 * This ensures type safety when accessing import.meta.env throughout the application
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}