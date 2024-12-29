/**
 * @file Authentication Service Unit Tests
 * @version 1.0.0
 * @description Comprehensive test suite for authentication service with enhanced security validation
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { ManagementClient, AuthenticationClient } from 'auth0'; // v4.0.0
import { verify, sign } from 'jsonwebtoken'; // v9.0.0
import { createHash, getCiphers, getFips } from 'crypto'; // built-in

import { AuthService } from '../../src/services/auth.service';
import { auth0Config } from '../../src/config/auth0.config';
import { UserModel } from '../../src/models/user.model';

// Mock implementations
jest.mock('auth0');
jest.mock('../../src/models/user.model');

// Test data fixtures
const mockUser = {
  id: 'user123',
  auth0Id: 'auth0|user123',
  email: 'provider@healthcare.org',
  role: 'HEALTHCARE_PROVIDER',
  permissions: ['create:request', 'read:request'],
  addAuditLog: jest.fn(),
};

const mockTokens = {
  access_token: 'mock.access.token',
  id_token: 'mock.id.token',
  refresh_token: 'mock.refresh.token',
};

const mockSecurityConfig = {
  tokenSigningAlg: 'RS256',
  enableFIPSCompliance: true,
  encryptionAlgorithm: 'AES-256-GCM',
};

describe('AuthService', () => {
  let authService: AuthService;
  let mockAuth0Management: jest.Mocked<ManagementClient>;
  let mockAuth0Authentication: jest.Mocked<AuthenticationClient>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocked Auth0 clients
    mockAuth0Management = new ManagementClient({}) as jest.Mocked<ManagementClient>;
    mockAuth0Authentication = new AuthenticationClient({}) as jest.Mocked<AuthenticationClient>;

    // Setup Auth0 mock implementations
    (ManagementClient as jest.Mock).mockImplementation(() => mockAuth0Management);
    (AuthenticationClient as jest.Mock).mockImplementation(() => mockAuth0Authentication);

    // Initialize auth service
    authService = new AuthService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('authenticateUser', () => {
    test('should successfully authenticate user with valid credentials', async () => {
      // Setup mocks
      mockAuth0Authentication.passwordGrant.mockResolvedValue(mockTokens);
      mockAuth0Authentication.getProfile.mockResolvedValue({ sub: mockUser.auth0Id });
      (UserModel.findByAuth0Id as jest.Mock).mockResolvedValue(mockUser);

      // Execute test
      const result = await authService.authenticateUser('provider@healthcare.org', 'ValidPass123!');

      // Assertions
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('idToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        permissions: mockUser.permissions,
      });
      expect(mockUser.addAuditLog).toHaveBeenCalledWith(
        'login',
        { method: 'password' },
        'system',
        'auth-service'
      );
    });

    test('should fail authentication with invalid credentials', async () => {
      // Setup mock to simulate authentication failure
      mockAuth0Authentication.passwordGrant.mockRejectedValue(new Error('Invalid credentials'));

      // Execute and assert
      await expect(
        authService.authenticateUser('provider@healthcare.org', 'InvalidPass')
      ).rejects.toThrow('Authentication failed');
    });

    test('should enforce rate limiting on authentication attempts', async () => {
      // Setup mocks for rate limiting test
      const attempts = Array(6).fill(null);
      
      // Execute multiple authentication attempts
      for (const _ of attempts) {
        try {
          await authService.authenticateUser('provider@healthcare.org', 'ValidPass123!');
        } catch (error) {
          // Continue testing
        }
      }

      // Assert rate limiting
      await expect(
        authService.authenticateUser('provider@healthcare.org', 'ValidPass123!')
      ).rejects.toThrow('Too many requests');
    });
  });

  describe('validateToken', () => {
    test('should validate a legitimate JWT token', async () => {
      // Create a valid test token
      const testToken = sign(
        { sub: mockUser.id, role: mockUser.role },
        'test-secret',
        { algorithm: 'RS256' }
      );

      // Execute validation
      const result = await authService.validateToken(testToken);

      // Assert
      expect(result).toBe(true);
    });

    test('should reject an expired token', async () => {
      // Create an expired token
      const expiredToken = sign(
        { sub: mockUser.id, role: mockUser.role },
        'test-secret',
        { algorithm: 'RS256', expiresIn: '0s' }
      );

      // Execute validation
      const result = await authService.validateToken(expiredToken);

      // Assert
      expect(result).toBe(false);
    });

    test('should reject a token with invalid signature', async () => {
      // Create a token with different signing key
      const invalidToken = sign(
        { sub: mockUser.id, role: mockUser.role },
        'different-secret',
        { algorithm: 'RS256' }
      );

      // Execute validation
      const result = await authService.validateToken(invalidToken);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('FIPS 140-2 Compliance', () => {
    test('should validate FIPS mode is enabled', () => {
      // Check FIPS mode
      const fipsMode = getFips();
      expect(fipsMode).toBe(1);
    });

    test('should use only FIPS-approved algorithms', () => {
      // Get available ciphers
      const availableCiphers = getCiphers();
      
      // Verify FIPS-approved algorithms
      expect(availableCiphers).toContain('aes-256-gcm');
      expect(auth0Config.tokenSigningAlg).toMatch(/^RS(256|384|512)$/);
    });

    test('should use secure key generation', () => {
      // Test hash generation
      const hash = createHash('sha256');
      expect(() => hash.update('test')).not.toThrow();
    });
  });

  describe('Role-Based Access Control', () => {
    test('should validate healthcare provider permissions', async () => {
      const providerUser = {
        ...mockUser,
        role: 'HEALTHCARE_PROVIDER',
        permissions: ['create:request', 'read:request'],
      };

      (UserModel.findByAuth0Id as jest.Mock).mockResolvedValue(providerUser);

      // Execute authentication
      const result = await authService.authenticateUser('provider@healthcare.org', 'ValidPass123!');

      // Assert permissions
      expect(result.user.permissions).toContain('create:request');
      expect(result.user.permissions).toContain('read:request');
      expect(result.user.permissions).not.toContain('approve:request');
    });

    test('should validate insurance reviewer permissions', async () => {
      const reviewerUser = {
        ...mockUser,
        role: 'INSURANCE_REVIEWER',
        permissions: ['read:request', 'approve:request', 'deny:request'],
      };

      (UserModel.findByAuth0Id as jest.Mock).mockResolvedValue(reviewerUser);

      // Execute authentication
      const result = await authService.authenticateUser('reviewer@insurance.org', 'ValidPass123!');

      // Assert permissions
      expect(result.user.permissions).toContain('approve:request');
      expect(result.user.permissions).toContain('deny:request');
      expect(result.user.permissions).not.toContain('admin:system');
    });

    test('should validate system admin permissions', async () => {
      const adminUser = {
        ...mockUser,
        role: 'SYSTEM_ADMIN',
        permissions: ['admin:system', 'manage:users', 'manage:roles'],
      };

      (UserModel.findByAuth0Id as jest.Mock).mockResolvedValue(adminUser);

      // Execute authentication
      const result = await authService.authenticateUser('admin@system.org', 'ValidPass123!');

      // Assert permissions
      expect(result.user.permissions).toContain('admin:system');
      expect(result.user.permissions).toContain('manage:users');
      expect(result.user.permissions).toContain('manage:roles');
    });
  });
});