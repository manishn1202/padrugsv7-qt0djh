/**
 * @fileoverview Comprehensive test suite for RequestService with performance benchmarks
 * @version 1.0.0
 * @license MIT
 */

import { jest, describe, beforeAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { RequestService } from '../../src/services/request.service';
import { AuthorizationRequest, AuthorizationStatus } from '../../src/types/request.types';
import { RequestValidationUtils } from '../../src/utils/validation.utils';
import { LoadingState } from '../../src/types/common.types';

// Performance monitoring utilities
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  getAverageMetric(operation: string): number {
    const metrics = this.metrics.get(operation) || [];
    return metrics.length > 0 
      ? metrics.reduce((a, b) => a + b) / metrics.length 
      : 0;
  }

  reset(): void {
    this.metrics.clear();
  }
}

// Test constants
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD = 1000; // 1 second
const BATCH_SIZE = 50;
const CONCURRENT_REQUESTS = 10;

// Mock implementations
const mockValidationUtils = {
  validateRequest: jest.fn(),
  sanitizeRequest: jest.fn(request => request)
} as unknown as RequestValidationUtils;

const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn()
};

// Global test state
let requestService: RequestService;
let performanceMetrics: PerformanceMonitor;

// Helper functions
const generateMockRequest = (): AuthorizationRequest => ({
  authorization_id: faker.string.uuid(),
  status: AuthorizationStatus.DRAFT,
  metadata: {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: faker.string.uuid()
  }
});

const simulateNetworkDelay = async (min = 50, max = 200): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, faker.number.int({ min, max })));
};

describe('RequestService', () => {
  beforeAll(() => {
    performanceMetrics = new PerformanceMonitor();
  });

  beforeEach(() => {
    requestService = new RequestService(mockValidationUtils);
    // Reset mocks
    jest.clearAllMocks();
    performanceMetrics.reset();
  });

  describe('createRequest', () => {
    it('should successfully create a request with valid data', async () => {
      const mockRequest = generateMockRequest();
      mockValidationUtils.validateRequest.mockResolvedValue({ isValid: true, errors: [] });
      mockAxios.post.mockResolvedValue({ data: { data: mockRequest } });

      const startTime = Date.now();
      const result = await requestService.createRequest(mockRequest);
      const duration = Date.now() - startTime;

      expect(result).toEqual(mockRequest);
      expect(mockValidationUtils.validateRequest).toHaveBeenCalledWith(mockRequest);
      performanceMetrics.recordMetric('createRequest', duration);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should handle validation errors appropriately', async () => {
      const mockRequest = generateMockRequest();
      const validationError = 'Invalid request data';
      mockValidationUtils.validateRequest.mockResolvedValue({ 
        isValid: false, 
        errors: [validationError] 
      });

      await expect(requestService.createRequest(mockRequest))
        .rejects
        .toThrow(`Validation failed: ${validationError}`);
    });

    it('should handle concurrent request creation efficiently', async () => {
      const requests = Array.from({ length: CONCURRENT_REQUESTS }, generateMockRequest);
      mockValidationUtils.validateRequest.mockResolvedValue({ isValid: true, errors: [] });
      mockAxios.post.mockImplementation(async () => {
        await simulateNetworkDelay();
        return { data: { data: generateMockRequest() } };
      });

      const startTime = Date.now();
      await Promise.all(requests.map(request => requestService.createRequest(request)));
      const duration = Date.now() - startTime;

      const averageTime = duration / CONCURRENT_REQUESTS;
      performanceMetrics.recordMetric('concurrentCreation', averageTime);
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD);
    });
  });

  describe('getRequestDetails', () => {
    it('should retrieve cached request details when available', async () => {
      const mockRequest = generateMockRequest();
      mockAxios.get.mockResolvedValue({ data: { data: mockRequest } });

      // First call to populate cache
      await requestService.getRequestDetails(mockRequest.authorization_id);
      
      const startTime = Date.now();
      const result = await requestService.getRequestDetails(mockRequest.authorization_id);
      const duration = Date.now() - startTime;

      expect(result).toEqual(mockRequest);
      expect(duration).toBeLessThan(100); // Cache access should be very fast
      performanceMetrics.recordMetric('cachedRetrieval', duration);
    });

    it('should handle request detail retrieval errors', async () => {
      const mockError = new Error('Network error');
      mockAxios.get.mockRejectedValue(mockError);

      await expect(requestService.getRequestDetails(faker.string.uuid()))
        .rejects
        .toThrow(mockError);
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status with optimistic updates', async () => {
      const mockRequest = generateMockRequest();
      const newStatus = AuthorizationStatus.APPROVED;
      
      mockAxios.get.mockResolvedValue({ data: { data: mockRequest } });
      mockAxios.patch.mockResolvedValue({ 
        data: { 
          data: { ...mockRequest, status: newStatus } 
        } 
      });

      const startTime = Date.now();
      const result = await requestService.updateRequestStatus(
        mockRequest.authorization_id, 
        newStatus
      );
      const duration = Date.now() - startTime;

      expect(result.status).toBe(newStatus);
      performanceMetrics.recordMetric('statusUpdate', duration);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should handle status update conflicts', async () => {
      const mockRequest = generateMockRequest();
      mockAxios.get.mockResolvedValue({ data: { data: mockRequest } });
      mockAxios.patch.mockRejectedValue(new Error('Conflict'));

      await expect(requestService.updateRequestStatus(
        mockRequest.authorization_id,
        AuthorizationStatus.APPROVED
      )).rejects.toThrow('Conflict');
    });
  });

  describe('searchRequests', () => {
    it('should efficiently handle search requests with debouncing', async () => {
      const mockResults = Array.from({ length: 10 }, generateMockRequest);
      mockAxios.get.mockResolvedValue({ data: { data: mockResults } });

      const searchParams = { status: AuthorizationStatus.PENDING_DOCUMENTS };
      const startTime = Date.now();
      const result = await requestService.searchRequests(searchParams);
      const duration = Date.now() - startTime;

      expect(result).toEqual(mockResults);
      performanceMetrics.recordMetric('search', duration);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });
  });

  describe('batchUpdateRequests', () => {
    it('should efficiently process batch updates within performance thresholds', async () => {
      const requests = Array.from({ length: BATCH_SIZE }, () => ({
        ...generateMockRequest(),
        status: AuthorizationStatus.APPROVED
      }));

      mockAxios.get.mockImplementation(async () => {
        await simulateNetworkDelay(10, 50);
        return { data: { data: generateMockRequest() } };
      });

      mockAxios.patch.mockImplementation(async () => {
        await simulateNetworkDelay(10, 50);
        return { data: { data: generateMockRequest() } };
      });

      const startTime = Date.now();
      const results = await requestService.batchUpdateRequests(requests);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(requests.length);
      const averageTime = duration / requests.length;
      performanceMetrics.recordMetric('batchUpdate', averageTime);
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD / BATCH_SIZE);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance criteria for all operations', () => {
      const metrics = [
        'createRequest',
        'concurrentCreation',
        'cachedRetrieval',
        'statusUpdate',
        'search',
        'batchUpdate'
      ];

      metrics.forEach(metric => {
        const average = performanceMetrics.getAverageMetric(metric);
        expect(average).toBeLessThan(PERFORMANCE_THRESHOLD);
      });
    });
  });
});