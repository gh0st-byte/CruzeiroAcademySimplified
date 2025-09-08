import Joi from 'joi';
import db from '../config/database.js';
import logger from '../config/logger.js';

// Schemas de validação
const contentSchema = Joi.object({
  title: Joi.string().min(1).max(500).required(),
  slug: Joi.string().min(1).max(200).pattern(/^[a-z0-9-]+$/).required(),
  excerpt: Joi.string().max(1000).allow('', null),
  body: Joi.string().required(),
  category_id: Joi.string().uuid().allow(null),
  featured_image_url: Joi.string().uri().allow('', null),
  meta_title: Joi.string().max(255).allow('', null),
  meta_description: Joi.string().max(500).allow('', null),
  status: Joi.string().valid('draft', 'published', 'archived', 'scheduled').default('draft'),
  language: Joi.string().max(10).default('pt-BR'),
  content_type: Joi.string().valid('article', 'page', 'news', 'event').default('article'),
  is_featured: Joi.boolean().default(false),
  published_at: Joi.date().allow(null),
  expires_at: Joi.date().allow(null),
  scheduled_at: Joi.date().allow(null),
  seo_settings: Joi.object().default({}),
  custom_fields: Joi.object().default({})
});

const updateContentSchema = contentSchema.fork(['title', 'slug', 'body'], (schema) => 
  schema.optional()
);

class ContentController {
  // Listar conteúdos (com filtro por tenant)
  async listContents(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        content_type,
        language,
        search,
        author_id,
        featured,
        sort_by = 'updated_at',
        sort_order = 'DESC',
        locationTagId
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let whereClause = 'c.tenant_id = $1';
      const params = [req.user.tenantId];
      let paramIndex = 2;

      // Aplicar filtros
      if (status) {
        whereClause += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (category) {
        whereClause += ` AND cat.slug = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (content_type) {
        whereClause += ` AND c.content_type = $${paramIndex}`;
        params.push(content_type);
        paramIndex++;
      }

      if (language) {
        whereClause += ` AND c.language = $${paramIndex}`;
        params.push(language);
        paramIndex++;
      }

      if (author_id) {
        whereClause += ` AND c.author_id = $${paramIndex}`;
        params.push(author_id);
        paramIndex++;
      }

      if (featured === 'true') {
        whereClause += ` AND c.is_featured = true`;
      }

      if (search) {
        whereClause += ` AND (c.title ILIKE $${paramIndex} OR c.excerpt ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Location tag filtering handled via SQL if needed
      if (locationTagId) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM content_location_tags clt 
          WHERE clt.content_id = c.id AND clt.location_tag_id = $${paramIndex}
        )`;
        params.push(locationTagId);
        paramIndex++;
      }

      // Query principal
      const query = `
        SELECT 
          c.*,
          cat.name as category_name,
          cat.slug as category_slug,
          u.first_name || ' ' || u.last_name as author_name,
          u.email as author_email
        FROM contents c
        LEFT JOIN content_categories cat ON c.category_id = cat.id
        JOIN cms_users u ON c.author_id = u.id
        WHERE ${whereClause}
        ORDER BY c.${sort_by} ${sort_order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(parseInt(limit), offset);

      const result = await db.query(query, params);

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM contents c
        LEFT JOIN content_categories cat ON c.category_id = cat.id
        WHERE ${whereClause}
      `;

      const countResult = await db.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].total);

      res.json({
        contents: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error('Error listing contents:', error);
      res.status(500).json({
        error: 'Failed to fetch contents',
        code: 'FETCH_CONTENTS_ERROR'
      });
    }
  }

  // Obter conteúdo por ID
  async getContent(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          c.*,
          cat.name as category_name,
          cat.slug as category_slug,
          u.first_name || ' ' || u.last_name as author_name,
          u.email as author_email
        FROM contents c
        LEFT JOIN content_categories cat ON c.category_id = cat.id
        JOIN cms_users u ON c.author_id = u.id
        WHERE c.id = $1 AND c.tenant_id = $2
      `;

      const result = await db.query(query, [id, req.user.tenantId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Content not found',
          code: 'CONTENT_NOT_FOUND'
        });
      }

      res.json({
        content: result.rows[0]
      });

    } catch (error) {
      logger.error('Error fetching content:', error);
      res.status(500).json({
        error: 'Failed to fetch content',
        code: 'FETCH_CONTENT_ERROR'
      });
    }
  }

  // Criar novo conteúdo
  async createContent(req, res) {
    try {
      const { error, value } = contentSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(d => d.message)
        });
      }

      // Verificar se slug já existe para este tenant
      const existingSlug = await db.query(`
        SELECT id FROM contents 
        WHERE slug = $1 AND tenant_id = $2 AND language = $3
      `, [value.slug, req.user.tenantId, value.language]);

      if (existingSlug.rows.length > 0) {
        return res.status(409).json({
          error: 'Slug already exists for this language',
          code: 'SLUG_EXISTS'
        });
      }

