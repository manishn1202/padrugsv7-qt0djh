// External imports with versions
import '@testing-library/jest-dom/extend-expect'; // v5.16.5
import { configure } from '@testing-library/react'; // v13.4.0
import type { Config } from '@testing-library/jest-dom'; // v5.16.5

/**
 * Configure custom Jest DOM matchers and testing library settings
 * Implements comprehensive testing environment for Enhanced PA System
 */
function setupJestDom(): void {
  // Configure Testing Library
  configure({
    testIdAttribute: 'data-testid',
    asyncUtilTimeout: 5000,
    computedStyleSupportsPseudoElements: true,
    defaultHidden: true,
  });

  // Configure custom error boundary testing utilities
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalError.call(console, ...args);
  };
}

/**
 * Configure all required global mocks for testing environment
 * Implements browser API mocks and storage utilities
 */
function setupGlobalMocks(): void {
  // Mock window.matchMedia for responsive design testing
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  // Mock ResizeObserver for component size monitoring
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock IntersectionObserver for visibility tracking
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock global fetch for API testing
  global.fetch = jest.fn().mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  );

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });

  // Mock performance timing API
  window.performance = {
    ...window.performance,
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(),
    getEntriesByName: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  };
}

/**
 * Configure JSDOM test environment settings and global utilities
 * Implements accessibility testing and browser compatibility support
 */
function setupTestEnvironment(): void {
  // Set testing viewport dimensions
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: 1920,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: 1080,
  });

  // Configure JSDOM environment
  document.documentElement.setAttribute('lang', 'en');
  
  // Setup custom error handlers
  window.onerror = jest.fn();
  window.onunhandledrejection = jest.fn();

  // Configure accessibility testing utilities
  const axeConfig = {
    rules: {
      'color-contrast': { enabled: true },
      'frame-title': { enabled: false },
    },
  };
  
  // @ts-ignore - Global axe configuration
  global.axe = {
    configure: jest.fn().mockImplementation(() => axeConfig),
    run: jest.fn().mockResolvedValue({ violations: [] }),
  };
}

// Initialize all test environment configurations
setupJestDom();
setupGlobalMocks();
setupTestEnvironment();

// Configure Jest specific settings
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Export testing configuration for Jest
export const jestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  errorOnDeprecated: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
} as const;