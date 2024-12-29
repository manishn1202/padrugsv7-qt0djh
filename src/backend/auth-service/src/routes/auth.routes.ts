/**
 * @file Authentication Routes
 * @version 1.0.0
 * @description Enterprise-grade authentication routes with OAuth 2.0, OIDC, and HIPAA compliance
 * @requires express ^4.18.0
 * @requires helmet ^7.0.0
 * @requires express-rate-limit ^6.7.0
 */

import { Router } from 'express'; // v4.18.0
import helmet from 'helmet'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0

import { AuthController } from '../controllers/auth.controller';
import { validateJWT, requirePermissions } from '../middleware/jwt.middleware';
import { auth0Config } from '../config/auth0.config';

/**
 * Configures authentication routes with enterprise security features
 * @param authController Initialized authentication controller instance
 * @returns Configured Express router
 */
export const configureAuthRoutes = (authController: AuthController): Router => {
  const router = Router();

  // Apply security headers
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", auth0Config.domain],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // Global rate limiter
  const globalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  });

  router.use(globalRateLimit);

  // Login endpoint with enhanced security
  router.post('/login', 
    rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5, // 5 attempts per windowMs
      message: 'Too many login attempts, please try again later'
    }),
    helmet(),
    authController.login
  );

  // SAML authentication callback
  router.post('/saml/callback',
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 10
    }),
    helmet(),
    authController.samlCallback
  );

  // Token refresh with rate limiting
  router.post('/refresh-token',
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 10
    }),
    helmet(),
    authController.refreshToken
  );

  // Protected user profile route
  router.get('/profile',
    validateJWT,
    requirePermissions(['read:profile'], {
      requireAll: true,
      auditLog: true,
      securityLevel: 'standard'
    }),
    helmet(),
    authController.getUserProfile
  );

  // Secure logout endpoint
  router.post('/logout',
    validateJWT,
    helmet(),
    authController.logout
  );

  // MFA verification endpoint
  router.post('/mfa/verify',
    validateJWT,
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 3
    }),
    helmet(),
    authController.verifyMFA
  );

  // Health check endpoint
  router.get('/health',
    helmet(),
    (_, res) => res.status(200).json({ status: 'healthy' })
  );

  // Error handling middleware
  router.use((err: any, req: any, res: any, next: any) => {
    console.error(`Auth Route Error: ${err.message}`);
    
    // Sanitize error messages in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'An authentication error occurred'
      : err.message;

    res.status(err.status || 500).json({
      error: {
        message,
        code: err.code || 'AUTH_ERROR',
        requestId: req.headers['x-request-id']
      }
    });
  });

  return router;
};

export default configureAuthRoutes;