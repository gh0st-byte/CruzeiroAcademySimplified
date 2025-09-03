import Joi from 'joi';
import db from '../config/database.js';
import logger from '../config/logger.js';
import slugify from 'slugify';

// Schemas de validação
const locationTagSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  code: Joi.string().min(1).max(10).pattern(/^[A-Z0-9_]+$/).required(),
  country: Joi.string().length(3).pattern(/^[A-Z]{3}$/).allow(null),
  description: Joi.string().max(500).allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  icon: Joi.string().max(50).allow('', null),
  sort_order: Joi.number().integer().min(0).default(0)
});

const updateLocationTagSchema = locationTagSchema.fork(['name', 'code'], (schema) => 
  schema.optional()
);

class LocationTagController {
  // Listar todas as location tags
  async listLocationTags(req, res) {
    try {
      const { active_only } = req.query;
      
      let whereClause = '1=1';
      const params = [];
      
      if (active_only === 'true') {
        whereClause += ' AND is_active = true';
      }

      const query = `
        SELECT 
          lt.*,
          COUNT(DISTINCT cl.content_id) as content_count,
          COUNT(DISTINCT CASE 
            WHEN c.status = 'published' 
            THEN cl.content_id 
          END) as published_content_count
        FROM location_tags lt
        LEFT JOIN content_locations cl ON lt.id = cl.location_tag_id
        LEFT JOIN contents c ON cl.content_id = c.id
        WHERE ${whereClause}
        GROUP BY lt.id
        ORDER BY lt.sort_order ASC, lt.name ASC
      `;

      const result = await db.query(query, params);

      res.json({
        locationTags: result.rows
      });

    } catch (error) {
      logger.error('Error listing location tags:', error);
      res.status(500).json({
        error: 'Failed to fetch location tags',
        code: 'FETCH_LOCATION_TAGS_ERROR'
      });
    }
  }

  // Obter location tag por ID
  async getLocationTag(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          lt.*,
          COUNT(DISTINCT cl.content_id) as content_count,
          COUNT(DISTINCT CASE 
            WHEN c.status = 'published' 
            THEN cl.content_id 
          END) as published_content_count
        FROM location_tags lt
        LEFT JOIN content_locations cl ON lt.id = cl.location_tag_id
        LEFT JOIN contents c ON cl.content_id = c.id
        WHERE lt.id = $1
        GROUP BY lt.id
      `;

      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Location tag not found',
          code: 'LOCATION_TAG_NOT_FOUND'
        });
      }

      res.json({
        locationTag: result.rows[0]
      });

    } catch (error) {
      logger.error('Error fetching location tag:', error);
      res.status(500).json({
        error: 'Failed to fetch location tag',
        code: 'FETCH_LOCATION_TAG_ERROR'
      });
    }
  }

  // Criar nova location tag
  async createLocationTag(req, res) {
    try {
      const { error, value } = locationTagSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(d => d.message)
        });
      }

      // Verificar se code já existe
      const existingCode = await db.query(`
        SELECT id FROM location_tags WHERE code = $1
      `, [value.code]);

      if (existingCode.rows.length > 0) {
        return res.status(409).json({
          error: 'Code already exists',
          code: 'CODE_EXISTS'
        });
      }

      // Verificar se name já existe
      const existingName = await db.query(`
        SELECT id FROM location_tags WHERE name = $1
      `, [value.name]);

      if (existingName.rows.length > 0) {
        return res.status(409).json({
          error: 'Name already exists',
          code: 'NAME_EXISTS'
        });
      }

      const insertQuery = `
        INSERT INTO location_tags (
          name, code, country, description, color, icon, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        value.name,
        value.code,
        value.country,
        value.description,
        value.color,
        value.icon,
        value.sort_order
      ]);

      const newLocationTag = result.rows[0];

      logger.audit('location_tag_created', 'location_tags', req.user.id, null, {
        locationTagId: newLocationTag.id,
        name: newLocationTag.name,
        code: newLocationTag.code
      });

