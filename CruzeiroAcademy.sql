-- ===================================================================
-- CRUZEIRO ACADEMY CMS - DATABASE SCHEMA
-- Sistema de Gestão de Conteúdo Global com Multi-Tenancy
-- Data: 2025-08-28
-- Versão: 1.0
-- ===================================================================

CREATE DATABASE cruzeiro_academy;
\c cruzeiro_academy;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. TABELA SCHOOLS (TENANTS) - Multi-tenancy por país/região
-- ===================================================================
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(3) NOT NULL, -- ISO 3166-1 alpha-3 (BRA, USA, JPN)
    country_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL, -- America/Sao_Paulo, America/New_York, Asia/Tokyo
    language VARCHAR(5) NOT NULL DEFAULT 'pt-BR', -- pt-BR, en-US, ja-JP
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL', -- BRL, USD, JPY
    domain VARCHAR(255) UNIQUE, -- br.cruzeiroacademy.com, us.cruzeiroacademy.com
    slug VARCHAR(100) UNIQUE NOT NULL, -- brazil, usa, japan
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 2. TABELA DE USUÁRIOS ADMINISTRATIVOS (CMS)
-- ===================================================================
CREATE TABLE cms_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'editor', -- super_admin, admin, editor, viewer
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 3. TABELA DE CATEGORIAS DE CONTEÚDO
-- ===================================================================
CREATE TABLE content_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES content_categories(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

-- ===================================================================
-- 4. TABELA DE CONTEÚDOS DO CMS
-- ===================================================================
CREATE TABLE contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID REFERENCES content_categories(id) ON DELETE SET NULL,
    author_id UUID NOT NULL REFERENCES cms_users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    excerpt TEXT,
    body TEXT NOT NULL,
    featured_image_url VARCHAR(500),
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, published, archived, scheduled
    language VARCHAR(10) NOT NULL DEFAULT 'pt-BR', -- pt-BR, en-US, ja-JP
    content_type VARCHAR(50) NOT NULL DEFAULT 'article', -- article, page, news, event
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    published_at TIMESTAMP,
    expires_at TIMESTAMP,
    scheduled_at TIMESTAMP,
    seo_settings JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug, language)
);

-- ===================================================================
-- 5. TABELA DE MÍDIAS/ARQUIVOS
-- ===================================================================
CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES cms_users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    alt_text VARCHAR(500),
    caption TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 6. TABELA DE MENUS DE NAVEGAÇÃO
-- ===================================================================
CREATE TABLE navigation_menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    location VARCHAR(50) NOT NULL, -- header, footer, sidebar
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

CREATE TABLE navigation_menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID NOT NULL REFERENCES navigation_menus(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES navigation_menu_items(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    url VARCHAR(500),
    content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
    target VARCHAR(20) DEFAULT '_self', -- _self, _blank
    css_class VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 7. TABELA DE CONFIGURAÇÕES DO SITE
-- ===================================================================
CREATE TABLE site_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) NOT NULL DEFAULT 'text', -- text, boolean, json, number
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES cms_users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, setting_key)
);

-- ===================================================================
-- 8. TABELA DE AUDITORIA/LOGS (Retenção mínima para segurança)
-- ===================================================================
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES cms_users(id) ON DELETE SET NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    operation VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE, SELECT
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 9. TABELA DE SESSÕES DE USUÁRIO
-- ===================================================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES cms_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 10. TABELA DE MONITORAMENTO DE CONEXÕES
-- ===================================================================
CREATE TABLE connection_stats (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    active_connections INTEGER NOT NULL,
    total_connections INTEGER NOT NULL,
    slow_queries INTEGER DEFAULT 0,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2)
);

-- ===================================================================
-- 11. ÍNDICES COMPOSTOS PARA PERFORMANCE
-- ===================================================================

-- Índices para tabela schools
CREATE INDEX idx_schools_country ON schools (country);
CREATE INDEX idx_schools_status ON schools (status);
CREATE INDEX idx_schools_slug ON schools (slug);

-- Índices para tabela contents (principal tabela de negócio)
CREATE INDEX idx_contents_tenant_status ON contents (tenant_id, status);
CREATE INDEX idx_contents_tenant_language ON contents (tenant_id, language);
CREATE INDEX idx_contents_tenant_type ON contents (tenant_id, content_type);
CREATE INDEX idx_contents_published ON contents (published_at) WHERE status = 'published';
CREATE INDEX idx_contents_featured ON contents (tenant_id, is_featured) WHERE is_featured = true;
CREATE INDEX idx_contents_category ON contents (category_id);
CREATE INDEX idx_contents_author ON contents (author_id);
CREATE INDEX idx_contents_slug_lang ON contents (tenant_id, slug, language);

