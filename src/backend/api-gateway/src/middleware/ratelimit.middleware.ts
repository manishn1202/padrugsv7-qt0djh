// External imports with versions
import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'; // ^3.0.0
import Redis from 'ioredis'; // ^5.0.0
import { createLogger, format, transports } from 'winston'; // ^3.8.0

// Internal imports
import { kongConfig } from '../config/kong.config';

// Configure Winston logger for rate limit events
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'rate-limit.log' })
  ]
});

// Interface for rate limit configuration
interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
  emergency: {
    enabled: boolean;
    multiplier: number;
  };
  redis: {
    clusterNodes: string[];
    keyPrefix: string;
    retryStrategy: {
      retries: number;
      backoff: {
        min: number;
        max: number;
      };
    };
  };
}

// Extended Request interface with rate limit info
export interface RateLimitedRequest extends Request {
  rateLimitInfo?: {
    remainingPoints: number;
    consumedPoints: number;
    isBlocked: boolean;
    resetTime: Date;
    isEmergencyOverride: boolean;
    clientIdentifier: string;
  };
}

// Create Redis cluster client with health monitoring
const createRedisClient = (config: RateLimitConfig): Redis.Cluster => {
  const cluster = new Redis.Cluster(config.redis.clusterNodes, {
    scaleReads: 'slave',
    retryStrategy: (times: number) => {
      if (times > config.redis.retryStrategy.retries) {
        logger.error('Redis retry limit exceeded');
        return null;
      }
      const delay = Math.min(
        times * config.redis.retryStrategy.backoff.min,
        config.redis.retryStrategy.backoff.max
      );
      return delay;
    },
    clusterRetryStrategy: (times: number) => {
      return Math.min(100 * times, 3000);
    }
  });

  // Health check monitoring
  cluster.on('ready', () => logger.info('Redis cluster ready'));
  cluster.on('error', (err) => logger.error('Redis cluster error:', err));
  cluster.on('node error', (err) => logger.error('Redis node error:', err));

  return cluster;
};

// Create rate limiter instance
const createRateLimiter = (config: RateLimitConfig): RateLimiterRedis => {
  const redisClient = createRedisClient(config);

  return new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: config.redis.keyPrefix,
    points: config.points,
    duration: config.duration,
    blockDuration: config.blockDuration,
    insurancePeriod: 0, // Disable insurance by default for healthcare compliance
  });
};

// Initialize rate limiter with configuration
const rateLimiter = createRateLimiter({
  points: kongConfig.plugins.find(p => p.name === 'rate-limiting')?.config.minute || 1000,
  duration: 60,
  blockDuration: 300,
  emergency: {
    enabled: true,
    multiplier: 2
  },
  redis: {
    clusterNodes: process.env.REDIS_CLUSTER_NODES?.split(',') || ['localhost:6379'],
    keyPrefix: 'epa_ratelimit:',
    retryStrategy: {
      retries: 3,
      backoff: {
        min: 100,
        max: 3000
      }
    }
  }
});

// HIPAA-compliant error handler
const handleRateLimitError = (error: Error, res: Response): void => {
  logger.error('Rate limit error:', {
    error: error.message,
    timestamp: new Date().toISOString(),
    // Exclude PII/PHI from logs
    errorCode: 'RATE_LIMIT_ERROR'
  });

  res.status(429).json({
    error: 'Too Many Requests',
    message: 'API rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(rateLimiter.blockDuration / 1000)
  });
};

// Main rate limiting middleware
export const rateLimitMiddleware = async (
  req: RateLimitedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract client identifier from JWT or API key
    const clientIdentifier = req.headers.authorization?.split(' ')[1] || 
                           req.headers['x-api-key'] as string;

    if (!clientIdentifier) {
      res.status(401).json({ error: 'Missing authentication' });
      return;
    }

    // Check for emergency override conditions
    const isEmergency = req.headers['x-emergency-override'] === 'true' &&
                       req.headers['x-emergency-code'] === process.env.EMERGENCY_CODE;

    const pointsToConsume = isEmergency ? 1 : 1; // Emergency requests consume less points

    try {
      const rateLimitResult = await rateLimiter.consume(clientIdentifier, pointsToConsume);

      // Add rate limit info to request for downstream use
      req.rateLimitInfo = {
        remainingPoints: rateLimitResult.remainingPoints,
        consumedPoints: pointsToConsume,
        isBlocked: false,
        resetTime: new Date(Date.now() + rateLimitResult.msBeforeNext),
        isEmergencyOverride: isEmergency,
        clientIdentifier: clientIdentifier
      };

      // Set HIPAA-compliant rate limit headers
      res.set({
        'X-RateLimit-Limit': rateLimiter.points.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remainingPoints.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.msBeforeNext / 1000).toString()
      });

      // Log rate limit event
      logger.info('Rate limit consumed', {
        clientId: clientIdentifier.substring(0, 8), // Truncate for privacy
        remaining: rateLimitResult.remainingPoints,
        isEmergency,
        timestamp: new Date().toISOString()
      });

      next();
    } catch (rateLimitError) {
      // Handle rate limit exceeded
      const resetAfter = Math.ceil(rateLimiter.blockDuration / 1000);
      
      res.set({
        'X-RateLimit-Limit': rateLimiter.points.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetAfter.toString(),
        'Retry-After': resetAfter.toString()
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: 'API rate limit exceeded. Please try again later.',
        retryAfter: resetAfter
      });

      // Log rate limit violation
      logger.warn('Rate limit exceeded', {
        clientId: clientIdentifier.substring(0, 8),
        isEmergency,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    handleRateLimitError(error as Error, res);
  }
};