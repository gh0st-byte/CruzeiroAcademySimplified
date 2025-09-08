import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../config/database.js';
import logger from '../config/logger.js';
import countryMiddleware from '../middleware/country.js';
import { optionalAuth } from '../middleware/auth.js';
import locationTagController from '../controllers/locationTagController.js';

const router = express.Router();

// Rate limiting para endpoints públicos
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP por janela
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limiting e middlewares de país
router.use(publicRateLimit);
router.use(countryMiddleware.autoCountryFilter);
router.use(optionalAuth);

// ===================================================================
// ENDPOINTS PÚBLICOS - Conteúdos
// ===================================================================

// Listar conteúdos publicados (filtrados por país)
router.get('/contents', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      content_type,
      language,
      featured,
      search,
      locationTagId
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir filtros dinâmicos
    const { whereClause, params, paramIndex } = req.buildCountryFilter();
    let currentParamIndex = paramIndex;
    
    let additionalWhere = '';
    
    if (category) {
      additionalWhere += ` AND cat.slug = $${currentParamIndex}`;
      params.push(category);
      currentParamIndex++;
    }
    
    if (content_type) {
      additionalWhere += ` AND c.content_type = $${currentParamIndex}`;
      params.push(content_type);
      currentParamIndex++;
    }
    
    if (language) {
      additionalWhere += ` AND c.language = $${currentParamIndex}`;
      params.push(language);
      currentParamIndex++;
    }
    
    if (featured === 'true') {
      additionalWhere += ` AND c.is_featured = true`;
    }
    
    if (search) {
      additionalWhere += ` AND (c.title ILIKE $${currentParamIndex} OR c.excerpt ILIKE $${currentParamIndex})`;
      params.push(`%${search}%`);
      currentParamIndex++;
    }

    // Filtro por locationTagId
    if (locationTagId) {
      additionalWhere += ` AND EXISTS (
        SELECT 1 
        FROM content_location_tags clt
        WHERE clt.content_id = c.id AND clt.location_tag_id = $${currentParamIndex}
      )`;
      params.push(locationTagId);
      currentParamIndex++;
    }

    const query = `
      SELECT 
        c.id,
        c.title,
        c.slug,
        c.excerpt,
        c.featured_image_url,
        c.content_type,
        c.language,
        c.is_featured,
        c.view_count,
        c.published_at,
        cat.name as category_name,
        cat.slug as category_slug,
        u.first_name || ' ' || u.last_name as author_name,
        s.name as school_name,
        s.country,
        s.language as school_language
      FROM contents c
      JOIN schools s ON c.tenant_id = s.id
      JOIN cms_users u ON c.author_id = u.id
      LEFT JOIN content_categories cat ON c.category_id = cat.id
      WHERE ${whereClause}
        AND c.status = 'published'
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
        ${additionalWhere}
      ORDER BY 
        c.is_featured DESC,
        c.published_at DESC
      LIMIT $${currentParamIndex} OFFSET $${currentParamIndex + 1}
    `;
    
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM contents c
      JOIN schools s ON c.tenant_id = s.id
      LEFT JOIN content_categories cat ON c.category_id = cat.id
      WHERE ${whereClause}
        AND c.status = 'published'
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
        ${additionalWhere}
    `;
    
    const countResult = await db.query(countQuery, params.slice(0, -2)); // Remove limit e offset
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      contents: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      location: req.location,
      targetSchool: req.targetSchool
    });
    
  } catch (error) {
    logger.error('Error fetching public contents:', error);
    res.status(500).json({
      error: 'Failed to fetch contents',
      code: 'FETCH_CONTENTS_ERROR'
    });
  }
});

// Obter conteúdo específico por slug
router.get('/contents/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { language } = req.query;
    
    const { whereClause, params, paramIndex } = req.buildCountryFilter();
    
    let languageFilter = '';
    if (language) {
      languageFilter = ` AND c.language = $${paramIndex}`;
      params.push(language);
    } else if (req.targetSchool && req.targetSchool.language) {
      languageFilter = ` AND c.language = $${paramIndex}`;
      params.push(req.targetSchool.language);
    }
    
    params.push(slug);
    
    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.slug as category_slug,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar,
        s.name as school_name,
        s.country,
        s.timezone
      FROM contents c
      JOIN schools s ON c.tenant_id = s.id
      JOIN cms_users u ON c.author_id = u.id
      LEFT JOIN content_categories cat ON c.category_id = cat.id
      WHERE ${whereClause}
        AND c.slug = $${params.length}
        AND c.status = 'published'
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
        ${languageFilter}
      LIMIT 1
    `;
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Content not found',
        code: 'CONTENT_NOT_FOUND'
      });
    }
    
    const content = result.rows[0];
    
    // Incrementar contador de visualizações
    await db.query(`
      UPDATE contents 
      SET view_count = view_count + 1 
      WHERE id = $1
    `, [content.id]);
    
    res.json({
      content: {
        ...content,
        view_count: content.view_count + 1
      }
    });
    
  } catch (error) {
    logger.error('Error fetching content by slug:', error);
    res.status(500).json({
      error: 'Failed to fetch content',
      code: 'FETCH_CONTENT_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS PÚBLICOS - Categorias
// ===================================================================

// Listar categorias (filtradas por país)
router.get('/categories', async (req, res) => {
  try {
    const { whereClause, params } = req.buildCountryFilter();
    
    const query = `
      SELECT 
        cat.*,
        COUNT(c.id) as content_count
      FROM content_categories cat
      JOIN schools s ON cat.tenant_id = s.id
      LEFT JOIN contents c ON cat.id = c.category_id 
        AND c.status = 'published' 
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
      WHERE ${whereClause} AND cat.is_active = true
      GROUP BY cat.id, cat.name, cat.slug, cat.description, cat.sort_order, cat.created_at
      ORDER BY cat.sort_order ASC, cat.name ASC
    `;
    
    const result = await db.query(query, params);
    
    res.json({
      categories: result.rows,
      location: req.location,
      targetSchool: req.targetSchool
    });
    
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      code: 'FETCH_CATEGORIES_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS PÚBLICOS - Escolas/Informações
// ===================================================================

// Listar escolas disponíveis
router.get('/schools', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        country,
        country_name,
        timezone,
        language,
        currency,
        domain,
        slug
      FROM schools
      WHERE status = 'active'
      ORDER BY name ASC
    `;
    
    const result = await db.query(query);
    
    res.json({
      schools: result.rows,
      detectedLocation: req.location
    });
    
  } catch (error) {
    logger.error('Error fetching schools:', error);
    res.status(500).json({
      error: 'Failed to fetch schools',
      code: 'FETCH_SCHOOLS_ERROR'
    });
  }
});

// Obter informações da escola por slug ou país
router.get('/schools/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Tentar buscar por slug primeiro, depois por país
    let query = `
      SELECT *
      FROM schools
      WHERE (slug = $1 OR country = $1) AND status = 'active'
      LIMIT 1
    `;
    
    const result = await db.query(query, [identifier.toUpperCase()]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'School not found',
        code: 'SCHOOL_NOT_FOUND'
      });
    }
    
    res.json({
      school: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error fetching school:', error);
    res.status(500).json({
      error: 'Failed to fetch school',
      code: 'FETCH_SCHOOL_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS PÚBLICOS - Configurações do Site
// ===================================================================

// Obter configurações públicas do site
router.get('/settings', async (req, res) => {
  try {
    const { whereClause, params } = req.buildCountryFilter();
    
    const query = `
      SELECT setting_key, setting_value, setting_type
      FROM site_settings ss
      JOIN schools s ON ss.tenant_id = s.id
      WHERE ${whereClause} AND ss.is_public = true
      ORDER BY setting_key
    `;
    
    const result = await db.query(query, params);
    
    // Converter para objeto para facilitar uso
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
      
      settings[row.setting_key] = value;
    });
    
    res.json({
      settings,
      location: req.location,
      targetSchool: req.targetSchool
    });
    
  } catch (error) {
    logger.error('Error fetching public settings:', error);
    res.status(500).json({
      error: 'Failed to fetch settings',
      code: 'FETCH_SETTINGS_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS PÚBLICOS - Navegação/Menus
// ===================================================================

// Obter menus de navegação
router.get('/menus/:location', async (req, res) => {
  try {
    const { location } = req.params; // header, footer, sidebar
    const { whereClause, params, paramIndex } = req.buildCountryFilter();
    
    params.push(location);
    
    const menusQuery = `
      SELECT m.*
      FROM navigation_menus m
      JOIN schools s ON m.tenant_id = s.id
      WHERE ${whereClause} 
        AND m.location = $${paramIndex}
        AND m.is_active = true
      ORDER BY m.name
    `;
    
    const menusResult = await db.query(menusQuery, params);
    
    if (menusResult.rows.length === 0) {
      return res.json({
        menus: [],
        location: req.location,
        targetSchool: req.targetSchool
      });
    }
    
    // Buscar itens dos menus
    const menuIds = menusResult.rows.map(m => m.id);
    const placeholders = menuIds.map((_, i) => `$${i + 1}`).join(',');
    
    const itemsQuery = `
      SELECT 
        mi.*,
        c.title as content_title,
        c.slug as content_slug
      FROM navigation_menu_items mi
      LEFT JOIN contents c ON mi.content_id = c.id
      WHERE mi.menu_id IN (${placeholders}) AND mi.is_active = true
      ORDER BY mi.menu_id, mi.sort_order ASC, mi.title ASC
    `;
    
    const itemsResult = await db.query(itemsQuery, menuIds);
    
    // Organizar itens por menu
    const menusWithItems = menusResult.rows.map(menu => {
      const menuItems = itemsResult.rows.filter(item => item.menu_id === menu.id);
      
      // Organizar itens em árvore (com parent/child)
      const buildMenuTree = (items, parentId = null) => {
        return items
          .filter(item => item.parent_id === parentId)
          .map(item => ({
            ...item,
            children: buildMenuTree(items, item.id)
          }));
      };
      
      return {
        ...menu,
        items: buildMenuTree(menuItems)
      };
    });
    
    res.json({
      menus: menusWithItems,
      location: req.location,
      targetSchool: req.targetSchool
    });
    
  } catch (error) {
    logger.error('Error fetching navigation menus:', error);
    res.status(500).json({
      error: 'Failed to fetch menus',
      code: 'FETCH_MENUS_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS PÚBLICOS - Busca
// ===================================================================

// Busca global de conteúdos
router.get('/search', async (req, res) => {
  try {
    const { q: query, page = 1, limit = 10, content_type, category } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters',
        code: 'INVALID_SEARCH_QUERY'
      });
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { whereClause, params, paramIndex } = req.buildCountryFilter();
    let currentParamIndex = paramIndex;
    
    const searchTerm = `%${query.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    currentParamIndex += 3;
    
    let additionalWhere = '';
    
    if (content_type) {
      additionalWhere += ` AND c.content_type = $${currentParamIndex}`;
      params.push(content_type);
      currentParamIndex++;
    }
    
    if (category) {
      additionalWhere += ` AND cat.slug = $${currentParamIndex}`;
      params.push(category);
      currentParamIndex++;
    }
    
    const searchQuery = `
      SELECT 
        c.id,
        c.title,
        c.slug,
        c.excerpt,
        c.featured_image_url,
        c.content_type,
        c.published_at,
        cat.name as category_name,
        cat.slug as category_slug,
        s.name as school_name,
        -- Relevance score
        (
          CASE WHEN c.title ILIKE $${paramIndex} THEN 3 ELSE 0 END +
          CASE WHEN c.excerpt ILIKE $${paramIndex + 1} THEN 2 ELSE 0 END +
          CASE WHEN c.body ILIKE $${paramIndex + 2} THEN 1 ELSE 0 END
        ) as relevance
      FROM contents c
      JOIN schools s ON c.tenant_id = s.id
      LEFT JOIN content_categories cat ON c.category_id = cat.id
      WHERE ${whereClause}
        AND c.status = 'published'
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
        AND (
          c.title ILIKE $${paramIndex} OR 
          c.excerpt ILIKE $${paramIndex + 1} OR 
          c.body ILIKE $${paramIndex + 2}
        )
        ${additionalWhere}
      ORDER BY relevance DESC, c.published_at DESC
      LIMIT $${currentParamIndex} OFFSET $${currentParamIndex + 1}
    `;
    
    params.push(parseInt(limit), offset);
    
    const result = await db.query(searchQuery, params);
    
    res.json({
      results: result.rows,
      query,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length
      },
      location: req.location,
      targetSchool: req.targetSchool
    });
    
  } catch (error) {
    logger.error('Error in search:', error);
    res.status(500).json({
      error: 'Search failed',
      code: 'SEARCH_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS PÚBLICOS - Estatísticas
// ===================================================================

// Estatísticas básicas da escola/tenant
router.get('/stats', async (req, res) => {
  try {
    const { whereClause, params } = req.buildCountryFilter();
    
    const query = `
      SELECT 
        s.name as school_name,
        s.country,
        COUNT(DISTINCT c.id) as total_contents,
        COUNT(DISTINCT CASE WHEN c.status = 'published' THEN c.id END) as published_contents,
        COUNT(DISTINCT cat.id) as total_categories,
        COUNT(DISTINCT CASE WHEN c.is_featured = true THEN c.id END) as featured_contents,
        SUM(c.view_count) as total_views
      FROM schools s
      LEFT JOIN contents c ON s.id = c.tenant_id
      LEFT JOIN content_categories cat ON s.id = cat.tenant_id AND cat.is_active = true
      WHERE ${whereClause}
      GROUP BY s.id, s.name, s.country
    `;
    
    const result = await db.query(query, params);
    
    res.json({
      stats: result.rows[0] || {},
      location: req.location,
      targetSchool: req.targetSchool
    });
    
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      code: 'FETCH_STATS_ERROR'
    });
  }
});

// ===================================================================
// ENDPOINTS PÚBLICOS - Tags de Localização
// ===================================================================

// Listar tags de localização
router.get('/location-tags', locationTagController.list);

export default router;
