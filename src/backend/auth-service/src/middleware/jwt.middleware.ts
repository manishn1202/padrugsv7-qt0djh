/**
 * @file JWT Middleware
 * @version 1.0.0
 * @description Enterprise-grade JWT middleware with HIPAA-compliant security features
 * @requires express ^4.18.0
 * @requires jsonwebtoken ^9.0.0
 * @requires http-errors ^2.0.0
 * @requires rate-limiter-flexible ^2.4.1
 */

import { Request, Response, NextFunction } from 'express';
import { verify, JwtPayload } from 'jsonwebtoken';
import createHttpError from 'http-errors';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { auth0Config } from '../config/auth0.config';
import { AuthService } from '../services/auth.service';

// Initialize services
const authService = new AuthService();

// Configure rate limiter for token validation
const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per minute
});

/**
 * Enhanced JWT payload interface with security context
 */
export interface JWTPayload extends JwtPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  permissions: string[];
  organizationId: string;
  deviceId?: string;
  ipAddress?: string;
  sessionId?: string;
  securityContext?: {
    mfaVerified?: boolean;
    lastPasswordChange?: Date;
    securityLevel?: string;
    accessRestrictions?: string[];
  };
}

/**
 * Extended Express Request interface with authenticated user data
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  securityContext?: {
    organizationId: string;
    permissions: string[];
    securityLevel: string;
    auditContext: {
      requestId: string;
      timestamp: Date;
      ipAddress: string;
      userAgent: string;
    };
  };
}

/**
 * Options interface for permission requirements
 */
interface PermissionOptions {
  requireAll?: boolean;
  securityLevel?: string;
  auditLog?: boolean;
}

/**
 * Validates JWT token and enhances request with security context
 */
export const validateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw createHttpError(401, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Apply rate limiting
    try {
      await rateLimiter.consume(req.ip);
    } catch (error) {
      throw createHttpError(429, 'Too many token validation attempts');
    }

    // Validate token format
    if (!/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(token)) {
      throw createHttpError(401, 'Invalid token format');
    }

    // Verify token with Auth0 configuration
    const decoded = verify(token, process.env.JWT_PUBLIC_KEY!, {
      algorithms: [auth0Config.tokenSigningAlg as 'RS256' | 'RS384' | 'RS512'],
      audience: auth0Config.audience,
      issuer: auth0Config.issuerBaseURL,
      complete: true
    }) as JWTPayload;

    // Enhanced token validation
    const isValid = await authService.validateToken(token);
    if (!isValid) {
      throw createHttpError(401, 'Token validation failed');
    }

    // Validate device fingerprint if available
    if (decoded.deviceId && req.headers['x-device-id']) {
      const isValidDevice = await authService.validateDeviceFingerprint(
        decoded.deviceId,
        req.headers['x-device-id'] as string
      );
      if (!isValidDevice) {
        throw createHttpError(401, 'Invalid device fingerprint');
      }
    }

    // Validate IP address if available
    if (decoded.ipAddress) {
      const isValidIp = await authService.validateIpAddress(
        decoded.ipAddress,
        req.ip
      );
      if (!isValidIp) {
        throw createHttpError(401, 'Invalid IP address');
      }
    }

    // Create enhanced security context
    const securityContext = {
      organizationId: decoded.organizationId,
      permissions: decoded.permissions,
      securityLevel: decoded.securityContext?.securityLevel || 'standard',
      auditContext: {
        requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    };

    // Attach decoded data and security context to request
    req.user = decoded;
    req.securityContext = securityContext;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      next(createHttpError(401, 'Token has expired'));
    } else if (error.name === 'JsonWebTokenError') {
      next(createHttpError(401, 'Invalid token'));
    } else {
      next(error);
    }
  }
};

/**
 * Middleware factory for checking required permissions
 */
export const requirePermissions = (
  requiredPermissions: string[],
  options: PermissionOptions = {}
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { user, securityContext } = req;

      if (!user || !securityContext) {
        throw createHttpError(401, 'Authentication required');
      }

      // Validate security level if required
      if (options.securityLevel && 
          user.securityContext?.securityLevel !== options.securityLevel) {
        throw createHttpError(403, 'Insufficient security level');
      }

      // Check permissions
      const hasPermissions = options.requireAll
        ? requiredPermissions.every(permission => 
            user.permissions.includes(permission))
        : requiredPermissions.some(permission => 
            user.permissions.includes(permission));

      if (!hasPermissions) {
        throw createHttpError(403, 'Insufficient permissions');
      }

      // Audit log if enabled
      if (options.auditLog) {
        await authService.validateToken(req.headers.authorization!.split(' ')[1]);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default {
  validateJWT,
  requirePermissions
};