      const insertQuery = `
        INSERT INTO contents (
          tenant_id, author_id, category_id, title, slug, excerpt, body,
          featured_image_url, meta_title, meta_description, status, language,
          content_type, is_featured, published_at, expires_at, scheduled_at,
          seo_settings, custom_fields
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        req.user.tenantId,
        req.user.id,
        value.category_id,
        value.title,
        value.slug,
        value.excerpt,
        value.body,
        value.featured_image_url,
        value.meta_title,
        value.meta_description,
        value.status,
        value.language,
        value.content_type,
        value.is_featured,
        value.published_at,
        value.expires_at,
        value.scheduled_at,
        JSON.stringify(value.seo_settings),
        JSON.stringify(value.custom_fields)
      ]);

      const newContent = result.rows[0];

      logger.audit('content_created', 'contents', req.user.id, req.user.tenantId, {
        contentId: newContent.id,
        title: newContent.title,
        status: newContent.status
      });

      // Location tags association can be handled separately if needed

      res.status(201).json({
        success: true,
        content: newContent
      });

    } catch (error) {
      logger.error('Error creating content:', error);
      res.status(500).json({
        error: 'Failed to create content',
        code: 'CREATE_CONTENT_ERROR'
      });
    }
  }

  // Atualizar conteúdo
  async updateContent(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = updateContentSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(d => d.message)
        });
      }

      // Verificar se conteúdo existe e pertence ao tenant
      const existingContent = await db.query(`
        SELECT * FROM contents 
        WHERE id = $1 AND tenant_id = $2
      `, [id, req.user.tenantId]);

      if (existingContent.rows.length === 0) {
        return res.status(404).json({
          error: 'Content not found',
          code: 'CONTENT_NOT_FOUND'
        });
      }

      // Se mudando slug, verificar conflitos
      if (value.slug && value.slug !== existingContent.rows[0].slug) {
        const slugCheck = await db.query(`
          SELECT id FROM contents 
          WHERE slug = $1 AND tenant_id = $2 AND language = $3 AND id != $4
        `, [value.slug, req.user.tenantId, value.language || existingContent.rows[0].language, id]);

        if (slugCheck.rows.length > 0) {
          return res.status(409).json({
            error: 'Slug already exists for this language',
            code: 'SLUG_EXISTS'
          });
        }
      }

      // Construir query de update dinâmica
      const updateFields = [];
      const updateParams = [];
      let paramIndex = 1;

      Object.keys(value).forEach(key => {
        if (value[key] !== undefined) {
          if (key === 'seo_settings' || key === 'custom_fields') {
            updateFields.push(`${key} = $${paramIndex}`);
            updateParams.push(JSON.stringify(value[key]));
          } else {
            updateFields.push(`${key} = $${paramIndex}`);
            updateParams.push(value[key]);
          }
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_UPDATE_FIELDS'
        });
      }

      updateFields.push(`updated_at = NOW()`);
      updateParams.push(id, req.user.tenantId);

      const updateQuery = `
        UPDATE contents 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await db.query(updateQuery, updateParams);

      // Location tags association can be handled separately if needed

      logger.audit('content_updated', 'contents', req.user.id, req.user.tenantId, {
        contentId: id,
        updatedFields: Object.keys(value)
      });

