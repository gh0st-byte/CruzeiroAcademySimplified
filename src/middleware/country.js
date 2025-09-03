import logger from '../config/logger.js';
import db from '../config/database.js';

// Middleware para extrair informações de país do CloudFront
export const extractCountryInfo = (req, res, next) => {
  // CloudFront headers para detecção de país
  const cloudFrontCountry = req.headers['cloudfront-viewer-country'];
  const cloudFrontRegion = req.headers['cloudfront-viewer-country-region'];
  const cloudFrontCity = req.headers['cloudfront-viewer-city'];
  
  // Fallback para outros headers comuns
  const xCountry = req.headers['x-country'];
  const cfIpCountry = req.headers['cf-ipcountry']; // Cloudflare
  
  // Determinar país prioritariamente pelo CloudFront
  let detectedCountry = cloudFrontCountry || cfIpCountry || xCountry;
  
  // Normalizar código do país para ISO 3166-1 alpha-3
  const countryMapping = {
    'BR': 'BRA',
    'US': 'USA', 
    'JP': 'JPN',
    'PE': 'PER',
    'CO': 'COL',
    'TH': 'THA',
    // Adicionar outros mapeamentos conforme necessário
  };
  
  if (detectedCountry && detectedCountry.length === 2) {
    detectedCountry = countryMapping[detectedCountry.toUpperCase()] || detectedCountry.toUpperCase();
  }
  
  // Anexar informações de localização ao request
  req.location = {
    country: detectedCountry,
    region: cloudFrontRegion,
    city: cloudFrontCity,
    source: cloudFrontCountry ? 'cloudfront' : (cfIpCountry ? 'cloudflare' : 'header')
  };
  
  logger.debug('Location info extracted:', req.location);
  next();
};

// Middleware para filtrar escolas por país
export const filterSchoolsByCountry = async (req, res, next) => {
  try {
    if (!req.location || !req.location.country) {
      // Se não conseguimos detectar o país, prosseguir sem filtro específico
      logger.debug('No country detected, proceeding without country filter');
      return next();
    }
    
    const country = req.location.country;
    
    // Buscar escola correspondente ao país detectado
    const schoolResult = await db.query(`
      SELECT id, name, country, country_name, timezone, language, currency, domain, slug
      FROM schools
      WHERE country = $1 AND status = 'active'
      LIMIT 1
    `, [country]);
    
    if (schoolResult.rows.length > 0) {
      req.targetSchool = schoolResult.rows[0];
      logger.debug('Target school found for country:', {
        country,
        school: req.targetSchool.name
      });
    } else {
      // Fallback para escola padrão (Brasil) se não encontrar
      const defaultSchoolResult = await db.query(`
        SELECT id, name, country, country_name, timezone, language, currency, domain, slug
        FROM schools
        WHERE country = 'BRA' AND status = 'active'
        LIMIT 1
      `);
      
      if (defaultSchoolResult.rows.length > 0) {
        req.targetSchool = defaultSchoolResult.rows[0];
        logger.debug('Using default school (Brazil) for country:', country);
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error in filterSchoolsByCountry middleware:', error);
    // Não bloquear a requisição, apenas logar o erro
    next();
  }
};

// Middleware para adicionar filtros de país nas queries
export const addCountryFilter = (req, res, next) => {
  // Helper function para construir WHERE clause com filtro de país
  req.buildCountryFilter = (baseWhere = '1=1', tenantIdParam = null) => {
    let whereClause = baseWhere;
    const params = [];
    let paramIndex = 1;
    
    // Se temos escola alvo identificada, filtrar por ela
    if (req.targetSchool && req.targetSchool.id) {
      whereClause += ` AND tenant_id = $${paramIndex}`;
      params.push(req.targetSchool.id);
      paramIndex++;
    } else if (tenantIdParam) {
      // Se foi fornecido um tenant_id específico, usar ele
      whereClause += ` AND tenant_id = $${paramIndex}`;
      params.push(tenantIdParam);
      paramIndex++;
    }
    
    return { whereClause, params, paramIndex };
  };
  
  next();
};

// Middleware para validar compatibilidade de país
export const validateCountryCompatibility = async (req, res, next) => {
  try {
    // Só aplicar para endpoints que modificam dados
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }
    
    // Se temos um tenant_id no body e um país detectado
    if (req.body && req.body.tenant_id && req.location && req.location.country) {
      const result = await db.query(`
        SELECT country FROM schools WHERE id = $1 AND status = 'active'
      `, [req.body.tenant_id]);
      
      if (result.rows.length > 0) {
        const schoolCountry = result.rows[0].country;
        
        // Alertar se há incompatibilidade (mas não bloquear)
        if (schoolCountry !== req.location.country) {
          logger.warn('Country mismatch detected', {
            detectedCountry: req.location.country,
            schoolCountry: schoolCountry,
            schoolId: req.body.tenant_id,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error in validateCountryCompatibility:', error);
    next(); // Não bloquear por erro de validação
  }
};

// Middleware para endpoints públicos com filtro automático por país
export const autoCountryFilter = [
  extractCountryInfo,
  filterSchoolsByCountry,
  addCountryFilter
];

export default {
  extractCountryInfo,
  filterSchoolsByCountry,
  addCountryFilter,
  validateCountryCompatibility,
  autoCountryFilter
};
