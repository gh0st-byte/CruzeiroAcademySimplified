-- Migration: 20250828000002_indexes_and_triggers
-- Description: Create indexes, triggers, and views for performance optimization
-- Author: Cruzeiro Academy Team
-- Date: 2025-08-28

-- ===================================================================
-- ÍNDICES COMPOSTOS PARA PERFORMANCE
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
-- TRIGGERS DE AUDITORIA AUTOMÁTICA
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
-- VIEWS ÚTEIS PARA CONSULTAS FREQUENTES
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
