import type { Config } from '@jest/types';

/**
 * Root Jest configuration for Enhanced Prior Authorization System backend services
 * Version: Jest 29.x
 * 
 * This configuration provides:
 * - TypeScript support with ts-jest
 * - Distributed test execution for microservices
 * - Strict coverage requirements (80% threshold)
 * - Shared module resolution
 * - Comprehensive test environment setup
 */
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Node environment for backend services
  testEnvironment: 'node',

  // Test roots for all microservices
  roots: [
    '<rootDir>/api-gateway/test',
    '<rootDir>/auth-service/test',
    '<rootDir>/document-service/tests',
    '<rootDir>/workflow-service/src/test',
    '<rootDir>/ai-service/tests',
    '<rootDir>/integration-service/src/test'
  ],

  // Test pattern matching for TypeScript test files
  testMatch: ['**/?(*.)+(spec|test).ts'],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Module path aliases for shared resources
  moduleNameMapper: {
    '@shared/(.*)': '<rootDir>/shared/$1',
    '@proto/(.*)': '<rootDir>/shared/proto/$1',
    '@schemas/(.*)': '<rootDir>/shared/schemas/$1'
  },

  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    '**/src/**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.d.ts'
  ],

  // Strict coverage thresholds (80% requirement)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test setup and execution configuration
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 30000,
  maxWorkers: '50%',
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,

  // File extensions to consider
  moduleFileExtensions: ['ts', 'js', 'json'],

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
};

export default config;