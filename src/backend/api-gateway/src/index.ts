// External imports with versions
import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.0
import helmet from 'helmet'; // ^7.0.0
import winston from 'winston'; // ^3.8.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import compression from 'compression'; // ^1.7.4
import { Redis } from 'ioredis'; // ^5.3.0

// Internal imports
import router from './routes';
import { validateJwt } from './middleware/auth.middleware';
import { kongConfig } from './config/kong.config';

// Configure Winston logger for structured logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Initialize Redis for distributed state
const redisClient = new Redis.Cluster(
  kongConfig.plugins.find(p => p.name === 'rate-limiting')?.config.redis_url?.split(',') || [],
  {
    scaleReads: 'slave',
    retryStrategy: (times: number) => Math.min(times * 100, 3000)
  }
);

// Initialize Express application with security configurations
const initializeExpress = (): Express => {
  const app = express();

  // Security headers middleware
  app.use(helmet(kongConfig.plugins.find(p => p.name === 'response-transformer')?.config.add.headers));

  // Enable gzip compression
  app.use(compression());

  // Body parsing with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.headers['x-request-id']);
    next();
  });

  // HIPAA-compliant audit logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture response data
    const originalSend = res.send;
    res.send = function (body: any): Response {
      res.locals.body = body;
      return originalSend.call(this, body);
    };

    res.on('finish', () => {
      const logData = {
        requestId: req.headers['x-request-id'],
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        timestamp: new Date().toISOString()
      };

      logger.info('Request completed', logData);
    });

    next();
  });

  return app;
};

// Initialize and configure the application
const app = initializeExpress();

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Deep health check including Redis
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service dependencies unavailable'
    });
  }
});

// Apply JWT validation to all API routes
app.use('/api', validateJwt);

// Mount main router
app.use('/', router);

// Global error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.headers['x-request-id'],
    path: req.path
  });

  // Sanitized error response for production
  res.status(500).json({
    error: 'Internal Server Error',
    requestId: req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
});

// Graceful shutdown handling
const shutdown = async () => {
  logger.info('Shutting down API Gateway...');
  
  server.close(async () => {
    try {
      await redisClient.quit();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;