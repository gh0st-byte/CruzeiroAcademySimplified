-- Migration: 20250828000001_initial_schema
-- Description: Create initial CMS schema with multi-tenant support
-- Author: Cruzeiro Academy Team
-- Date: 2025-08-28

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
