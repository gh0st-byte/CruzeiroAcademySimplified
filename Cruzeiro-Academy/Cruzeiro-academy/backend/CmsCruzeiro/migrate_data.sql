-- ===================================================================
-- CRUZEIRO ACADEMY CMS - SCRIPT DE MIGRAÇÃO
-- Migra dados existentes para nova estrutura sem perda de dados
-- ===================================================================

BEGIN;

-- Backup das tabelas existentes
CREATE TABLE IF NOT EXISTS schools_backup AS SELECT * FROM schools;
CREATE TABLE IF NOT EXISTS content_categories_backup AS SELECT * FROM content_categories;
CREATE TABLE IF NOT EXISTS site_settings_backup AS SELECT * FROM site_settings;

-- Verificar se as tabelas têm a nova estrutura
-- Se não tiver, criar temporariamente

-- 1. Atualizar tabela schools para usar cuid() se necessário
DO $$
BEGIN
  -- Verificar se a coluna id é UUID ou cuid
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schools' 
    AND column_name = 'id' 
    AND data_type = 'text'
  ) THEN
    -- Criar nova coluna temporária
    ALTER TABLE schools ADD COLUMN new_id TEXT;
    -- Gerar cuid para cada registro (simulando com generate_random_uuid convertido para texto)
    UPDATE schools SET new_id = 'c' || replace(gen_random_uuid()::text, '-', '');
    
    -- Atualizar referências em outras tabelas
    ALTER TABLE cms_users ADD COLUMN new_tenant_id TEXT;
    UPDATE cms_users SET new_tenant_id = s.new_id FROM schools s WHERE cms_users.tenant_id = s.id;
    
    ALTER TABLE content_categories ADD COLUMN new_tenant_id TEXT;
    UPDATE content_categories SET new_tenant_id = s.new_id FROM schools s WHERE content_categories.tenant_id = s.id;
    
    ALTER TABLE contents ADD COLUMN new_tenant_id TEXT;
    UPDATE contents SET new_tenant_id = s.new_id FROM schools s WHERE contents.tenant_id = s.id;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_settings') THEN
      ALTER TABLE site_settings ADD COLUMN new_tenant_id TEXT;
      UPDATE site_settings SET new_tenant_id = s.new_id FROM schools s WHERE site_settings.tenant_id = s.id;
    END IF;
    
    -- Dropar constraints de FK antigas
    ALTER TABLE cms_users DROP CONSTRAINT IF EXISTS cms_users_tenant_id_fkey;
    ALTER TABLE content_categories DROP CONSTRAINT IF EXISTS content_categories_tenant_id_fkey;
    ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_tenant_id_fkey;
    
    -- Remover colunas antigas
    ALTER TABLE schools DROP COLUMN id CASCADE;
    ALTER TABLE cms_users DROP COLUMN tenant_id;
    ALTER TABLE content_categories DROP COLUMN tenant_id;
    ALTER TABLE contents DROP COLUMN tenant_id;
    
    -- Renomear colunas novas
    ALTER TABLE schools RENAME COLUMN new_id TO id;
    ALTER TABLE cms_users RENAME COLUMN new_tenant_id TO tenant_id;
    ALTER TABLE content_categories RENAME COLUMN new_tenant_id TO tenant_id;
    ALTER TABLE contents RENAME COLUMN new_tenant_id TO tenant_id;
    
    -- Adicionar constraints
    ALTER TABLE schools ADD PRIMARY KEY (id);
    ALTER TABLE cms_users ADD CONSTRAINT cms_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES schools(id);
    ALTER TABLE content_categories ADD CONSTRAINT content_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES schools(id);
    ALTER TABLE contents ADD CONSTRAINT contents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES schools(id);
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_settings') THEN
      ALTER TABLE site_settings DROP COLUMN tenant_id;
      ALTER TABLE site_settings RENAME COLUMN new_tenant_id TO tenant_id;
      ALTER TABLE site_settings ADD CONSTRAINT site_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES schools(id);
    END IF;
  END IF;
END $$;