      res.json({
        success: true,
        content: result.rows[0]
      });

    } catch (error) {
      logger.error('Error updating content:', error);
      res.status(500).json({
        error: 'Failed to update content',
        code: 'UPDATE_CONTENT_ERROR'
      });
    }
  }

  // Deletar conteúdo
  async deleteContent(req, res) {
    try {
      const { id } = req.params;

      // Verificar se conteúdo existe e pertence ao tenant
      const existingContent = await db.query(`
        SELECT title FROM contents 
        WHERE id = $1 AND tenant_id = $2
      `, [id, req.user.tenantId]);

      if (existingContent.rows.length === 0) {
        return res.status(404).json({
          error: 'Content not found',
          code: 'CONTENT_NOT_FOUND'
        });
      }

      // Deletar conteúdo (hard delete)
      await db.query(`
        DELETE FROM contents 
        WHERE id = $1 AND tenant_id = $2
      `, [id, req.user.tenantId]);

      logger.audit('content_deleted', 'contents', req.user.id, req.user.tenantId, {
        contentId: id,
        title: existingContent.rows[0].title
      });

      res.json({
        success: true,
        message: 'Content deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting content:', error);
      res.status(500).json({
        error: 'Failed to delete content',
        code: 'DELETE_CONTENT_ERROR'
      });
    }
  }

  // Publicar/despublicar conteúdo
  async togglePublishContent(req, res) {
    try {
      const { id } = req.params;
      const { publish } = req.body;

      const content = await db.query(`
        SELECT status, title FROM contents 
        WHERE id = $1 AND tenant_id = $2
      `, [id, req.user.tenantId]);

      if (content.rows.length === 0) {
        return res.status(404).json({
          error: 'Content not found',
          code: 'CONTENT_NOT_FOUND'
        });
      }

      const newStatus = publish ? 'published' : 'draft';
      const publishedAt = publish ? 'NOW()' : 'NULL';

      const result = await db.query(`
        UPDATE contents 
        SET status = $1, published_at = ${publishedAt}, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING *
      `, [newStatus, id, req.user.tenantId]);

      logger.audit('content_status_changed', 'contents', req.user.id, req.user.tenantId, {
        contentId: id,
        title: content.rows[0].title,
        oldStatus: content.rows[0].status,
        newStatus
      });

      res.json({
        success: true,
        content: result.rows[0]
      });

    } catch (error) {
      logger.error('Error toggling content status:', error);
      res.status(500).json({
        error: 'Failed to update content status',
        code: 'UPDATE_STATUS_ERROR'
      });
    }
  }

  // Duplicar conteúdo
  async duplicateContent(req, res) {
    try {
      const { id } = req.params;
      const { new_title, new_slug } = req.body;

      if (!new_title || !new_slug) {
        return res.status(400).json({
          error: 'New title and slug are required',
          code: 'MISSING_DUPLICATE_DATA'
        });
      }

      // Buscar conteúdo original
      const originalContent = await db.query(`
        SELECT * FROM contents 
        WHERE id = $1 AND tenant_id = $2
      `, [id, req.user.tenantId]);

      if (originalContent.rows.length === 0) {
        return res.status(404).json({
          error: 'Content not found',
          code: 'CONTENT_NOT_FOUND'
        });
      }

      const original = originalContent.rows[0];

      // Verificar se novo slug já existe
      const slugCheck = await db.query(`
        SELECT id FROM contents 
        WHERE slug = $1 AND tenant_id = $2 AND language = $3
      `, [new_slug, req.user.tenantId, original.language]);

      if (slugCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Slug already exists',
          code: 'SLUG_EXISTS'
        });
      }

      // Criar duplicata
      const duplicateQuery = `
        INSERT INTO contents (
          tenant_id, author_id, category_id, title, slug, excerpt, body,
          featured_image_url, meta_title, meta_description, status, language,
          content_type, is_featured, seo_settings, custom_fields
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const result = await db.query(duplicateQuery, [
        req.user.tenantId,
        req.user.id, // Novo autor é o usuário atual
        original.category_id,
        new_title,
        new_slug,
        original.excerpt,
        original.body,
        original.featured_image_url,
        original.meta_title,
        original.meta_description,
        'draft', // Sempre criar como draft
        original.language,
        original.content_type,
        false, // Não featured por padrão
        original.seo_settings,
        original.custom_fields
      ]);

      logger.audit('content_duplicated', 'contents', req.user.id, req.user.tenantId, {
        originalId: id,
        duplicateId: result.rows[0].id,
        newTitle: new_title
      });

      res.status(201).json({
        success: true,
        content: result.rows[0]
      });

    } catch (error) {
      logger.error('Error duplicating content:', error);
      res.status(500).json({
        error: 'Failed to duplicate content',
        code: 'DUPLICATE_CONTENT_ERROR'
      });
    }
  }

  // Buscar conteúdos relacionados
  async getRelatedContents(req, res) {
    try {
      const { id } = req.params;
      const { limit = 5 } = req.query;

      // Buscar conteúdo original para obter categoria
      const originalContent = await db.query(`
        SELECT category_id, language, content_type 
        FROM contents 
        WHERE id = $1 AND tenant_id = $2
      `, [id, req.user.tenantId]);

      if (originalContent.rows.length === 0) {
        return res.status(404).json({
          error: 'Content not found',
          code: 'CONTENT_NOT_FOUND'
        });
      }

      const { category_id, language, content_type } = originalContent.rows[0];

      // Buscar conteúdos relacionados
      const query = `
        SELECT 
          c.id,
          c.title,
          c.slug,
          c.excerpt,
          c.featured_image_url,
          c.published_at,
          cat.name as category_name
        FROM contents c
        LEFT JOIN content_categories cat ON c.category_id = cat.id
        WHERE c.tenant_id = $1 
          AND c.id != $2
          AND c.status = 'published'
          AND (c.expires_at IS NULL OR c.expires_at > NOW())
          AND (
            c.category_id = $3 OR 
            c.language = $4 OR 
            c.content_type = $5
          )
        ORDER BY 
          (CASE WHEN c.category_id = $3 THEN 3 ELSE 0 END +
           CASE WHEN c.language = $4 THEN 2 ELSE 0 END +
           CASE WHEN c.content_type = $5 THEN 1 ELSE 0 END) DESC,
          c.published_at DESC
        LIMIT $6
      `;

      const result = await db.query(query, [
        req.user.tenantId, id, category_id, language, content_type, parseInt(limit)
      ]);

      res.json({
        relatedContents: result.rows
      });

    } catch (error) {
      logger.error('Error fetching related contents:', error);
      res.status(500).json({
        error: 'Failed to fetch related contents',
        code: 'FETCH_RELATED_ERROR'
      });
    }
  }
}

export default new ContentController();
