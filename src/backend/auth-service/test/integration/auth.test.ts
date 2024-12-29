/**
 * @file Authentication Service Integration Tests
 * @version 1.0.0
 * @description Integration tests for authentication service endpoints and middleware
 */

import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals'; // v29.0.0
import supertest from 'supertest'; // v6.3.0
import express, { Express } from 'express'; // v4.18.0
import { ManagementClient } from 'auth0'; // v3.3.0
import crypto from 'crypto'; // v1.0.0

import { AuthService } from '../../src/services/auth.service';
import { validateJWT, requirePermissions } from '../../src/middleware/jwt.middleware';
import { auth0Config } from '../../src/config/auth0.config';
import { UserModel } from '../../src/models/user.model';

// Test configuration
const TEST_PORT = 4001;
const BASE_URL = '/api/v1/auth';

// Mock data
const testUsers = {
  healthcareProvider: {
    email: 'provider@test.com',
    password: 'Test123!@#',
    role: 'HEALTHCARE_PROVIDER',
    permissions: ['submit_request', 'view_requests'],
    organizationId: 'org_123'
  },
  insuranceReviewer: {
    email: 'reviewer@test.com',
    password: 'Test456!@#',
    role: 'INSURANCE_REVIEWER',
    permissions: ['review_requests', 'approve_deny'],
    organizationId: 'org_456'
  },
  systemAdmin: {
    email: 'admin@test.com',
    password: 'Test789!@#',
    role: 'SYSTEM_ADMIN',
    permissions: ['manage_users', 'manage_roles', 'view_all'],
    organizationId: 'org_789'
  }
};

