import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';

const isProduction = process.env.NODE_ENV === 'production';

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    return JSON.stringify({
      '@timestamp': timestamp,
      level,
      message,
      service: 'cruzeiro-academy-cms',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      ...meta
    });
  })
);

// Create transports array
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: isProduction ? 'info' : 'debug',
    format: isProduction 
      ? customFormat 
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        )
  })
];

// Add CloudWatch transport for production
if (isProduction && process.env.CLOUDWATCH_LOG_GROUP) {
  transports.push(
    new WinstonCloudWatch({
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP,
      logStreamName: process.env.CLOUDWATCH_LOG_STREAM || 'backend',
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      messageFormatter: (logObject) => JSON.stringify(logObject),
      jsonMessage: true,
      level: 'info'
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: customFormat,
  transports,
  exitOnError: false
});

// Add request correlation ID
logger.withCorrelationId = (correlationId) => {
  return logger.child({ correlationId });
};

// Add tenant context
logger.withTenant = (tenantId, schoolName = null) => {
  return logger.child({ 
    tenantId, 
    schoolName,
    context: 'tenant-operation'
  });
};

// Add user context
logger.withUser = (userId, userEmail = null, role = null) => {
  return logger.child({ 
    userId, 
    userEmail,
    role,
    context: 'user-operation'
  });
};

// Audit logging
logger.audit = (action, resource, userId, tenantId, details = {}) => {
  logger.info('Audit Log', {
    action,
    resource,
    userId,
    tenantId,
    details,
    context: 'audit',
    timestamp: new Date().toISOString()
  });
};

// Performance logging
logger.performance = (operation, duration, metadata = {}) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger.log(level, `Performance: ${operation}`, {
    operation,
    duration,
    context: 'performance',
    ...metadata
  });
};

// Security logging
logger.security = (event, userId = null, ip = null, details = {}) => {
  logger.warn('Security Event', {
    event,
    userId,
    ip,
    details,
    context: 'security',
    timestamp: new Date().toISOString()
  });
};

export default logger;
