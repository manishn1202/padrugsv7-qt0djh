import type { Config } from '@jest/types';

/**
 * Creates and exports the Jest configuration object with enhanced settings
 * for accessibility and component testing in the Enhanced PA System
 * 
 * @version Jest 29.0.0
 * @returns {Config.InitialOptions} Comprehensive Jest configuration object
 */
const config: Config.InitialOptions = {
  // Use jsdom environment for DOM testing
  testEnvironment: 'jsdom',

  // Setup files for test environment configuration
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Test file discovery patterns
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Module resolution and path mapping
  moduleNameMapper: {
    // Path aliases from tsconfig
    '^@/(.*)$': '<rootDir>/src/$1',
    
    // Asset mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '\\.(mp4|webm|ogg)$': '<rootDir>/tests/__mocks__/mediaMock.js',
    
    // Additional module mocks for UI components
    '^react-markdown$': '<rootDir>/tests/__mocks__/reactMarkdownMock.js',
    '^chart\\.js$': '<rootDir>/tests/__mocks__/chartMock.js'
  },

  // Transform patterns for TypeScript and React
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: {
        warnOnly: true
      }
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: ['@babel/preset-env', '@babel/preset-react']
    }]
  },

  // Coverage collection configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__mocks__/**',
    '!src/**/types/**',
    '!src/assets/**'
  ],

  // Strict coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for critical paths
    './src/components/auth/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/components/forms/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Performance and execution settings
  testTimeout: 10000,
  maxWorkers: '50%',
  
  // Additional configuration
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  errorOnDeprecated: true,
  
  // Watch plugin configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Global settings
  globals: {
    'ts-jest': {
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: [151001]
      }
    }
  },

  // Test environment configuration
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.next/',
    '/coverage/'
  ],

  // Snapshot configuration
  snapshotSerializers: [
    'jest-serializer-html'
  ]
};

export default config;