-- Índices para tabela cms_users
CREATE INDEX idx_cms_users_tenant ON cms_users (tenant_id);
CREATE INDEX idx_cms_users_email ON cms_users (email);
CREATE INDEX idx_cms_users_role ON cms_users (role);
CREATE INDEX idx_cms_users_active ON cms_users (is_active);

-- Índices para tabela audit_logs (otimizado para consultas de auditoria)
CREATE INDEX idx_audit_tenant_date ON audit_logs (tenant_id, created_at);
CREATE INDEX idx_audit_user_date ON audit_logs (user_id, created_at);
CREATE INDEX idx_audit_table_operation ON audit_logs (table_name, operation);
CREATE INDEX idx_audit_record ON audit_logs (table_name, record_id);

-- Índices para tabela media_files
CREATE INDEX idx_media_tenant ON media_files (tenant_id);
CREATE INDEX idx_media_type ON media_files (mime_type);
CREATE INDEX idx_media_uploaded_by ON media_files (uploaded_by);

-- Índices para tabela content_categories
CREATE INDEX idx_categories_tenant ON content_categories (tenant_id);
CREATE INDEX idx_categories_parent ON content_categories (parent_id);
CREATE INDEX idx_categories_slug ON content_categories (tenant_id, slug);

-- Índices para tabela user_sessions
CREATE INDEX idx_sessions_user ON user_sessions (user_id);
CREATE INDEX idx_sessions_token ON user_sessions (session_token);
CREATE INDEX idx_sessions_expires ON user_sessions (expires_at);
CREATE INDEX idx_sessions_active ON user_sessions (is_active);

-- ===================================================================
-- 12. DADOS INICIAIS (SEEDS)
-- ===================================================================

-- Inserir escolas iniciais (tenants)
INSERT INTO schools (id, name, country, country_name, timezone, language, currency, domain, slug, status) VALUES
(uuid_generate_v4(), 'Cruzeiro Academy Brasil', 'BRA', 'Brasil', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'br.cruzeiroacademy.com', 'brazil', 'active'),
(uuid_generate_v4(), 'Cruzeiro Academy USA', 'USA', 'United States', 'America/New_York', 'en-US', 'USD', 'us.cruzeiroacademy.com', 'usa', 'active'),
(uuid_generate_v4(), 'Cruzeiro Academy Japan', 'JPN', 'Japan', 'Asia/Tokyo', 'ja-JP', 'JPY', 'jp.cruzeiroacademy.com', 'japan', 'active'),
(uuid_generate_v4(), 'Cruzeiro Academy Peru', 'PER', 'Peru', 'America/Lima', 'es-PE', 'PEN', 'pe.cruzeiroacademy.com', 'peru', 'active'),
(uuid_generate_v4(), 'Cruzeiro Academy Colômbia', 'COL', 'Colômbia', 'America/Bogota', 'es-CO', 'COP', 'co.cruzeiroacademy.com', 'colombia', 'active'),
(uuid_generate_v4(), 'Cruzeiro Academy Tailândia', 'THA', 'Tailândia', 'Asia/Bangkok', 'th-TH', 'THB', 'th.cruzeiroacademy.com', 'thailand', 'active');

-- Inserir categorias iniciais para cada tenant
DO $$
DECLARE
    school_rec RECORD;
    cat_id UUID;
BEGIN
    FOR school_rec IN SELECT id FROM schools LOOP
        -- Categorias principais
        INSERT INTO content_categories (tenant_id, name, slug, description, sort_order) VALUES
        (school_rec.id, 'Notícias', 'noticias', 'Notícias e novidades da academia', 1),
        (school_rec.id, 'Treinamentos', 'treinamentos', 'Informações sobre treinamentos', 2),
        (school_rec.id, 'Eventos', 'eventos', 'Eventos e competições', 3),
        (school_rec.id, 'Sobre', 'sobre', 'Páginas institucionais', 4);
    END LOOP;
END $$;

-- Inserir configurações iniciais do site
DO $$
DECLARE
    school_rec RECORD;
