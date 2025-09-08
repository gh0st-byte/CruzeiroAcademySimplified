import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import 'express-async-errors';

// Import configurations and services
import db from './config/database.js';
import logger from './config/logger.js';

// Import middleware
import { requestCounterMiddleware } from './routes/health.js';

// Import routes
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import publicRouter from './routes/public.js';
import adminRouter from './routes/admin.js';

class CruzeiroAcademyCMS {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = process.env.PORT || 3000;
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddlewares() {
    // Trust proxy for proper IP detection behind load balancer
    this.app.set('trust proxy', 1);

    // Security middlewares
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:"],
          fontSrc: ["'self'", "https:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "https:"],
          frameSrc: ["'none'"],
        },
      },
    }));

    // CORS configuration
    const corsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim());
        const isAllowed = allowedOrigins.includes(origin) || 
                         allowedOrigins.some(allowed => {
                           if (allowed.includes('*')) {
                             const pattern = allowed.replace(/\*/g, '.*');
                             return new RegExp(`^${pattern}$`).test(origin);
                           }
                           return false;
                         });

        if (isAllowed) {
          callback(null, true);
        } else {
          logger.security('CORS violation attempt', null, null, { origin });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'CloudFront-Viewer-Country'],
      exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
    };

    this.app.use(cors(corsOptions));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    const morganFormat = process.env.NODE_ENV === 'production' 
      ? 'combined' 
      : 'dev';
      
    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message) => {
          logger.info(message.trim(), { context: 'http-request' });
        }
      }
    }));

    // Request counter for metrics
    this.app.use(requestCounterMiddleware);

    // Global rate limiting
    const globalRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
      message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.security('Rate limit exceeded', null, req.ip, {
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }
    });

    this.app.use(globalRateLimit);

    // Request correlation ID
    this.app.use((req, res, next) => {
      req.correlationId = req.headers['x-correlation-id'] || 
                         `cms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      res.setHeader('X-Correlation-ID', req.correlationId);
      req.logger = logger.withCorrelationId(req.correlationId);
      
      next();
    });
  }

  setupRoutes() {
    const apiVersion = process.env.API_VERSION || 'v1';

    // Health check routes (sem prefixo de versão)
    this.app.use('/', healthRouter);

    // API routes com versionamento
    this.app.use(`/api/${apiVersion}/auth`, authRouter);
    this.app.use(`/api/${apiVersion}/public`, publicRouter);
    this.app.use(`/api/${apiVersion}/admin`, adminRouter);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Cruzeiro Academy CMS API',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        documentation: `/api/${apiVersion}/docs`,
        health: '/health',
        timestamp: new Date().toISOString()
      });
    });

    // API documentation endpoint
    this.app.get(`/api/${apiVersion}/docs`, (req, res) => {
      res.json({
        title: 'Cruzeiro Academy CMS API Documentation',
        version: apiVersion,
        endpoints: {
          authentication: {
            login: `POST /api/${apiVersion}/auth/login`,
            refresh: `POST /api/${apiVersion}/auth/refresh`,
            logout: `POST /api/${apiVersion}/auth/logout`,
            profile: `GET /api/${apiVersion}/auth/me`
          },
          public: {
            contents: `GET /api/${apiVersion}/public/contents`,
            content: `GET /api/${apiVersion}/public/contents/:slug`,
            categories: `GET /api/${apiVersion}/public/categories`,
            schools: `GET /api/${apiVersion}/public/schools`,
            search: `GET /api/${apiVersion}/public/search`
          },
          admin: {
            contents: `GET|POST|PUT|DELETE /api/${apiVersion}/admin/contents`,
            categories: `GET|POST|PUT|DELETE /api/${apiVersion}/admin/categories`,
            media: `GET|POST|DELETE /api/${apiVersion}/admin/media`,
            users: `GET|POST|PUT|DELETE /api/${apiVersion}/admin/users`,
            settings: `GET|PUT /api/${apiVersion}/admin/settings`,
            dashboard: `GET /api/${apiVersion}/admin/dashboard/stats`
          }
        },
        authentication: {
          type: 'JWT Bearer Token',
          header: 'Authorization: Bearer <token>'
        },
        multiTenancy: {
          description: 'Todas as APIs são filtradas automaticamente por tenant_id',
          countryDetection: 'Usa CloudFront-Viewer-Country header para detectar país'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      logger.warn('404 Not Found:', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(404).json({
        error: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      // Log error with context
      const errorContext = {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.correlationId,
        userId: req.user?.id,
        tenantId: req.user?.tenantId
      };

      logger.error('Unhandled error:', errorContext);

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      const errorResponse = {
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        correlationId: req.correlationId,
        timestamp: new Date().toISOString()
      };

      if (isDevelopment) {
        errorResponse.details = {
          message: error.message,
          stack: error.stack
        };
      }

      res.status(error.status || 500).json(errorResponse);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', { reason, promise });
      this.gracefulShutdown('unhandledRejection');
    });

    // Handle SIGTERM (Docker, Kubernetes)
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  async gracefulShutdown(signal) {
    logger.info(`Graceful shutdown initiated by ${signal}`);

    // Stop accepting new requests
    if (this.server) {
      this.server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Close database connections
          await db.close();
          logger.info('Database connections closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force close after timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout
    } else {
      process.exit(0);
    }
  }

  async initialize() {
    try {
      logger.info('Initializing Cruzeiro Academy CMS...');

      // Initialize database connection
      await db.initialize();
      logger.info('Database connection established');

      // Start HTTP server
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        logger.info(`Server started successfully`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          pid: process.pid
        });

        // Log configuration status
        logger.info('Service configuration:', {
          database: !!process.env.DATABASE_URL,
          s3Upload: !!(process.env.S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID),
          cloudWatch: !!process.env.CLOUDWATCH_LOG_GROUP,
          secretsManager: !!process.env.DB_SECRET_NAME
        });
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  async stop() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
    await db.close();
  }
}

// Initialize and start server
const cms = new CruzeiroAcademyCMS();

cms.initialize().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default cms;
