/**
 * @file Auth0 Configuration
 * @version 1.0.0
 * @description FIPS 140-2 compliant Auth0 configuration for enterprise healthcare authentication
 * @requires dotenv ^16.0.0
 */

import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

/**
 * Interface defining Auth0 configuration structure with FIPS 140-2 compliance
 */
export interface Auth0ConfigInterface {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  tokenSigningAlg: string;
  tokenExpirationTime: number;
  issuerBaseURL: string;
  allowedCallbackUrls: string[];
  allowedLogoutUrls: string[];
  enableIdTokenVerification: boolean;
  enableFIPSCompliance: boolean;
  encryptionAlgorithm: string;
  maxTokenAge: number;
  rateLimit: number;
  samlConfig: {
    enabled: boolean;
    signatureAlgorithm: string;
    digestAlgorithm: string;
    issuer: string;
    callbackUrl: string;
  };
  mfaConfig: {
    enabled: boolean;
    provider: string;
    authenticatorTypes: string[];
  };
  securityConfig: {
    brute_force_protection: boolean;
    breached_password_detection: boolean;
    minimum_password_length: number;
    require_numbers: boolean;
    require_symbols: boolean;
    require_uppercase: boolean;
  };
}

/**
 * Validates the Auth0 configuration settings including FIPS 140-2 compliance
 * @throws {Error} If configuration validation fails
 */
const validateConfig = (): void => {
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID || !process.env.AUTH0_CLIENT_SECRET) {
    throw new Error('Required Auth0 environment variables are missing');
  }

  // Domain validation
  if (!/^[a-zA-Z0-9-]+\.auth0\.com$/.test(process.env.AUTH0_DOMAIN)) {
    throw new Error('Invalid Auth0 domain format');
  }

  // Client ID validation
  if (!/^[a-zA-Z0-9]{32}$/.test(process.env.AUTH0_CLIENT_ID)) {
    throw new Error('Invalid Auth0 client ID format');
  }

  // FIPS compliance validation
  if (process.env.AUTH0_FIPS_MODE !== 'true') {
    throw new Error('FIPS 140-2 compliance mode must be enabled');
  }

  // Encryption algorithm validation
  const allowedAlgorithms = ['RS256', 'RS384', 'RS512'];
  if (!allowedAlgorithms.includes(process.env.AUTH0_TOKEN_SIGNING_ALG || '')) {
    throw new Error('Invalid token signing algorithm. Must use FIPS-compliant algorithm');
  }
};

/**
 * Auth0 configuration object with FIPS 140-2 compliance
 */
export const auth0Config: Auth0ConfigInterface = {
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  audience: process.env.AUTH0_AUDIENCE!,
  tokenSigningAlg: process.env.AUTH0_TOKEN_SIGNING_ALG || 'RS256',
  tokenExpirationTime: 3600, // 1 hour in seconds
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  allowedCallbackUrls: [
    'https://api.enhancedpa.com/callback',
    'https://enhancedpa.com/callback'
  ],
  allowedLogoutUrls: [
    'https://enhancedpa.com/logout',
    'https://enhancedpa.com/login'
  ],
  enableIdTokenVerification: true,
  enableFIPSCompliance: process.env.AUTH0_FIPS_MODE === 'true',
  encryptionAlgorithm: process.env.AUTH0_ENCRYPTION_ALG || 'AES-256-GCM',
  maxTokenAge: 86400, // 24 hours in seconds
  rateLimit: 100, // requests per minute
  samlConfig: {
    enabled: true,
    signatureAlgorithm: 'rsa-sha256',
    digestAlgorithm: 'sha256',
    issuer: 'urn:enhancedpa:saml',
    callbackUrl: 'https://api.enhancedpa.com/auth/saml/callback'
  },
  mfaConfig: {
    enabled: true,
    provider: 'auth0',
    authenticatorTypes: ['otp', 'push', 'recovery-code']
  },
  securityConfig: {
    brute_force_protection: true,
    breached_password_detection: true,
    minimum_password_length: 12,
    require_numbers: true,
    require_symbols: true,
    require_uppercase: true
  }
};

// Validate configuration on initialization
validateConfig();

// Export validated configuration
export default auth0Config;