-- 2. Atualizar content_categories para usar cuid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_categories' 
    AND column_name = 'id' 
    AND data_type = 'text'
  ) THEN
    -- Similar ao processo acima para content_categories
    ALTER TABLE content_categories ADD COLUMN new_id TEXT;
    UPDATE content_categories SET new_id = 'c' || replace(gen_random_uuid()::text, '-', '');
    
    -- Atualizar referências em contents
    ALTER TABLE contents ADD COLUMN new_category_id TEXT;
    UPDATE contents SET new_category_id = cc.new_id FROM content_categories cc WHERE contents.category_id = cc.id;
    
    -- Atualizar auto-referências em content_categories
    ALTER TABLE content_categories ADD COLUMN new_parent_id TEXT;
    UPDATE content_categories SET new_parent_id = cc.new_id FROM content_categories cc WHERE content_categories.parent_id = cc.id;
    
    -- Dropar constraints
    ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_category_id_fkey;
    ALTER TABLE content_categories DROP CONSTRAINT IF EXISTS content_categories_parent_id_fkey;
    
    -- Remover colunas antigas
    ALTER TABLE content_categories DROP COLUMN id CASCADE;
    ALTER TABLE content_categories DROP COLUMN parent_id;
    ALTER TABLE contents DROP COLUMN category_id;
    
    -- Renomear colunas
    ALTER TABLE content_categories RENAME COLUMN new_id TO id;
    ALTER TABLE content_categories RENAME COLUMN new_parent_id TO parent_id;
    ALTER TABLE contents RENAME COLUMN new_category_id TO category_id;
    
    -- Adicionar constraints
    ALTER TABLE content_categories ADD PRIMARY KEY (id);
    ALTER TABLE content_categories ADD CONSTRAINT content_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES content_categories(id);
    ALTER TABLE contents ADD CONSTRAINT contents_category_id_fkey FOREIGN KEY (category_id) REFERENCES content_categories(id);
  END IF;
END $$;

-- 3. Atualizar cms_users para usar cuid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cms_users' 
    AND column_name = 'id' 
    AND data_type = 'text'
  ) THEN
    ALTER TABLE cms_users ADD COLUMN new_id TEXT;
    UPDATE cms_users SET new_id = 'c' || replace(gen_random_uuid()::text, '-', '');
    
    -- Atualizar referências em contents
    ALTER TABLE contents ADD COLUMN new_author_id TEXT;
    UPDATE contents SET new_author_id = u.new_id FROM cms_users u WHERE contents.author_id = u.id;
    
    -- Dropar constraints
    ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_author_id_fkey;
    
    -- Remover colunas antigas
    ALTER TABLE cms_users DROP COLUMN id CASCADE;
    ALTER TABLE contents DROP COLUMN author_id;
    
    -- Renomear colunas
    ALTER TABLE cms_users RENAME COLUMN new_id TO id;
    ALTER TABLE contents RENAME COLUMN new_author_id TO author_id;
    
    -- Adicionar constraints
    ALTER TABLE cms_users ADD PRIMARY KEY (id);
    ALTER TABLE contents ADD CONSTRAINT contents_author_id_fkey FOREIGN KEY (author_id) REFERENCES cms_users(id);
  END IF;
END $$;

-- 4. Atualizar contents para usar cuid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contents' 
    AND column_name = 'id' 
    AND data_type = 'text'
  ) THEN
    ALTER TABLE contents ADD COLUMN new_id TEXT;
    UPDATE contents SET new_id = 'c' || replace(gen_random_uuid()::text, '-', '');
    
    -- Remover coluna antiga
    ALTER TABLE contents DROP COLUMN id CASCADE;
    
    -- Renomear coluna
    ALTER TABLE contents RENAME COLUMN new_id TO id;
    
    -- Adicionar constraint
    ALTER TABLE contents ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 5. Renomear colunas do Keystone (tenant_id -> tenant, etc.)
DO $$
BEGIN
  -- Renomear tenant_id para tenant em cms_users
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cms_users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE cms_users RENAME COLUMN tenant_id TO tenant;
  END IF;
  
  -- Renomear tenant_id para tenant em content_categories
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_categories' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE content_categories RENAME COLUMN tenant_id TO tenant;
  END IF;
  
  -- Renomear tenant_id para tenant em contents
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contents' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE contents RENAME COLUMN tenant_id TO tenant;
  END IF;
  
  -- Renomear category_id para category em contents
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contents' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE contents RENAME COLUMN category_id TO category;
  END IF;
  
  -- Renomear author_id para author em contents
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contents' AND column_name = 'author_id'
  ) THEN
    ALTER TABLE contents RENAME COLUMN author_id TO author;
  END IF;
  
  -- Renomear parent_id para parent em content_categories
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE content_categories RENAME COLUMN parent_id TO parent;
  END IF;
END $$;

COMMIT;

-- Verificação final
SELECT 'Migration completed successfully' as status;
