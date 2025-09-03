import authService from '../services/authService.js';
import logger from '../config/logger.js';

// Middleware para autenticação JWT
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = await authService.verifyToken(token);
      
      // Get full user data
      const user = await authService.getUserByToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      }

      // Attach user to request
      req.user = {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        schoolName: user.school_name,
        country: user.country
      };

      // Attach tenant-aware logger
      req.logger = logger.withUser(user.id, user.email, user.role)
                        .withTenant(user.tenant_id, user.school_name);

      next();
    } catch (tokenError) {
      logger.security('Invalid token in request', null, req.ip, {
        error: tokenError.message,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Authentication service unavailable',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Middleware para autorização por roles
export const authorize = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    // Convert single role to array
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    // Super admin has access to everything
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has required role
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      logger.security('Unauthorized access attempt', req.user.id, req.ip, {
        requiredRoles: roles,
        userRole: req.user.role,
        resource: req.originalUrl
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Middleware para verificar se o recurso pertence ao tenant do usuário
export const checkTenantAccess = (resourceTenantIdField = 'tenant_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    // Super admin pode acessar qualquer tenant
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Para criação de recursos, garantir que o tenant_id seja do usuário
    if (req.method === 'POST' && req.body) {
      if (!req.body[resourceTenantIdField]) {
        req.body[resourceTenantIdField] = req.user.tenantId;
      } else if (req.body[resourceTenantIdField] !== req.user.tenantId) {
        logger.security('Tenant access violation attempt', req.user.id, req.ip, {
          userTenant: req.user.tenantId,
          requestedTenant: req.body[resourceTenantIdField],
          resource: req.originalUrl
        });
        
        return res.status(403).json({
          error: 'Cannot access resources from different tenant',
          code: 'TENANT_ACCESS_VIOLATION'
        });
      }
    }

    // Para parâmetros de URL
    if (req.params.tenantId && req.params.tenantId !== req.user.tenantId) {
      return res.status(403).json({
        error: 'Cannot access resources from different tenant',
        code: 'TENANT_ACCESS_VIOLATION'
      });
    }

    next();
  };
};

// Middleware para operações somente leitura (viewers)
export const requireWriteAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }

  const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];
  const writeRoles = ['super_admin', 'admin', 'editor'];

  // Se for operação de leitura, permitir viewers também
  if (readOnlyMethods.includes(req.method)) {
    return next();
  }

  // Para operações de escrita, verificar role
  if (!writeRoles.includes(req.user.role)) {
    logger.security('Write access denied for viewer role', req.user.id, req.ip, {
      method: req.method,
      resource: req.originalUrl
    });
    
    return res.status(403).json({
      error: 'Write access denied',
      code: 'READ_ONLY_ACCESS',
      message: 'Viewer role only has read access'
    });
  }

  next();
};

// Middleware para operações de admin
export const requireAdminAccess = authorize(['super_admin', 'admin']);

// Middleware opcional para endpoints públicos
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const user = await authService.getUserByToken(token);
      
      if (user) {
        req.user = {
          id: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          role: user.role,
          schoolName: user.school_name,
          country: user.country
        };
      }
    } catch (error) {
      // Ignorar erros em auth opcional
      logger.debug('Optional auth failed (ignored):', error.message);
    }
  }

  next();
};

export default {
  authenticate,
  authorize,
  checkTenantAccess,
  requireWriteAccess,
  requireAdminAccess,
  optionalAuth
};