describe('Auth Integration Tests', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let auth0Management: ManagementClient;
  let authService: AuthService;
  let testTokens: { [key: string]: string } = {};

  beforeAll(async () => {
    // Initialize Express app
    app = express();
    app.use(express.json());

    // Initialize Auth0 management client
    auth0Management = new ManagementClient({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      clientSecret: auth0Config.clientSecret
    });

    // Initialize auth service
    authService = new AuthService();

    // Setup test routes
    app.post(`${BASE_URL}/login`, async (req, res) => {
      try {
        const result = await authService.authenticateUser(req.body.email, req.body.password);
        res.json(result);
      } catch (error) {
        res.status(401).json({ error: error.message });
      }
    });

    app.post(`${BASE_URL}/mfa/validate`, validateJWT, async (req, res) => {
      try {
        const result = await authService.validateMFA(req.body.userId, req.body.otpCode);
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    app.get(
      `${BASE_URL}/protected`,
      validateJWT,
      requirePermissions(['view_requests']),
      (req, res) => res.json({ message: 'success' })
    );

    // Create test users in Auth0
    for (const [role, userData] of Object.entries(testUsers)) {
      const auth0User = await auth0Management.createUser({
        email: userData.email,
        password: userData.password,
        connection: 'Username-Password-Authentication',
        email_verified: true
      });

      // Create corresponding user in database
      await UserModel.create({
        auth0Id: auth0User.user_id,
        email: userData.email,
        role: userData.role,
        permissions: userData.permissions,
        organizationId: userData.organizationId,
        firstName: 'Test',
        lastName: role,
        isActive: true,
        passwordHash: await crypto.randomBytes(32).toString('hex')
      });
    }

    request = supertest(app);
  });

  afterAll(async () => {
    // Cleanup test users
    for (const userData of Object.values(testUsers)) {
      const auth0User = await auth0Management.getUsersByEmail(userData.email);
      if (auth0User.length > 0) {
        await auth0Management.deleteUser({ id: auth0User[0].user_id });
      }
      await UserModel.deleteOne({ email: userData.email });
    }
  });

  describe('OAuth 2.0 + OIDC Authentication Flow Tests', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      const response = await request
        .post(`${BASE_URL}/login`)
        .send({
          email: testUsers.healthcareProvider.email,
          password: testUsers.healthcareProvider.password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('idToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.role).toBe('HEALTHCARE_PROVIDER');

      // Store token for subsequent tests
      testTokens.healthcareProvider = response.body.accessToken;
    });

    it('should fail authentication with invalid credentials', async () => {
      const response = await request
        .post(`${BASE_URL}/login`)
        .send({
          email: testUsers.healthcareProvider.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });

    it('should enforce rate limiting on login attempts', async () => {
      const attempts = Array(6).fill(null);
      const responses = await Promise.all(
        attempts.map(() =>
          request.post(`${BASE_URL}/login`).send({
            email: testUsers.healthcareProvider.email,
            password: 'wrongpassword'
          })
        )
      );

      expect(responses[responses.length - 1].status).toBe(429);
    });
  });

  describe('FIPS 140-2 Compliance Tests', () => {
    it('should use FIPS-compliant algorithms for token signing', async () => {
      const response = await request
        .post(`${BASE_URL}/login`)
        .send({
          email: testUsers.systemAdmin.email,
          password: testUsers.systemAdmin.password
        });

      const token = response.body.accessToken;
      const [header] = token.split('.');
      const decodedHeader = JSON.parse(Buffer.from(header, 'base64').toString());

      expect(decodedHeader.alg).toMatch(/^RS(256|384|512)$/);
    });

    it('should enforce secure token validation', async () => {
      const response = await request
        .get(`${BASE_URL}/protected`)
        .set('Authorization', `Bearer ${testTokens.healthcareProvider}`);

      expect(response.status).toBe(200);
    });

    it('should reject tokens with invalid signatures', async () => {
      const tamperedToken = testTokens.healthcareProvider.slice(0, -1) + '1';
      const response = await request
        .get(`${BASE_URL}/protected`)
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Role-Based Access Control Tests', () => {
    beforeEach(async () => {
      // Authenticate users and store tokens
      for (const [role, userData] of Object.entries(testUsers)) {
        const response = await request
          .post(`${BASE_URL}/login`)
          .send({
            email: userData.email,
            password: userData.password
          });
        testTokens[role] = response.body.accessToken;
      }
    });

    it('should allow access with required permissions', async () => {
      const response = await request
        .get(`${BASE_URL}/protected`)
        .set('Authorization', `Bearer ${testTokens.healthcareProvider}`);

      expect(response.status).toBe(200);
    });

    it('should deny access without required permissions', async () => {
      const response = await request
        .get(`${BASE_URL}/protected`)
        .set('Authorization', `Bearer ${testTokens.insuranceReviewer}`);

      expect(response.status).toBe(403);
    });

    it('should enforce organization-specific access control', async () => {
      // Add organization-specific endpoint for testing
      app.get(
        `${BASE_URL}/org-specific`,
        validateJWT,
        requirePermissions(['view_requests'], { requireAll: true }),
        (req: any, res) => {
          if (req.user.organizationId !== 'org_123') {
            return res.status(403).json({ error: 'Invalid organization' });
          }
          res.json({ message: 'success' });
        }
      );

      const response = await request
        .get(`${BASE_URL}/org-specific`)
        .set('Authorization', `Bearer ${testTokens.healthcareProvider}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Multi-Factor Authentication Tests', () => {
    it('should validate MFA token correctly', async () => {
      const response = await request
        .post(`${BASE_URL}/mfa/validate`)
        .set('Authorization', `Bearer ${testTokens.healthcareProvider}`)
        .send({
          userId: 'test_user_id',
          otpCode: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isValid');
    });

    it('should enforce MFA attempt limits', async () => {
      const attempts = Array(4).fill(null);
      const responses = await Promise.all(
        attempts.map(() =>
          request
            .post(`${BASE_URL}/mfa/validate`)
            .set('Authorization', `Bearer ${testTokens.healthcareProvider}`)
            .send({
              userId: 'test_user_id',
              otpCode: 'wrong_code'
            })
        )
      );

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.body).toHaveProperty('lockoutTime');
      expect(lastResponse.body.remainingAttempts).toBe(0);
    });
  });
});