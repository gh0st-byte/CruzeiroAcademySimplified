import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireWriteAccess, checkTenantAccess, requireAdminAccess } from '../middleware/auth.js';
import contentController from '../controllers/contentController.js';
import uploadService from '../services/uploadService.js';
import db from '../config/database.js';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting para endpoints administrativos
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // máximo 500 requests por IP por janela
  message: {
    error: 'Too many admin requests',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar middlewares base para todas as rotas admin
router.use(adminRateLimit);
router.use(authenticate);
router.use(checkTenantAccess());

// ===================================================================
// GESTÃO DE CONTEÚDOS
// ===================================================================

// Listar conteúdos
router.get('/contents', contentController.listContents);

// Obter conteúdo específico
router.get('/contents/:id', contentController.getContent);

// Criar novo conteúdo
router.post('/contents', requireWriteAccess, contentController.createContent);

// Atualizar conteúdo
router.put('/contents/:id', requireWriteAccess, contentController.updateContent);

// Deletar conteúdo
router.delete('/contents/:id', requireWriteAccess, contentController.deleteContent);

// Publicar/despublicar conteúdo
router.patch('/contents/:id/publish', requireWriteAccess, contentController.togglePublishContent);

// Duplicar conteúdo
router.post('/contents/:id/duplicate', requireWriteAccess, contentController.duplicateContent);

// Conteúdos relacionados
router.get('/contents/:id/related', contentController.getRelatedContents);

// ===================================================================
// GESTÃO DE CATEGORIAS
// ===================================================================

// Listar categorias
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        cat.*,
        parent.name as parent_name,
        COUNT(c.id) as content_count
      FROM content_categories cat
      LEFT JOIN content_categories parent ON cat.parent_id = parent.id
      LEFT JOIN contents c ON cat.id = c.category_id AND c.status = 'published'
      WHERE cat.tenant_id = $1
      GROUP BY cat.id, parent.name
      ORDER BY cat.sort_order ASC, cat.name ASC
    `, [req.user.tenantId]);

    res.json({
      categories: result.rows
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      code: 'FETCH_CATEGORIES_ERROR'
    });
  }
});

// Criar categoria
router.post('/categories', requireWriteAccess, async (req, res) => {
  try {
    const { name, slug, description, parent_id, sort_order = 0 } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: 'Name and slug are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Verificar se slug já existe
    const existingSlug = await db.query(`
      SELECT id FROM content_categories 
      WHERE slug = $1 AND tenant_id = $2
    `, [slug, req.user.tenantId]);

    if (existingSlug.rows.length > 0) {
      return res.status(409).json({
        error: 'Slug already exists',
        code: 'SLUG_EXISTS'
      });
    }

    const result = await db.query(`
      INSERT INTO content_categories (tenant_id, name, slug, description, parent_id, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user.tenantId, name, slug, description, parent_id, sort_order]);

    logger.audit('category_created', 'content_categories', req.user.id, req.user.tenantId, {
      categoryId: result.rows[0].id,
      name
    });

    res.status(201).json({
      success: true,
      category: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating category:', error);
    res.status(500).json({
      error: 'Failed to create category',
      code: 'CREATE_CATEGORY_ERROR'
    });
  }
});

// ===================================================================
// GESTÃO DE MÍDIA/UPLOAD
// ===================================================================

// Listar arquivos de mídia
router.get('/media', async (req, res) => {
  try {
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      mimeType: req.query.type,
      search: req.query.search,
      sortBy: req.query.sort_by,
      sortOrder: req.query.sort_order
    };

    const result = await uploadService.getMediaFiles(req.user.tenantId, options);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching media files:', error);
    res.status(500).json({
      error: 'Failed to fetch media files',
      code: 'FETCH_MEDIA_ERROR'
    });
  }
});

// Upload de arquivos
router.post('/media/upload', requireWriteAccess, async (req, res) => {
  try {
    const upload = uploadService.getMulterConfig();
    
    upload.array('files', 10)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: err.message,
          code: 'UPLOAD_ERROR'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'No files provided',
          code: 'NO_FILES'
        });
      }

      const { results, errors } = await uploadService.processMultipleUploads(
        req.files,
        req.user.tenantId,
        req.user.id,
        'uploads'
      );

      res.json({
        success: true,
        uploaded: results,
        errors: errors,
        summary: {
          total: req.files.length,
          successful: results.length,
          failed: errors.length
        }
      });
    });
  } catch (error) {
    logger.error('Error in file upload:', error);
    res.status(500).json({
      error: 'Upload failed',
      code: 'UPLOAD_FAILED'
    });
  }
});

