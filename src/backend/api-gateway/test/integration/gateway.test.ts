// External imports with versions
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.0
import nock from 'nock'; // ^13.3.0
import jwt from 'jsonwebtoken'; // ^9.0.0

// Internal imports
import app from '../../src/index';
import { validateJwt } from '../../src/middleware/auth.middleware';
import { rateLimitMiddleware } from '../../src/middleware/ratelimit.middleware';

// Test constants
const TEST_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w...
-----END PUBLIC KEY-----`;

// Test configuration
const TEST_CONFIG = {
  auth0: {
    domain: 'https://test-auth.healthcare.com',
    audience: 'https://api.healthcare.com',
    jwksEndpoint: '/.well-known/jwks.json'
  },
  endpoints: {
    workflow: '/api/v1/authorizations',
    documents: '/api/v1/documents',
    health: '/health'
  },
  rateLimits: {
    default: 1000,
    documents: 200,
    window: 60
  }
};

// Helper function to generate test tokens
const generateTestToken = (payload: {
  sub: string;
  roles: string[];
  permissions: string[];
  organizationId: string;
  hipaaCompliant: boolean;
}): string => {
  const now = Math.floor(Date.now() / 1000);
  
  return jwt.sign(
    {
      ...payload,
      iss: TEST_CONFIG.auth0.domain,
      aud: TEST_CONFIG.auth0.audience,
      iat: now,
      exp: now + 3600,
      jti: Math.random().toString(36).substring(7)
    },
    TEST_PRIVATE_KEY,
    { algorithm: 'RS256' }
  );
};

// Test server setup
const setupTestServer = () => {
  const server = supertest(app);

  // Mock Auth0 JWKS endpoint
  nock(TEST_CONFIG.auth0.domain)
    .persist()
    .get(TEST_CONFIG.auth0.jwksEndpoint)
    .reply(200, {
      keys: [{
        kid: 'test-key',
        kty: 'RSA',
        n: TEST_PUBLIC_KEY,
        e: 'AQAB'
      }]
    });

  return server;
};

describe('API Gateway Integration Tests', () => {
  let server: supertest.SuperTest<supertest.Test>;
  let validToken: string;

  beforeAll(() => {
    server = setupTestServer();
    validToken = generateTestToken({
      sub: 'test-user',
      roles: ['healthcare_provider'],
      permissions: ['read:authorizations', 'write:authorizations'],
      organizationId: 'test-org',
      hipaaCompliant: true
    });
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe('Authentication Tests', () => {
    test('should reject requests without JWT token', async () => {
      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Authentication failed');
      expect(response.headers).toHaveProperty('x-request-id');
    });

    test('should validate HIPAA-compliant claims in JWT', async () => {
      const nonCompliantToken = generateTestToken({
        sub: 'test-user',
        roles: ['healthcare_provider'],
        permissions: [],
        organizationId: 'test-org',
        hipaaCompliant: false
      });

      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', `Bearer ${nonCompliantToken}`)
        .expect(401);

      expect(response.body.error).toContain('HIPAA compliance required');
    });

    test('should enforce role-based access control', async () => {
      const invalidRoleToken = generateTestToken({
        sub: 'test-user',
        roles: ['invalid_role'],
        permissions: [],
        organizationId: 'test-org',
        hipaaCompliant: true
      });

      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', `Bearer ${invalidRoleToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should enforce rate limits per organization', async () => {
      const requests = Array(TEST_CONFIG.rateLimits.default + 1)
        .fill(null)
        .map(() => 
          server
            .get(TEST_CONFIG.endpoints.workflow)
            .set('Authorization', `Bearer ${validToken}`)
        );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses[responses.length - 1];

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
    });

    test('should track rate limit headers', async () => {
      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    test('should maintain separate limits for different endpoints', async () => {
      const workflowResponse = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const documentsResponse = await server
        .get(TEST_CONFIG.endpoints.documents)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(workflowResponse.headers['x-ratelimit-limit'])
        .toBe(TEST_CONFIG.rateLimits.default.toString());
      expect(documentsResponse.headers['x-ratelimit-limit'])
        .toBe(TEST_CONFIG.rateLimits.documents.toString());
    });
  });

  describe('Service Routing Tests', () => {
    test('should maintain security context across service calls', async () => {
      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).toHaveProperty('x-b3-traceid');
    });

    test('should implement circuit breaking', async () => {
      // Mock service failure
      nock(TEST_CONFIG.auth0.domain)
        .get(TEST_CONFIG.endpoints.workflow)
        .times(5)
        .reply(500);

      const responses = await Promise.all(
        Array(6).fill(null).map(() =>
          server
            .get(TEST_CONFIG.endpoints.workflow)
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      expect(responses[5].status).toBe(503);
      expect(responses[5].body.error).toContain('Service temporarily unavailable');
    });

    test('should propagate security headers', async () => {
      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });
  });

  describe('Error Handling Tests', () => {
    test('should sanitize error messages', async () => {
      const response = await server
        .get('/invalid/endpoint')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).not.toContain('stack');
      expect(response.body).toHaveProperty('requestId');
    });

    test('should handle security violation attempts', async () => {
      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.body.error).toBe('Authentication failed');
    });

    test('should preserve security headers in error responses', async () => {
      const response = await server
        .get(TEST_CONFIG.endpoints.workflow)
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('Health Check Tests', () => {
    test('should return healthy status when all dependencies are up', async () => {
      const response = await server
        .get(TEST_CONFIG.endpoints.health)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return unhealthy status when Redis is down', async () => {
      // Mock Redis failure
      jest.spyOn(require('ioredis').prototype, 'ping')
        .mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await server
        .get(TEST_CONFIG.endpoints.health)
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body.error).toContain('Service dependencies unavailable');
    });
  });
});