      res.status(201).json({
        success: true,
        locationTag: newLocationTag
      });

    } catch (error) {
      logger.error('Error creating location tag:', error);
      res.status(500).json({
        error: 'Failed to create location tag',
        code: 'CREATE_LOCATION_TAG_ERROR'
      });
    }
  }

  // Atualizar location tag
  async updateLocationTag(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = updateLocationTagSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(d => d.message)
        });
      }

      // Verificar se location tag existe
      const existing = await db.query(`
        SELECT * FROM location_tags WHERE id = $1
      `, [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: 'Location tag not found',
          code: 'LOCATION_TAG_NOT_FOUND'
        });
      }

      // Verificar conflitos de code
      if (value.code && value.code !== existing.rows[0].code) {
        const codeCheck = await db.query(`
          SELECT id FROM location_tags WHERE code = $1 AND id != $2
        `, [value.code, id]);

        if (codeCheck.rows.length > 0) {
          return res.status(409).json({
            error: 'Code already exists',
            code: 'CODE_EXISTS'
          });
        }
      }

      // Verificar conflitos de name
      if (value.name && value.name !== existing.rows[0].name) {
        const nameCheck = await db.query(`
          SELECT id FROM location_tags WHERE name = $1 AND id != $2
        `, [value.name, id]);

        if (nameCheck.rows.length > 0) {
          return res.status(409).json({
            error: 'Name already exists',
            code: 'NAME_EXISTS'
          });
        }
      }

      // Construir query de update dinâmica
      const updateFields = [];
      const updateParams = [];
      let paramIndex = 1;

      Object.keys(value).forEach(key => {
        if (value[key] !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateParams.push(value[key]);
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
      updateParams.push(id);

      const updateQuery = `
        UPDATE location_tags 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.query(updateQuery, updateParams);

      logger.audit('location_tag_updated', 'location_tags', req.user.id, null, {
        locationTagId: id,
        updatedFields: Object.keys(value)
      });

      res.json({
        success: true,
        locationTag: result.rows[0]
      });

    } catch (error) {
      logger.error('Error updating location tag:', error);
      res.status(500).json({
        error: 'Failed to update location tag',
        code: 'UPDATE_LOCATION_TAG_ERROR'
      });
    }
  }

  // Deletar location tag
  async deleteLocationTag(req, res) {
    try {
      const { id } = req.params;

      // Verificar se location tag existe
      const existing = await db.query(`
        SELECT name FROM location_tags WHERE id = $1
      `, [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: 'Location tag not found',
          code: 'LOCATION_TAG_NOT_FOUND'
        });
      }

      // Verificar se há conteúdos usando esta tag
      const contentCount = await db.query(`
        SELECT COUNT(*) as count FROM content_locations WHERE location_tag_id = $1
      `, [id]);

      if (parseInt(contentCount.rows[0].count) > 0) {
        return res.status(409).json({
          error: 'Cannot delete location tag with associated content',
          code: 'LOCATION_TAG_HAS_CONTENT',
          contentCount: parseInt(contentCount.rows[0].count)
        });
      }

      // Deletar location tag
      await db.query(`
        DELETE FROM location_tags WHERE id = $1
      `, [id]);

      logger.audit('location_tag_deleted', 'location_tags', req.user.id, null, {
        locationTagId: id,
        name: existing.rows[0].name
      });

      res.json({
        success: true,
        message: 'Location tag deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting location tag:', error);
      res.status(500).json({
        error: 'Failed to delete location tag',
        code: 'DELETE_LOCATION_TAG_ERROR'
      });
    }
  }

  // Ativar/desativar location tag
  async toggleLocationTag(req, res) {
    try {
      const { id } = req.params;
      const { active } = req.body;

      const existing = await db.query(`
        SELECT name, is_active FROM location_tags WHERE id = $1
      `, [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: 'Location tag not found',
          code: 'LOCATION_TAG_NOT_FOUND'
        });
      }

      const result = await db.query(`
        UPDATE location_tags 
        SET is_active = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [active, id]);

      logger.audit('location_tag_status_changed', 'location_tags', req.user.id, null, {
        locationTagId: id,
        name: existing.rows[0].name,
        oldStatus: existing.rows[0].is_active,
        newStatus: active
      });

      res.json({
        success: true,
        locationTag: result.rows[0]
      });

    } catch (error) {
      logger.error('Error toggling location tag status:', error);
      res.status(500).json({
        error: 'Failed to update location tag status',
        code: 'UPDATE_LOCATION_TAG_STATUS_ERROR'
      });
    }
  }

  // Obter conteúdos por location tag
  async getContentsByLocationTag(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let whereClause = 'cl.location_tag_id = $1';
      const params = [id];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      const query = `
        SELECT 
          c.id,
          c.title,
          c.slug,
          c.excerpt,
          c.status,
          c.content_type,
          c.language,
          c.is_featured,
          c.view_count,
          c.published_at,
          c.created_at,
          cat.name as category_name,
          u.first_name || ' ' || u.last_name as author_name
        FROM content_locations cl
        JOIN contents c ON cl.content_id = c.id
        LEFT JOIN content_categories cat ON c.category_id = cat.id
        JOIN cms_users u ON c.author_id = u.id
        WHERE ${whereClause}
        ORDER BY c.updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(parseInt(limit), offset);
      const result = await db.query(query, params);

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM content_locations cl
        JOIN contents c ON cl.content_id = c.id
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
      logger.error('Error fetching contents by location tag:', error);
      res.status(500).json({
        error: 'Failed to fetch contents',
        code: 'FETCH_CONTENTS_BY_LOCATION_ERROR'
      });
    }
  }

  // Estatísticas de uso das location tags
  async getLocationTagStats(req, res) {
    try {
      const query = `
        SELECT 
          lt.id,
          lt.name,
          lt.code,
          lt.country,
          lt.color,
          COUNT(DISTINCT cl.content_id) as total_contents,
          COUNT(DISTINCT CASE WHEN c.status = 'published' THEN cl.content_id END) as published_contents,
          COUNT(DISTINCT CASE WHEN c.status = 'draft' THEN cl.content_id END) as draft_contents,
          COUNT(DISTINCT CASE WHEN c.is_featured = true THEN cl.content_id END) as featured_contents,
          COALESCE(SUM(c.view_count), 0) as total_views,
          MAX(c.published_at) as last_content_published
        FROM location_tags lt
        LEFT JOIN content_locations cl ON lt.id = cl.location_tag_id
        LEFT JOIN contents c ON cl.content_id = c.id
        WHERE lt.is_active = true
        GROUP BY lt.id, lt.name, lt.code, lt.country, lt.color
        ORDER BY total_contents DESC, lt.sort_order ASC
      `;

      const result = await db.query(query);

      res.json({
        stats: result.rows
      });

    } catch (error) {
      logger.error('Error fetching location tag stats:', error);
      res.status(500).json({
        error: 'Failed to fetch location tag statistics',
        code: 'FETCH_LOCATION_TAG_STATS_ERROR'
      });
    }
  }

  // Listar location tags simplificado (para endpoint público)
  async list(req, res) {
    try {
      const { whereClause, params } = req.buildCountryFilter ? req.buildCountryFilter() : { whereClause: '1=1', params: [] };
      
      const query = `
        SELECT 
          lt.id,
          lt.name,
          lt.slug,
          lt.description,
          lt.is_active
        FROM location_tags lt
        LEFT JOIN schools s ON lt.tenant_id = s.id
        WHERE ${whereClause} AND lt.is_active = true
        ORDER BY lt.name ASC
      `;
      
      const result = await db.query(query, params);
      
      res.json({
        locationTags: result.rows,
        location: req.location || null,
        targetSchool: req.targetSchool || null
      });
      
    } catch (error) {
      logger.error('Error fetching location tags:', error);
      res.status(500).json({
        error: 'Failed to fetch location tags',
        code: 'FETCH_LOCATION_TAGS_ERROR'
      });
    }
  }
}

export default new LocationTagController();
