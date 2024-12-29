// External imports with versions
import express, { Router, Request, Response, NextFunction } from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware'; // ^2.0.6
import Redis from 'ioredis'; // ^5.3.0

// Internal imports
import { validateJwt, checkRole } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/ratelimit.middleware';
import { kongConfig } from '../config/kong.config';

// Enhanced interfaces for service routing
interface ServiceRoute {
  path: string;
  target: string;
  auth: boolean;
  roles: string[];
  rateLimit: {
    points: number;
    duration: number;
  };
  circuitBreaker: {
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
  retry: {
    attempts: number;
    backoff: {
      min: number;
      max: number;
    };
  };
  audit: {
    enabled: boolean;
    level: string;
  };
  timeout: number;
}

// Service route configurations
const serviceRoutes: ServiceRoute[] = [
  {
    path: '/api/v1/authorizations',
    target: kongConfig.services.find(s => s.name === 'workflow-service')?.url || '',
    auth: true,
    roles: ['healthcare_provider', 'insurance_reviewer', 'admin'],
    rateLimit: {
      points: 1000,
      duration: 60
    },
    circuitBreaker: {
      threshold: 0.5,
      timeout: 30000,
      resetTimeout: 60000
    },
    retry: {
      attempts: 3,
      backoff: {
        min: 1000,
        max: 5000
      }
    },
    audit: {
      enabled: true,
      level: 'detailed'
    },
    timeout: 30000
  },
  {
    path: '/api/v1/documents',
    target: kongConfig.services.find(s => s.name === 'document-service')?.url || '',
    auth: true,
    roles: ['healthcare_provider', 'insurance_reviewer', 'admin'],
    rateLimit: {
      points: 200,
      duration: 60
    },
    circuitBreaker: {
      threshold: 0.5,
      timeout: 45000,
      resetTimeout: 90000
    },
    retry: {
      attempts: 3,
      backoff: {
        min: 1000,
        max: 5000
      }
    },
    audit: {
      enabled: true,
      level: 'detailed'
    },
    timeout: 45000
  }
];

// Initialize Redis for distributed state
const redisClient = new Redis.Cluster(
  kongConfig.plugins.find(p => p.name === 'rate-limiting')?.config.redis_url?.split(',') || [],
  {
    scaleReads: 'slave',
    retryStrategy: (times: number) => Math.min(times * 100, 3000)
  }
);

// Create enhanced proxy middleware with resilience patterns
const createServiceProxy = (route: ServiceRoute): express.RequestHandler => {
  const circuitBreakerKey = `circuit:${route.path}`;
  let failureCount = 0;
  let lastFailureTime = 0;

  const proxyOptions: ProxyOptions = {
    target: route.target,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    timeout: route.timeout,
    proxyTimeout: route.timeout + 1000,
    pathRewrite: {
      [`^${route.path}`]: ''
    },
    onError: async (err: Error, req: Request, res: Response) => {
      failureCount++;
      lastFailureTime = Date.now();

      // Circuit breaker logic
      if (failureCount >= route.circuitBreaker.threshold) {
        await redisClient.setex(circuitBreakerKey, 
          Math.floor(route.circuitBreaker.resetTimeout / 1000), 'OPEN');
      }

      res.status(502).json({
        error: 'Service temporarily unavailable',
        requestId: req.headers['x-request-id']
      });
    },
    onProxyReq: (proxyReq, req: Request) => {
      // Add HIPAA-compliant headers
      proxyReq.setHeader('X-Request-ID', req.headers['x-request-id'] || '');
      proxyReq.setHeader('X-Forwarded-For', req.ip);
      proxyReq.setHeader('X-Original-URI', req.originalUrl);
    }
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Circuit breaker check
      const circuitState = await redisClient.get(circuitBreakerKey);
      if (circuitState === 'OPEN') {
        if (Date.now() - lastFailureTime >= route.circuitBreaker.resetTimeout) {
          await redisClient.del(circuitBreakerKey);
          failureCount = 0;
        } else {
          res.status(503).json({
            error: 'Service temporarily unavailable',
            requestId: req.headers['x-request-id']
          });
          return;
        }
      }

      createProxyMiddleware(proxyOptions)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// Initialize router with enhanced security
const router = Router();

// Apply security middleware
router.use(helmet({
  hsts: true,
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Configure CORS
router.use(cors({
  origin: kongConfig.plugins.find(p => p.name === 'cors')?.config.origins || [],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 7200
}));

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Deep health check including Redis
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

// Configure service routes with middleware chain
serviceRoutes.forEach(route => {
  const middlewareChain = [
    validateJwt,
    checkRole(route.roles),
    rateLimitMiddleware,
    createServiceProxy(route)
  ];

  router.use(route.path, middlewareChain);
});

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Gateway Error:', {
    error: err.message,
    path: req.path,
    requestId: req.headers['x-request-id']
  });

  res.status(500).json({
    error: 'Internal Server Error',
    requestId: req.headers['x-request-id']
  });
});

export default router;