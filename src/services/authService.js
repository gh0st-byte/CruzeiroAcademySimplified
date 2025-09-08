import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import logger from '../config/logger.js';

class AuthService {
  constructor() {
    this.secretsManager = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.jwtSecret = null;
  }

  async getJWTSecret() {
    if (this.jwtSecret) {
      return this.jwtSecret;
    }

    if (process.env.NODE_ENV !== 'production') {
      this.jwtSecret = process.env.JWT_SECRET;
      return this.jwtSecret;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: process.env.JWT_SECRET_NAME,
      });
      
      const response = await this.secretsManager.send(command);
      const secret = JSON.parse(response.SecretString);
      this.jwtSecret = secret.jwt_secret;
      
      return this.jwtSecret;
    } catch (error) {
      logger.error('Failed to retrieve JWT secret from Secrets Manager:', error);
      throw new Error('JWT configuration error');
    }
  }

  async hashPassword(password) {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  async generateTokens(user) {
    const secret = await this.getJWTSecret();
    
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      type: 'access'
    };

    const refreshPayload = {
      userId: user.id,
      type: 'refresh',
      sessionId: uuidv4()
    };

    const accessToken = jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'cruzeiro-academy-cms',
      audience: 'cms-users'
    });

    const refreshToken = jwt.sign(refreshPayload, secret, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'cruzeiro-academy-cms',
      audience: 'cms-users'
    });

    // Store refresh token session
    await this.storeSession(refreshPayload.sessionId, user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  async verifyToken(token, tokenType = 'access') {
    try {
      const secret = await this.getJWTSecret();
      
      const decoded = jwt.verify(token, secret, {
        issuer: 'cruzeiro-academy-cms',
        audience: 'cms-users'
      });

      if (decoded.type !== tokenType) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      logger.security('Invalid token verification attempt', null, null, {
        error: error.message,
        tokenType
      });
      throw error;
    }
  }

  async storeSession(sessionId, userId, refreshToken, ipAddress = null, userAgent = null) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.query(`
      INSERT INTO user_sessions (id, user_id, session_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        session_token = $3,
        ip_address = $4,
        user_agent = $5,
        expires_at = $6,
        updated_at = NOW()
    `, [sessionId, userId, refreshToken, ipAddress, userAgent, expiresAt]);
  }

  async validateSession(sessionId) {
    const result = await db.query(`
      SELECT s.*, u.id as user_id, u.email, u.role, u.is_active
      FROM user_sessions s
      JOIN cms_users u ON s.user_id = u.id
      WHERE s.id = $1 AND s.is_active = true AND s.expires_at > NOW()
    `, [sessionId]);

    return result.rows[0] || null;
  }

  async revokeSession(sessionId) {
    await db.query(`
      UPDATE user_sessions 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [sessionId]);
  }

  async revokeAllUserSessions(userId) {
    await db.query(`
      UPDATE user_sessions 
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1
    `, [userId]);
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = await this.verifyToken(refreshToken, 'refresh');
      
      // Validate session
      const session = await this.validateSession(decoded.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }

      // Get updated user data
      const userResult = await db.query(`
        SELECT id, email, first_name, last_name, role, is_active
        FROM cms_users
        WHERE id = $1 AND is_active = true
      `, [decoded.userId]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found or inactive');
      }

      const user = userResult.rows[0];
      return await this.generateTokens(user);
    } catch (error) {
      logger.security('Failed refresh token attempt', decoded?.userId, null, {
        error: error.message
      });
      throw error;
    }
  }

  async authenticateUser(email, password, ipAddress = null, userAgent = null) {
    try {
      // Get user - sistema centralizado, apenas 2 super admins
      const result = await db.query(`
        SELECT *
        FROM cms_users
        WHERE email = $1 AND is_active = true
      `, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        logger.security('Failed login attempt - user not found', null, ipAddress, {
          email
        });
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        logger.security('Failed login attempt - invalid password', user.id, ipAddress, {
          email
        });
        throw new Error('Invalid credentials');
      }

      // Update last login
      await db.query(`
        UPDATE cms_users SET last_login = NOW() WHERE id = $1
      `, [user.id]);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      logger.audit('user_login', 'cms_users', user.id, null, {
        email,
        ipAddress,
        userAgent
      });

      return {
        tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          avatarUrl: user.avatar_url
        }
      };
    } catch (error) {
      if (error.message === 'Invalid credentials') {
        throw error;
      }
      logger.error('Authentication error:', error);
      throw new Error('Authentication failed');
    }
  }

  async getUserByToken(token) {
    try {
      const decoded = await this.verifyToken(token);
      
      const result = await db.query(`
        SELECT *
        FROM cms_users
        WHERE id = $1 AND is_active = true
      `, [decoded.userId]);

      return result.rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  // Clean expired sessions (should be run periodically)
  async cleanExpiredSessions() {
    const result = await db.query(`
      DELETE FROM user_sessions 
      WHERE expires_at < NOW() OR is_active = false
    `);
    
    logger.info(`Cleaned ${result.rowCount} expired sessions`);
    return result.rowCount;
  }
}

export default new AuthService();