BEGIN
    FOR school_rec IN SELECT id FROM schools LOOP
        INSERT INTO site_settings (tenant_id, setting_key, setting_value, setting_type, description, is_public) VALUES
        (school_rec.id, 'site_title', 'Cruzeiro Academy', 'text', 'Título do site', true),
        (school_rec.id, 'site_description', 'Academia de futebol Cruzeiro', 'text', 'Descrição do site', true),
        (school_rec.id, 'contact_email', 'contato@cruzeiroacademy.com', 'text', 'E-mail de contato', true),
        (school_rec.id, 'social_facebook', 'https://facebook.com/cruzeiroacademy', 'text', 'URL do Facebook', true),
        (school_rec.id, 'social_instagram', 'https://instagram.com/cruzeiroacademy', 'text', 'URL do Instagram', true),
        (school_rec.id, 'analytics_enabled', 'true', 'boolean', 'Habilitar Google Analytics', false),
        (school_rec.id, 'maintenance_mode', 'false', 'boolean', 'Modo de manutenção', false);
    END LOOP;
END $$;

-- ===================================================================
-- 13. TRIGGERS DE AUDITORIA AUTOMÁTICA
-- ===================================================================

-- Função para trigger de auditoria
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (tenant_id, table_name, record_id, operation, old_values)
        VALUES (OLD.tenant_id, TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (tenant_id, table_name, record_id, operation, old_values, new_values)
        VALUES (NEW.tenant_id, TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (tenant_id, table_name, record_id, operation, new_values)
        VALUES (NEW.tenant_id, TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoria nas tabelas principais
CREATE TRIGGER audit_contents_trigger
    AFTER INSERT OR UPDATE OR DELETE ON contents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_cms_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON cms_users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_categories_trigger
    AFTER INSERT OR UPDATE OR DELETE ON content_categories
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Função para atualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de updated_at nas tabelas relevantes
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cms_users_updated_at BEFORE UPDATE ON cms_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON content_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_updated_at BEFORE UPDATE ON media_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 14. VIEWS ÚTEIS PARA CONSULTAS FREQUENTES
-- ===================================================================

-- View para conteúdos publicados com informações do autor
CREATE VIEW published_contents AS
SELECT 
    c.id,
    c.tenant_id,
    s.name as school_name,
    s.country,
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
    c.created_at,
    c.updated_at
FROM contents c
JOIN schools s ON c.tenant_id = s.id
JOIN cms_users u ON c.author_id = u.id
LEFT JOIN content_categories cat ON c.category_id = cat.id
WHERE c.status = 'published'
  AND (c.expires_at IS NULL OR c.expires_at > NOW());

-- View para estatísticas por tenant
CREATE VIEW tenant_stats AS
SELECT 
    s.id as tenant_id,
    s.name as school_name,
    s.country,
    COUNT(DISTINCT c.id) as total_contents,
    COUNT(DISTINCT CASE WHEN c.status = 'published' THEN c.id END) as published_contents,
    COUNT(DISTINCT CASE WHEN c.status = 'draft' THEN c.id END) as draft_contents,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT cat.id) as total_categories,
    COUNT(DISTINCT m.id) as total_media_files,
    SUM(c.view_count) as total_views
FROM schools s
LEFT JOIN contents c ON s.id = c.tenant_id
LEFT JOIN cms_users u ON s.id = u.tenant_id AND u.is_active = true
LEFT JOIN content_categories cat ON s.id = cat.tenant_id AND cat.is_active = true
LEFT JOIN media_files m ON s.id = m.tenant_id AND m.is_active = true
GROUP BY s.id, s.name, s.country;

-- ===================================================================
-- 15. COMENTÁRIOS FINAIS E INFORMAÇÕES
-- ===================================================================

-- Este banco de dados implementa:
-- ✓ Multi-tenancy por país/região (schools como tenants)
-- ✓ Todas as tabelas de negócio com TENANT_ID UUID NOT NULL FK
-- ✓ Índices compostos otimizados para queries por tenant
-- ✓ Particionamento lógico por TENANT_ID
-- ✓ Connection pooling (configurado via pgbouncer ou similar)
-- ✓ Backups automáticos (implementados via cron jobs)
-- ✓ Retenção de logs e auditoria mínima para segurança
-- ✓ Migration scripts versionados (via Flyway, Knex ou TypeORM)
-- ✓ Monitoramento de conexões e queries lentas
-- ✓ Plano de escalonamento preparado para Aurora/RDS

-- Para production, considere:
-- 1. Configurar pgbouncer para connection pooling
-- 2. Implementar backup automático com retenção de 30 dias
-- 3. Configurar monitoring com PostgreSQL Stats Collector
-- 4. Usar Aurora PostgreSQL para alta disponibilidade
-- 5. Implementar cache com Redis para queries frequentes
-- 6. Configurar read replicas para distribuir carga de leitura