// Gerar URL assinada para upload direto
router.post('/media/presigned-upload', requireWriteAccess, async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({
        error: 'fileName and contentType are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await uploadService.generatePresignedUploadUrl(
      req.user.tenantId,
      fileName,
      contentType,
      300 // 5 minutos
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error generating presigned URL:', error);
    res.status(500).json({
      error: 'Failed to generate upload URL',
      code: 'PRESIGNED_URL_ERROR'
    });
  }
});

// Deletar arquivo de mídia
router.delete('/media/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    await uploadService.deleteMediaFile(id, req.user.id, req.user.tenantId);
    
    res.json({
      success: true,
      message: 'Media file deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Media file not found') {
      return res.status(404).json({
        error: 'Media file not found',
        code: 'MEDIA_NOT_FOUND'
      });
    }
    
    logger.error('Error deleting media file:', error);
    res.status(500).json({
      error: 'Failed to delete media file',
      code: 'DELETE_MEDIA_ERROR'
    });
  }
});

// ===================================================================
// GESTÃO DE USUÁRIOS (Admin apenas)
// ===================================================================

// Listar usuários do tenant
router.get('/users', requireAdminAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, active, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = 'tenant_id = $1';
    const params = [req.user.tenantId];
    let paramIndex = 2;

    if (role) {
      whereClause += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (active !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(active === 'true');
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await db.query(`
      SELECT 
        id, email, first_name, last_name, role, avatar_url, 
        is_active, last_login, created_at, updated_at
      FROM cms_users
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM cms_users WHERE ${whereClause}
    `, params.slice(0, -2));

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      code: 'FETCH_USERS_ERROR'
    });
  }
});

// ===================================================================
// GESTÃO DE CONFIGURAÇÕES DO SITE
// ===================================================================

