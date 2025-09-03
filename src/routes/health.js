import express from 'express';
import db from '../config/database.js';
import logger from '../config/logger.js';

const router = express.Router();

// Armazenar estatísticas em memória para métricas básicas
let healthStats = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  lastHealthCheck: null,
  uptime: 0
};

// Middleware para contar requests
export const requestCounterMiddleware = (req, res, next) => {
  healthStats.requestCount++;
  
  // Contar erros na resposta
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      healthStats.errorCount++;
    }
    originalSend.call(this, data);
  };
  
  next();
};

// ===================================================================
// HEALTH CHECK BÁSICO
// ===================================================================

// Health check simples (para load balancer)
router.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    healthStats.lastHealthCheck = healthCheck.timestamp;
    healthStats.uptime = healthCheck.uptime;

    res.status(200).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ===================================================================
// READINESS PROBE (Kubernetes)
// ===================================================================

// Readiness check (verifica se aplicação está pronta para receber tráfego)
router.get('/ready', async (req, res) => {
  const checks = [];
  let overallStatus = 'ready';
  
  try {
    // Check 1: Database connection
    try {
      const dbHealth = await db.healthCheck();
      checks.push({
        name: 'database',
        status: dbHealth.status,
        details: dbHealth
      });
      
      if (dbHealth.status !== 'healthy') {
        overallStatus = 'not_ready';
      }
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'unhealthy',
        error: error.message
      });
      overallStatus = 'not_ready';
    }

    // Check 2: Critical tables existence
    try {
      const tableCheck = await db.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('schools', 'cms_users', 'contents')
      `);
      
      const tableCount = parseInt(tableCheck.rows[0].table_count);
      const tablesStatus = tableCount >= 3 ? 'healthy' : 'unhealthy';
      
      checks.push({
        name: 'critical_tables',
        status: tablesStatus,
        details: { count: tableCount, expected: 3 }
      });
      
      if (tablesStatus !== 'healthy') {
        overallStatus = 'not_ready';
      }
    } catch (error) {
      checks.push({
        name: 'critical_tables',
        status: 'unhealthy',
        error: error.message
      });
      overallStatus = 'not_ready';
    }

    // Check 3: Basic configuration
    const configStatus = process.env.NODE_ENV && process.env.PORT ? 'healthy' : 'unhealthy';
    checks.push({
      name: 'configuration',
      status: configStatus,
      details: {
        nodeEnv: !!process.env.NODE_ENV,
        port: !!process.env.PORT
      }
    });
    
    if (configStatus !== 'healthy') {
      overallStatus = 'not_ready';
    }

    const statusCode = overallStatus === 'ready' ? 200 : 503;
    
    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    });

  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message,
      checks
    });
  }
});

// ===================================================================
// LIVENESS PROBE (Kubernetes)
// ===================================================================

// Liveness check (verifica se aplicação deve ser reiniciada)
router.get('/live', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Verificar se a aplicação está "travada" (exemplo: muito tempo sem health check)
    const lastCheckAge = healthStats.lastHealthCheck 
      ? Date.now() - new Date(healthStats.lastHealthCheck).getTime()
      : 0;
    
    const isStuck = lastCheckAge > 300000; // 5 minutos sem health check
    const memoryIssue = memoryUsage.heapUsed > memoryUsage.heapTotal * 0.95;
    
    if (isStuck || memoryIssue) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        issues: {
          stuck: isStuck,
          memoryIssue,
          lastCheckAge: lastCheckAge / 1000
        }
      });
    }

    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime,
      memoryUsage
    });

  } catch (error) {
    logger.error('Liveness check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ===================================================================
// MÉTRICAS DETALHADAS
// ===================================================================

// Métricas da aplicação (para Prometheus/CloudWatch)
router.get('/metrics', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Estatísticas do banco de dados
    let dbMetrics = {};
    try {
      const dbHealth = await db.healthCheck();
      
      // Estatísticas de conexões do PostgreSQL
      const connStats = await db.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      
      // Estatísticas de queries lentas (últimas 24h)
      const slowQueries = await db.query(`
        SELECT COUNT(*) as slow_queries_24h
        FROM audit_logs 
        WHERE created_at > NOW() - INTERVAL '24 hours'
        AND table_name = 'slow_query'
      `);
      
      dbMetrics = {
        status: dbHealth.status,
        connections: {
          total: parseInt(connStats.rows[0]?.total_connections || 0),
          active: parseInt(connStats.rows[0]?.active_connections || 0),
          idle: parseInt(connStats.rows[0]?.idle_connections || 0),
          pool: {
            total: dbHealth.connections || 0,
            idle: dbHealth.idle || 0,
            waiting: dbHealth.waiting || 0
          }
        },
        slowQueries24h: parseInt(slowQueries.rows[0]?.slow_queries_24h || 0)
      };
    } catch (error) {
      dbMetrics = { error: error.message };
    }

    // Estatísticas por tenant
    let tenantStats = [];
    try {
      const tenantResult = await db.query(`
        SELECT 
          s.id,
          s.name,
          s.country,
          COUNT(DISTINCT c.id) as content_count,
          COUNT(DISTINCT u.id) as user_count,
          COUNT(DISTINCT CASE WHEN c.status = 'published' THEN c.id END) as published_count
        FROM schools s
        LEFT JOIN contents c ON s.id = c.tenant_id
        LEFT JOIN cms_users u ON s.id = u.tenant_id AND u.is_active = true
        WHERE s.status = 'active'
        GROUP BY s.id, s.name, s.country
        ORDER BY content_count DESC
        LIMIT 10
      `);
      
      tenantStats = tenantResult.rows.map(row => ({
        tenantId: row.id,
        name: row.name,
        country: row.country,
        metrics: {
          contents: parseInt(row.content_count),
          users: parseInt(row.user_count),
          published: parseInt(row.published_count)
        }
      }));
    } catch (error) {
      tenantStats = [{ error: error.message }];
    }

    // Calcular taxa de erro
    const errorRate = healthStats.requestCount > 0 
      ? (healthStats.errorCount / healthStats.requestCount * 100).toFixed(2)
      : 0;

    const metrics = {
      timestamp: new Date().toISOString(),
      application: {
        name: 'cruzeiro-academy-cms',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        startTime: new Date(healthStats.startTime).toISOString()
      },
      system: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          heapUsage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) // %
        },
        cpu: {
          user: Math.round(cpuUsage.user / 1000), // ms
          system: Math.round(cpuUsage.system / 1000) // ms
        },
        platform: process.platform,
        nodeVersion: process.version
      },
      http: {
        totalRequests: healthStats.requestCount,
        totalErrors: healthStats.errorCount,
        errorRate: parseFloat(errorRate),
        requestsPerSecond: Math.round(healthStats.requestCount / process.uptime() * 100) / 100
      },
      database: dbMetrics,
      tenants: {
        active: tenantStats.length,
        topTenants: tenantStats
      }
    };

    // Formato Prometheus (opcional)
    if (req.query.format === 'prometheus') {
      const prometheusMetrics = [
        `# HELP cms_uptime_seconds Application uptime in seconds`,
        `# TYPE cms_uptime_seconds gauge`,
        `cms_uptime_seconds ${metrics.application.uptime}`,
        ``,
        `# HELP cms_memory_usage_bytes Memory usage in bytes`,
        `# TYPE cms_memory_usage_bytes gauge`,
        `cms_memory_usage_bytes{type="rss"} ${memoryUsage.rss}`,
        `cms_memory_usage_bytes{type="heapTotal"} ${memoryUsage.heapTotal}`,
        `cms_memory_usage_bytes{type="heapUsed"} ${memoryUsage.heapUsed}`,
        ``,
        `# HELP cms_http_requests_total Total number of HTTP requests`,
        `# TYPE cms_http_requests_total counter`,
        `cms_http_requests_total ${metrics.http.totalRequests}`,
        ``,
        `# HELP cms_http_errors_total Total number of HTTP errors`,
        `# TYPE cms_http_errors_total counter`,
        `cms_http_errors_total ${metrics.http.totalErrors}`,
        ``,
        `# HELP cms_database_connections Database connections`,
        `# TYPE cms_database_connections gauge`,
        `cms_database_connections{type="total"} ${dbMetrics.connections?.total || 0}`,
        `cms_database_connections{type="active"} ${dbMetrics.connections?.active || 0}`,
      ].join('\n');

      return res.type('text/plain').send(prometheusMetrics);
    }

    res.json(metrics);

  } catch (error) {
    logger.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
      message: error.message
    });
  }
});

// ===================================================================
// INFORMAÇÕES DO SISTEMA
// ===================================================================

// Informações detalhadas do sistema (para debugging)
router.get('/info', async (req, res) => {
  try {
    const info = {
      application: {
        name: 'cruzeiro-academy-cms',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch
      },
      server: {
        uptime: process.uptime(),
        pid: process.pid,
        cwd: process.cwd(),
        execPath: process.execPath
      },
      configuration: {
        port: process.env.PORT || 3000,
        apiVersion: process.env.API_VERSION || 'v1',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: Intl.DateTimeFormat().resolvedOptions().locale
      },
      features: {
        database: !!process.env.DATABASE_URL,
        s3Upload: !!(process.env.S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID),
        cloudWatch: !!process.env.CLOUDWATCH_LOG_GROUP,
        secretsManager: !!process.env.DB_SECRET_NAME
      }
    };

    res.json(info);
  } catch (error) {
    logger.error('System info failed:', error);
    res.status(500).json({
      error: 'Failed to get system info',
      message: error.message
    });
  }
});

export default router;
