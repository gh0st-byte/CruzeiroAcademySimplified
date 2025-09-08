import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import authService from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import db from '../config/database.js';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting para autenticação (mais restritivo)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 tentativas de login por IP
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Schema de validação para login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

// Schema de validação para refresh token
const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// ===================================================================
// ENDPOINTS DE AUTENTICAÇÃO
// ===================================================================

// Login de usuário
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details.map(d => d.message)
      });
    }

    const { email, password } = value;
    const clientIP = req.ip;
    const userAgent = req.get('User-Agent');

    const result = await authService.authenticateUser(
      email,
      password,
      clientIP,
      userAgent
    );

    // Set HTTP-only cookie for refresh token (optional, mais seguro)
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      },
      user: result.user
    });

  } catch (error) {
    logger.error('Login error:', error);
    
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    // Tentar obter refresh token do body ou cookie
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    // Update cookie with new refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    
    // Clear invalid refresh token cookie
    res.clearCookie('refreshToken');
    
    res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    
    if (refreshToken) {
      try {
        const decoded = await authService.verifyToken(refreshToken, 'refresh');
        await authService.revokeSession(decoded.sessionId);
      } catch (error) {
        // Session já pode estar inválida
        logger.debug('Error revoking session during logout:', error.message);
      }
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    logger.audit('user_logout', 'cms_users', req.user.id, req.user.tenantId, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// Logout de todas as sessões
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    await authService.revokeAllUserSessions(req.user.id);
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    logger.audit('user_logout_all', 'cms_users', req.user.id, req.user.tenantId, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'All sessions revoked successfully'
    });

  } catch (error) {
    logger.error('Logout all error:', error);
    res.status(500).json({
      error: 'Failed to revoke all sessions',
      code: 'LOGOUT_ALL_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS DE PERFIL
// ===================================================================

// Obter perfil do usuário atual
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        tenantId: req.user.tenantId,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        schoolName: req.user.schoolName,
        country: req.user.country
      }
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      code: 'FETCH_PROFILE_ERROR'
    });
  }
});

// Verificar validade do token
router.get('/verify', authenticate, async (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      tenantId: req.user.tenantId,
      role: req.user.role,
      email: req.user.email
    }
  });
});

// ===================================================================
// ENDPOINTS DE SESSÕES
// ===================================================================

// Listar sessões ativas do usuário
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        ip_address,
        user_agent,
        created_at,
        expires_at,
        CASE WHEN session_token LIKE '%' || $2 || '%' THEN true ELSE false END as is_current
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY created_at DESC
    `, [req.user.id, req.headers.authorization?.substring(7, 20) || '']);

    res.json({
      sessions: result.rows.map(session => ({
        id: session.id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        isCurrent: session.is_current
      }))
    });

  } catch (error) {
    logger.error('Error fetching user sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions',
      code: 'FETCH_SESSIONS_ERROR'
    });
  }
});

// Revogar sessão específica
router.delete('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Verificar se a sessão pertence ao usuário
    const sessionResult = await db.query(`
      SELECT id FROM user_sessions
      WHERE id = $1 AND user_id = $2 AND is_active = true
    `, [sessionId, req.user.id]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    await authService.revokeSession(sessionId);
    
    logger.audit('session_revoked', 'user_sessions', req.user.id, req.user.tenantId, {
      revokedSessionId: sessionId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });

  } catch (error) {
    logger.error('Error revoking session:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      code: 'REVOKE_SESSION_ERROR'
    });
  }
});

export default router;