// Listar configurações do site
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT setting_key, setting_value, setting_type, description, is_public, updated_at
      FROM site_settings
      WHERE tenant_id = $1
      ORDER BY setting_key
    `, [req.user.tenantId]);

    // Converter para objeto estruturado
    const settings = {};
    result.rows.forEach(row => {
      let value = row.setting_value;
      
      // Parse values based on type
      switch (row.setting_type) {
        case 'boolean':
          value = value === 'true';
          break;
        case 'number':
          value = parseFloat(value);
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if invalid JSON
          }
          break;
      }
      
      settings[row.setting_key] = {
        value,
        type: row.setting_type,
        description: row.description,
        isPublic: row.is_public,
        updatedAt: row.updated_at
      };
    });

    res.json({
      settings
    });
  } catch (error) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({
      error: 'Failed to fetch settings',
      code: 'FETCH_SETTINGS_ERROR'
    });
  }
});

// Atualizar configuração
router.put('/settings/:key', requireAdminAccess, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, type = 'text', description, is_public = false } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        error: 'Setting value is required',
        code: 'MISSING_VALUE'
      });
    }

    // Validar tipo de valor
    let processedValue = value;
    if (type === 'json' && typeof value === 'object') {
      processedValue = JSON.stringify(value);
    } else if (type === 'boolean') {
      processedValue = String(Boolean(value));
    } else {
      processedValue = String(value);
    }

    const result = await db.query(`
      INSERT INTO site_settings (tenant_id, setting_key, setting_value, setting_type, description, is_public, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, setting_key) 
      DO UPDATE SET
        setting_value = $3,
        setting_type = $4,
        description = $5,
        is_public = $6,
        updated_by = $7,
        updated_at = NOW()
      RETURNING *
    `, [req.user.tenantId, key, processedValue, type, description, is_public, req.user.id]);

    logger.audit('setting_updated', 'site_settings', req.user.id, req.user.tenantId, {
      settingKey: key,
      newValue: type === 'json' ? '[JSON]' : processedValue
    });

    res.json({
      success: true,
      setting: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating setting:', error);
    res.status(500).json({
      error: 'Failed to update setting',
      code: 'UPDATE_SETTING_ERROR'
    });
  }
});

// ===================================================================
// GESTÃO DE MENUS DE NAVEGAÇÃO
// ===================================================================

// Listar menus
router.get('/menus', async (req, res) => {
  try {
    const menusResult = await db.query(`
      SELECT * FROM navigation_menus
      WHERE tenant_id = $1
      ORDER BY location, name
    `, [req.user.tenantId]);

    // Buscar itens dos menus
    const menuIds = menusResult.rows.map(m => m.id);
    let menuItems = [];
    
    if (menuIds.length > 0) {
      const placeholders = menuIds.map((_, i) => `$${i + 2}`).join(',');
      const itemsResult = await db.query(`
        SELECT 
          mi.*,
          c.title as content_title
        FROM navigation_menu_items mi
        LEFT JOIN contents c ON mi.content_id = c.id
        WHERE mi.menu_id IN (${placeholders})
        ORDER BY mi.sort_order ASC
      `, [req.user.tenantId, ...menuIds]);
      
      menuItems = itemsResult.rows;
    }

    // Organizar itens por menu
    const menusWithItems = menusResult.rows.map(menu => ({
      ...menu,
      items: menuItems.filter(item => item.menu_id === menu.id)
    }));

    res.json({
      menus: menusWithItems
    });
  } catch (error) {
    logger.error('Error fetching menus:', error);
    res.status(500).json({
      error: 'Failed to fetch menus',
      code: 'FETCH_MENUS_ERROR'
    });
  }
});

// ===================================================================
// ESTATÍSTICAS E DASHBOARD
// ===================================================================

// Dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Determinar filtro de período
    let periodFilter = '';
    switch (period) {
      case '24h':
        periodFilter = "AND created_at > NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        periodFilter = "AND created_at > NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        periodFilter = "AND created_at > NOW() - INTERVAL '30 days'";
        break;
      default:
        periodFilter = "AND created_at > NOW() - INTERVAL '7 days'";
    }

    // Estatísticas gerais
    const generalStats = await db.query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_contents,
        COUNT(DISTINCT CASE WHEN c.status = 'published' THEN c.id END) as published_contents,
        COUNT(DISTINCT CASE WHEN c.status = 'draft' THEN c.id END) as draft_contents,
        COUNT(DISTINCT cat.id) as total_categories,
        COUNT(DISTINCT mf.id) as total_media_files,
        SUM(c.view_count) as total_views
      FROM contents c
      LEFT JOIN content_categories cat ON c.tenant_id = cat.tenant_id
      LEFT JOIN media_files mf ON c.tenant_id = mf.tenant_id
      WHERE c.tenant_id = $1
    `, [req.user.tenantId]);

    // Conteúdos recentes
    const recentContents = await db.query(`
      SELECT 
        c.id, c.title, c.status, c.content_type, c.created_at,
        u.first_name || ' ' || u.last_name as author_name
      FROM contents c
      JOIN cms_users u ON c.author_id = u.id
      WHERE c.tenant_id = $1 ${periodFilter}
      ORDER BY c.created_at DESC
      LIMIT 10
    `, [req.user.tenantId]);

    // Top conteúdos por visualizações
    const topContents = await db.query(`
      SELECT 
        c.id, c.title, c.view_count, c.published_at,
        cat.name as category_name
      FROM contents c
      LEFT JOIN content_categories cat ON c.category_id = cat.id
      WHERE c.tenant_id = $1 AND c.status = 'published' AND c.view_count > 0
      ORDER BY c.view_count DESC
      LIMIT 10
    `, [req.user.tenantId]);

    res.json({
      period,
      stats: generalStats.rows[0],
      recentContents: recentContents.rows,
      topContents: topContents.rows
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      code: 'FETCH_DASHBOARD_ERROR'
    });
  }
});

// ===================================================================
// AUDITORIA E LOGS
// ===================================================================

// Logs de auditoria (Admin apenas)
router.get('/audit-logs', requireAdminAccess, async (req, res) => {
  try {
    const { page = 1, limit = 50, operation, table_name, user_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'tenant_id = $1';
    const params = [req.user.tenantId];
    let paramIndex = 2;

    if (operation) {
      whereClause += ` AND operation = $${paramIndex}`;
      params.push(operation);
      paramIndex++;
    }

    if (table_name) {
      whereClause += ` AND table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }

    if (user_id) {
      whereClause += ` AND user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    const result = await db.query(`
      SELECT 
        al.*,
        u.first_name || ' ' || u.last_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN cms_users u ON al.user_id = u.id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}
    `, params.slice(0, -2));

    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      error: 'Failed to fetch audit logs',
      code: 'FETCH_AUDIT_ERROR'
    });
  }
});

export default router;
