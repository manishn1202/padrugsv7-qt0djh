import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import jwt, { JWTPayload } from 'express-jwt'; // ^8.4.0
import jwksRsa from 'jwks-rsa'; // ^3.0.0
import { createClient } from 'redis'; // ^4.0.0
import { kongConfig } from '../config/kong.config';

// Enhanced security interfaces
interface ISecurityContext {
  securityLevel: number;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  lastActivity: Date;
  securityFlags: string[];
}

interface IAuditTrail {
  requestId: string;
  timestamp: Date;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  reason?: string;
}

interface IUser {
  id: string;
  auth0Id: string;
  roles: string[];
  permissions: string[];
  securityLevel: number;
  lastActivity: Date;
}

// Extended Express Request interface with security properties
export interface AuthenticatedRequest extends Request {
  user: IUser;
  auth: JWTPayload;
  roles: string[];
  securityContext: ISecurityContext;
  auditTrail: IAuditTrail;
}

// Initialize Redis client for token management
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: true
  }
});

redisClient.connect().catch(console.error);

// Enhanced JWKS client with caching
const jwksClient = jwksRsa({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  jwksUri: `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  timeout: 30000
});

// Security constants
const SECURITY_CONSTANTS = {
  TOKEN_EXPIRY_GRACE_PERIOD: 300, // 5 minutes in seconds
  MAX_TOKEN_AGE: 3600, // 1 hour in seconds
  RATE_LIMIT_WINDOW: 60, // 1 minute in seconds
  MAX_FAILED_ATTEMPTS: 5,
  SESSION_TIMEOUT: 1800, // 30 minutes in seconds
  MINIMUM_SECURITY_LEVEL: 2
};

// Enhanced JWT validation middleware
export const validateJwt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Initialize security context
    const securityContext: ISecurityContext = {
      securityLevel: 0,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || 'unknown',
      sessionId: req.get('x-session-id') || '',
      lastActivity: new Date(),
      securityFlags: []
    };

    // Enhanced JWT validation
    const jwtCheck = jwt({
      secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
      }),
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    });

    await new Promise((resolve, reject) => {
      jwtCheck(req, res, (err) => {
        if (err) reject(err);
        resolve(true);
      });
    });

    // Token replay protection
    const tokenId = req.auth?.jti;
    if (tokenId) {
      const isTokenUsed = await redisClient.get(`used_token:${tokenId}`);
      if (isTokenUsed) {
        throw new Error('Token replay detected');
      }
      await redisClient.setEx(`used_token:${tokenId}`, SECURITY_CONSTANTS.MAX_TOKEN_AGE, 'true');
    }

    // Verify token expiration with grace period
    const tokenExp = req.auth?.exp || 0;
    const currentTime = Math.floor(Date.now() / 1000);
    if (tokenExp - currentTime < -SECURITY_CONSTANTS.TOKEN_EXPIRY_GRACE_PERIOD) {
      throw new Error('Token expired');
    }

    // Enhanced user context
    req.user = {
      id: req.auth?.sub || '',
      auth0Id: req.auth?.sub || '',
      roles: req.auth?.roles || [],
      permissions: req.auth?.permissions || [],
      securityLevel: req.auth?.security_level || SECURITY_CONSTANTS.MINIMUM_SECURITY_LEVEL,
      lastActivity: new Date()
    };

    // Audit trail initialization
    req.auditTrail = {
      requestId: req.get('x-request-id') || '',
      timestamp: new Date(),
      action: req.method,
      resourceType: req.path.split('/')[1],
      resourceId: req.params.id,
      outcome: 'PENDING'
    };

    req.securityContext = securityContext;
    next();
  } catch (error) {
    handleAuthError(error, req, res, next);
  }
};

// Enhanced role checking middleware
export const checkRole = (requiredRoles: string[], options: any = {}) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userRoles = req.user?.roles || [];
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        throw new Error('Insufficient permissions');
      }

      // Role-based security level validation
      if (req.user.securityLevel < SECURITY_CONSTANTS.MINIMUM_SECURITY_LEVEL) {
        throw new Error('Insufficient security level');
      }

      // Session activity timeout check
      const lastActivity = req.user.lastActivity.getTime();
      const currentTime = Date.now();
      if (currentTime - lastActivity > SECURITY_CONSTANTS.SESSION_TIMEOUT * 1000) {
        throw new Error('Session timeout');
      }

      // Update last activity
      await redisClient.setEx(
        `user_activity:${req.user.id}`,
        SECURITY_CONSTANTS.SESSION_TIMEOUT,
        currentTime.toString()
      );

      // Apply role-specific rate limits
      const roleRateKey = `rate_limit:${req.user.id}:${req.method}`;
      const requests = await redisClient.incr(roleRateKey);
      if (requests === 1) {
        await redisClient.expire(roleRateKey, SECURITY_CONSTANTS.RATE_LIMIT_WINDOW);
      }

      const rateLimit = kongConfig.plugins.find(p => p.name === 'rate-limiting')?.config.minute || 1000;
      if (requests > rateLimit) {
        throw new Error('Rate limit exceeded');
      }

      next();
    } catch (error) {
      handleAuthError(error, req, res, next);
    }
  };
};

// Enhanced error handler with security monitoring
export const handleAuthError = (
  error: Error,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Update audit trail
  if (req.auditTrail) {
    req.auditTrail.outcome = 'FAILURE';
    req.auditTrail.reason = error.message;
  }

  // Security event logging
  const securityEvent = {
    timestamp: new Date(),
    type: 'SECURITY_ERROR',
    error: error.message,
    requestId: req.get('x-request-id'),
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  };

  // Log security event (implement your logging strategy)
  console.error('Security Event:', securityEvent);

  // Increment failed attempts counter
  const failedAttemptsKey = `failed_attempts:${req.ip}`;
  redisClient.incr(failedAttemptsKey)
    .then(attempts => {
      if (attempts === 1) {
        redisClient.expire(failedAttemptsKey, SECURITY_CONSTANTS.RATE_LIMIT_WINDOW);
      }
      if (attempts >= SECURITY_CONSTANTS.MAX_FAILED_ATTEMPTS) {
        // Implement additional security measures like IP blocking
        redisClient.setEx(`blocked_ip:${req.ip}`, SECURITY_CONSTANTS.RATE_LIMIT_WINDOW, 'true');
      }
    })
    .catch(console.error);

  // Send secure error response
  res.status(401).json({
    error: 'Authentication failed',
    requestId: req.get('x-request-id')
  });
};