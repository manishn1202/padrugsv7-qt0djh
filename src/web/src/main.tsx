/**
 * @fileoverview Entry point for the Enhanced Prior Authorization System web application
 * @version 1.0.0
 * @package react ^18.2.0
 * @package react-dom ^18.2.0
 * @package react-redux ^8.1.3
 * @package @mui/material ^5.14.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import App from './App';
import store from './store';
import { theme } from './assets/styles/theme';

// Browser requirements based on technical specifications
const BROWSER_REQUIREMENTS = {
  chrome: 90,
  firefox: 85,
  safari: 14,
  edge: 90
} as const;

/**
 * Validates current browser version against minimum requirements
 * @returns boolean indicating if browser is supported
 */
const checkBrowserCompatibility = (): boolean => {
  const ua = navigator.userAgent;
  let browserVersion = 0;

  // Check Chrome
  if (ua.includes('Chrome/')) {
    browserVersion = parseInt(ua.split('Chrome/')[1]);
    return browserVersion >= BROWSER_REQUIREMENTS.chrome;
  }
  // Check Firefox
  if (ua.includes('Firefox/')) {
    browserVersion = parseInt(ua.split('Firefox/')[1]);
    return browserVersion >= BROWSER_REQUIREMENTS.firefox;
  }
  // Check Safari
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browserVersion = parseInt(ua.split('Version/')[1]);
    return browserVersion >= BROWSER_REQUIREMENTS.safari;
  }
  // Check Edge
  if (ua.includes('Edg/')) {
    browserVersion = parseInt(ua.split('Edg/')[1]);
    return browserVersion >= BROWSER_REQUIREMENTS.edge;
  }

  return false;
};

/**
 * Initializes performance and error monitoring
 */
const initializeMonitoring = (): void => {
  // Performance monitoring
  if ('performance' in window && 'measure' in window.performance) {
    performance.mark('app-init-start');
  }

  // Error monitoring
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Here you would typically send to your error monitoring service
  });

  // Unhandled promise rejection monitoring
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Here you would typically send to your error monitoring service
  });
};

/**
 * Renders the application with all required providers and error boundaries
 */
const renderApp = (): void => {
  // Check browser compatibility
  if (!checkBrowserCompatibility()) {
    console.warn('Unsupported browser version detected');
  }

  // Initialize monitoring
  initializeMonitoring();

  // Get root element
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create React root
  const root = ReactDOM.createRoot(rootElement);

  // Render application with providers and error boundary
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        fallback={
          <div>
            An error occurred while loading the application. Please refresh the page.
          </div>
        }
        onError={(error, errorInfo) => {
          console.error('Application error:', error, errorInfo);
          // Here you would typically send to your error monitoring service
        }}
      >
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <App />
          </ThemeProvider>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Mark application render complete
  if ('performance' in window && 'measure' in window.performance) {
    performance.mark('app-init-end');
    performance.measure('app-initialization', 'app-init-start', 'app-init-end');
  }
};

// Initialize application
renderApp();

// Enable hot module replacement in development
if (import.meta.hot) {
  import.meta.hot.accept();
}