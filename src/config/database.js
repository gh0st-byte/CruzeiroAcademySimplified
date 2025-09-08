import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import logger from './logger.js';

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.secretsManager = new SecretsManagerClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
  }

  async getSecretsFromAWS() {
    if (process.env.NODE_ENV !== 'production') {
      return {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      };
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: process.env.DB_SECRET_NAME,
      });
      
      const response = await this.secretsManager.send(command);
      const secret = JSON.parse(response.SecretString);
      
      return {
        host: secret.host,
        port: secret.port,
        database: secret.dbname,
        username: secret.username,
        password: secret.password,
      };
    } catch (error) {
      logger.error('Failed to retrieve database credentials from Secrets Manager:', error);
      throw new Error('Database configuration error');
    }
  }

  async initialize() {
    try {
      const dbConfig = await this.getSecretsFromAWS();
      
      this.pool = new Pool({
        host: dbConfig.host,
        port: parseInt(dbConfig.port || 5432),
        database: dbConfig.database,
        user: dbConfig.username,
        password: dbConfig.password,
        max: parseInt(process.env.DB_MAX_CONNECTIONS || 20),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || 30000),
        connectionTimeoutMillis: 10000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Database connection pool initialized successfully');
      return this.pool;
    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  async query(text, params, tenantId = null) {
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        logger.warn('Slow query detected:', {
          query: text.substring(0, 100) + '...',
          duration,
          tenantId,
          rowCount: result.rowCount
        });
      }

      return result;
    } catch (error) {
      logger.error('Database query error:', {
        query: text.substring(0, 100) + '...',
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection pool closed');
    }
  }

  // Health check method
  async healthCheck() {
    try {
      const result = await this.pool.query('SELECT 1');
      return { 
        status: 'healthy', 
        connections: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message 
      };
    }
  }
}

export default new DatabaseConnection();
