/**
 * @file Authentication Service Entry Point
 * @version 1.0.0
 * @description Enterprise-grade authentication service with HIPAA compliance and advanced security features
 * @requires express ^4.18.0
 * @requires cors ^2.8.5
 * @requires helmet ^7.0.0
 * @requires morgan ^1.10.0
 * @requires dotenv ^16.0.0
 * @requires rate-limiter-flexible ^2.4.1
 * @requires http-errors ^2.0.0
 * @requires winston ^3.8.0
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import createHttpError from 'http-errors';
import winston from 'winston';

import { configureAuthRoutes } from './routes/auth.routes';
import { auth0Config } from './config/auth0.config';
import { AuthController } from './controllers/auth.controller';

// Initialize environment variables
dotenv.config();

// Global constants
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORRELATION_ID_KEY = 'x-correlation-id';

/**
 * Configure Winston logger with HIPAA compliance
 */
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'auth-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    ...(NODE_ENV !== 'production' ? [new winston.transports.Console()] : [])
  ]
});

/**
 * Initialize Express server with security middleware
 */
const initializeServer = (): express.Application => {
  const app = express();

  // Security middleware configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", auth0Config.domain],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", auth0Config.domain],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
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

  // CORS configuration
  app.use(cors({
    origin: auth0Config.allowedCallbackUrls,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', CORRELATION_ID_KEY],
    credentials: true,
    maxAge: 600
  }));

  // Request parsing middleware
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Request logging middleware
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    },
    skip: (req) => req.url === '/health'
  }));

  // Rate limiting middleware
  const rateLimiter = new RateLimiterMemory({
    points: auth0Config.rateLimit,
    duration: 60,
    blockDuration: 300
  });

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rateLimiter.consume(req.ip);
      next();
    } catch {
      next(createHttpError(429, 'Too Many Requests'));
    }
  });

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers[CORRELATION_ID_KEY] || crypto.randomUUID();
    req.headers[CORRELATION_ID_KEY] = correlationId;
    res.setHeader(CORRELATION_ID_KEY, correlationId);
    next();
  });

  // Configure authentication routes
  const authController = new AuthController();
  app.use('/auth', configureAuthRoutes(authController));

  // Health check endpoint
  app.get('/health', (_, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV
    });
  });

  // Global error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || 500;
    const message = NODE_ENV === 'production' && status === 500
      ? 'Internal Server Error'
      : err.message;

    logger.error('Error:', {
      status,
      message,
      stack: err.stack,
      correlationId: req.headers[CORRELATION_ID_KEY],
      path: req.path,
      method: req.method
    });

    res.status(status).json({
      error: {
        status,
        message,
        correlationId: req.headers[CORRELATION_ID_KEY]
      }
    });
  });

  return app;
};

/**
 * Start server with graceful shutdown
 */
const startServer = async (): Promise<void> => {
  try {
    const app = initializeServer();
    
    const server = app.listen(PORT, () => {
      logger.info(`Auth service started on port ${PORT} in ${NODE_ENV} mode`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received - initiating graceful shutdown`);
      
      server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handling
    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Rejection:', reason);
      throw reason;
    });

    // Uncaught exception handling
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

export { initializeServer, startServer };