-- Migration: 20250828000003_location_tags_system
-- Description: Add location tags system for centralized content management
-- Author: Cruzeiro Academy Team
-- Date: 2025-08-28

-- ===================================================================
-- 1. TABELA DE LOCATION TAGS (Tags de Localização)
-- ===================================================================
CREATE TABLE location_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE, -- "Brasil", "Estados Unidos", "Japão", "Global"
    code VARCHAR(10) NOT NULL UNIQUE, -- "BRA", "USA", "JPN", "GLOBAL"
    country VARCHAR(3), -- ISO code para mapear com CloudFront (BRA, USA, JPN) - NULL para "Global"
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Cor hex para UI (ex: #3B82F6)
    icon VARCHAR(50), -- Nome do ícone para UI
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 2. TABELA DE RELACIONAMENTO CONTENT-LOCATION (Many-to-Many)
-- ===================================================================
CREATE TABLE content_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    location_tag_id UUID NOT NULL REFERENCES location_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(content_id, location_tag_id)
);

-- ===================================================================
-- 3. SIMPLIFICAR CMS_USERS (Remover tenant_id - Sistema Centralizado)
-- ===================================================================

-- Remover constraint de tenant_id em cms_users (não mais necessário)
ALTER TABLE cms_users DROP CONSTRAINT IF EXISTS cms_users_tenant_id_fkey;
ALTER TABLE cms_users DROP COLUMN IF EXISTS tenant_id;

-- Atualizar roles para sistema centralizado
-- super_admin: Funcionários do Cruzeiro (2 pessoas)
-- viewer: Acesso somente leitura (para relatórios, etc)
ALTER TABLE cms_users ADD CONSTRAINT check_role 
CHECK (role IN ('super_admin', 'viewer'));

-- ===================================================================
-- 4. INSERIR LOCATION TAGS PADRÃO
-- ===================================================================

INSERT INTO location_tags (name, code, country, description, color, icon, sort_order) VALUES
('Global', 'GLOBAL', NULL, 'Conteúdo visível em todas as localidades', '#10B981', 'globe', 1),
('Brasil', 'BRA', 'BRA', 'Conteúdo específico para Brasil', '#16A34A', 'flag-br', 2),
('Estados Unidos', 'USA', 'USA', 'Conteúdo específico para Estados Unidos', '#DC2626', 'flag-us', 3),
('Japão', 'JPN', 'JPN', 'Conteúdo específico para Japão', '#EF4444', 'flag-jp', 4),
('Peru', 'PER', 'PER', 'Conteúdo específico para Peru', '#F59E0B', 'flag-pe', 5),
('Colômbia', 'COL', 'COL', 'Conteúdo específico para Colômbia', '#3B82F6', 'flag-co', 6),
('Tailândia', 'THA', 'THA', 'Conteúdo específico para Tailândia', '#8B5CF6', 'flag-th', 7);

-- ===================================================================
-- 5. ÍNDICES PARA LOCATION TAGS
-- ===================================================================

CREATE INDEX idx_location_tags_code ON location_tags (code);
CREATE INDEX idx_location_tags_country ON location_tags (country);
CREATE INDEX idx_location_tags_active ON location_tags (is_active);

CREATE INDEX idx_content_locations_content ON content_locations (content_id);
CREATE INDEX idx_content_locations_location ON content_locations (location_tag_id);

-- ===================================================================
-- 6. TRIGGERS PARA LOCATION TAGS
-- ===================================================================

-- Trigger de updated_at para location_tags
CREATE TRIGGER update_location_tags_updated_at BEFORE UPDATE ON location_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 7. ATUALIZAR VIEWS EXISTENTES
-- ===================================================================

-- Recriar view published_contents para incluir location tags
DROP VIEW IF EXISTS published_contents;

CREATE VIEW published_contents AS
SELECT 
    c.id,
    s.name as school_name,
    s.country as school_country,
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
    -- Array de location tags
    COALESCE(
        ARRAY_AGG(
            DISTINCT jsonb_build_object(
                'id', lt.id,
                'name', lt.name,
                'code', lt.code,
                'country', lt.country,
                'color', lt.color,
                'icon', lt.icon
            )
        ) FILTER (WHERE lt.id IS NOT NULL),
        ARRAY[]::jsonb[]
    ) as location_tags,
    c.created_at,
    c.updated_at
FROM contents c
JOIN schools s ON c.tenant_id = s.id
JOIN cms_users u ON c.author_id = u.id
LEFT JOIN content_categories cat ON c.category_id = cat.id
LEFT JOIN content_locations cl ON c.id = cl.content_id
LEFT JOIN location_tags lt ON cl.location_tag_id = lt.id AND lt.is_active = true
WHERE c.status = 'published'
  AND (c.expires_at IS NULL OR c.expires_at > NOW())
GROUP BY c.id, s.name, s.country, cat.name, cat.slug, u.first_name, u.last_name;

-- Recriar view tenant_stats para incluir dados de location tags
DROP VIEW IF EXISTS tenant_stats;

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
    SUM(c.view_count) as total_views,
    -- Contagem de conteúdos por location tag
    COUNT(DISTINCT CASE WHEN lt.country = s.country THEN c.id END) as country_specific_contents,
    COUNT(DISTINCT CASE WHEN lt.code = 'GLOBAL' THEN c.id END) as global_contents
FROM schools s
LEFT JOIN contents c ON s.id = c.tenant_id
LEFT JOIN cms_users u ON s.id = u.tenant_id AND u.is_active = true
LEFT JOIN content_categories cat ON s.id = cat.tenant_id AND cat.is_active = true
LEFT JOIN media_files m ON s.id = m.tenant_id AND m.is_active = true
LEFT JOIN content_locations cl ON c.id = cl.content_id
LEFT JOIN location_tags lt ON cl.location_tag_id = lt.id
GROUP BY s.id, s.name, s.country;

-- ===================================================================
-- 8. FUNÇÃO HELPER PARA OBTER CONTEÚDOS POR LOCALIZAÇÃO
-- ===================================================================

-- Função para filtrar conteúdos por país detectado
CREATE OR REPLACE FUNCTION get_contents_by_location(
    detected_country VARCHAR(3) DEFAULT NULL,
    content_limit INTEGER DEFAULT 20,
    content_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    slug VARCHAR(200),
    excerpt TEXT,
    featured_image_url VARCHAR(500),
    content_type VARCHAR(50),
    language VARCHAR(10),
    is_featured BOOLEAN,
    view_count INTEGER,
    published_at TIMESTAMP,
    category_name VARCHAR(100),
    school_name VARCHAR(255),
    school_country VARCHAR(3),
    location_tags JSONB[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id,
        pc.title,
        pc.slug,
        pc.excerpt,
        pc.featured_image_url,
        pc.content_type,
        pc.language,
        pc.is_featured,
        pc.view_count,
        pc.published_at,
        pc.category_name,
        pc.school_name,
        pc.school_country,
        pc.location_tags
    FROM published_contents pc
    WHERE (
        -- Se país detectado, mostrar:
        -- 1. Conteúdos globais
        -- 2. Conteúdos específicos do país
        detected_country IS NULL OR
        EXISTS (
            SELECT 1 FROM unnest(pc.location_tags) as tag
            WHERE (tag->>'code') = 'GLOBAL' OR (tag->>'country') = detected_country
        )
    )
    ORDER BY pc.is_featured DESC, pc.published_at DESC
    LIMIT content_limit OFFSET content_offset;
END;
$$ LANGUAGE plpgsql;
