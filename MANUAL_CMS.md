# CRUZEIRO ACADEMY CMS - MANUAL DE OPERAÇÕES

## INDICE

1. [Visão Geral do Sistema](#1-visao-geral-do-sistema)
2. [Arquitetura Multi-Tenant](#2-arquitetura-multi-tenant)
3. [Controle de Acesso e Permissões](#3-controle-de-acesso-e-permissoes)
4. [Gestão de Escolas (Tenants)](#4-gestao-de-escolas-tenants)
5. [Gestão de Usuários](#5-gestao-de-usuarios)
6. [Gestão de Conteúdo](#6-gestao-de-conteudo)
7. [Sistema de Páginas por Blocos](#7-sistema-de-paginas-por-blocos)
8. [Gestão de Mídia](#8-gestao-de-midia)
9. [Navegação e Menus](#9-navegacao-e-menus)
10. [Configurações do Site](#10-configuracoes-do-site)
11. [Auditoria e Monitoramento](#11-auditoria-e-monitoramento)
12. [API GraphQL](#12-api-graphql)
13. [Fluxos de Trabalho](#13-fluxos-de-trabalho)

---

## 1. VISAO GERAL DO SISTEMA

O Cruzeiro Academy CMS é um sistema de gestão de conteúdo multi-tenant projetado para gerenciar landing pages de academias de futebol em diferentes países.

### Características Principais:
- Sistema multi-tenant por país/região
- Gestão de conteúdo localizado por idioma
- Sistema de páginas por blocos modulares
- Interface administrativa completa
- API GraphQL para integração
- Controle de acesso baseado em roles
- Auditoria e monitoramento integrados

### Tecnologias:
- Backend: KeystoneJS 6 + TypeScript
- Banco de Dados: PostgreSQL 17
- API: GraphQL
- Autenticação: Cookie-based sessions
- Container: Docker + Docker Compose

---

## 2. ARQUITETURA MULTI-TENANT

### Conceito de Tenant:
Cada "School" representa um tenant (inquilino) do sistema, correspondendo a uma academia em um país específico.

### Tenants Padrão:
- **brazil**: Cruzeiro Academy Brasil (pt-BR, BRL)
- **usa**: Cruzeiro Academy USA (en-US, USD) 
- **japan**: Cruzeiro Academy Japan (ja-JP, JPY)
- **peru**: Cruzeiro Academy Peru (es-PE, PEN)
- **colombia**: Cruzeiro Academy Colombia (es-CO, COP)
- **thailand**: Cruzeiro Academy Thailand (th-TH, THB)

### Isolamento de Dados:
Todas as entidades principais possuem campo `tenant` que referencia uma School, garantindo isolamento completo dos dados entre diferentes academias.

---

## 3. CONTROLE DE ACESSO E PERMISSOES

### Roles Disponíveis:

#### Super Admin
- **Acesso**: Todas as operações em todos os tenants
- **Capacidades**: 
  - Criar/editar/deletar Schools
  - Gerenciar todos os usuários
  - Acessar logs de auditoria
  - Configurações avançadas do sistema

#### Admin  
- **Acesso**: Todas as operações dentro do seu tenant
- **Capacidades**:
  - Gerenciar usuários do tenant
  - Todas as operações de conteúdo
  - Configurações do site
  - Visualizar estatísticas

#### Editor
- **Acesso**: Criação e edição de conteúdo
- **Capacidades**:
  - Criar/editar conteúdos
  - Upload de mídia
  - Gerenciar categorias
  - Editar páginas por blocos
  - Gerenciar menus de navegação

#### Viewer
- **Acesso**: Apenas visualização
- **Capacidades**:
  - Visualizar conteúdos
  - Acessar relatórios básicos

### Localização dos Controles:
- Arquivo: `/backend/CmsCruzeiro/schema.ts`
- Funções: `isAdmin()`, `isEditor()`, `canViewUser()`
- Linha: 7-23

---

## 4. GESTAO DE ESCOLAS (TENANTS)

### Localização na Interface:
- **Navegação**: Schools (menu principal)
- **Acesso**: Apenas Super Admin

### Campos Principais:
- **name**: Nome da academia
- **country**: Código do país (ISO 3166-1 alpha-3)
- **country_name**: Nome do país
- **timezone**: Fuso horário
- **language**: Idioma padrão
- **currency**: Moeda padrão
- **domain**: Domínio personalizado
- **slug**: Identificador único
- **status**: active/inactive/maintenance
- **settings**: Configurações específicas (JSON)

### Operações Disponíveis:
1. **Criar Nova Escola**: Adicionar academia em novo país
2. **Editar Configurações**: Alterar settings regionais
3. **Ativar/Desativar**: Controlar acesso ao tenant
4. **Configurar Domínio**: Definir subdomínio personalizado

### Arquivo de Configuração:
- Schema: `schema.ts` linha 25-60
- Tabela: `schools`

---

## 5. GESTAO DE USUARIOS

### Localização na Interface:
- **Navegação**: Cms Users
- **Acesso**: Admin e Super Admin

### Campos Principais:
- **tenant**: Escola vinculada
- **email**: Email único no sistema
- **first_name / last_name**: Nome completo
- **role**: Nível de acesso
- **avatar_url**: Foto do perfil
- **is_active**: Status ativo/inativo
- **last_login**: Último acesso

### Operações Disponíveis:
1. **Criar Usuário**: Adicionar novo membro da equipe
2. **Alterar Role**: Modificar permissões
3. **Ativar/Desativar**: Controlar acesso
4. **Reset Password**: Redefinir senha
5. **Visualizar Atividade**: Ver último login

### Arquivo de Configuração:
- Schema: `schema.ts` linha 63-88
- Tabela: `cms_users`

### Autenticação:
- Arquivo: `/backend/CmsCruzeiro/auth.ts`
- Sessão: 30 dias de duração
- Login: Via email + senha

---

## 6. GESTAO DE CONTEUDO

### Localização na Interface:
- **Navegação**: Contents
- **Acesso**: Editor, Admin, Super Admin

### Tipos de Conteúdo:
- **article**: Artigos informativos
- **page**: Páginas institucionais
- **news**: Notícias e novidades
- **event**: Eventos e competições

### Estados do Conteúdo:
- **draft**: Rascunho (não público)
- **published**: Publicado (visível)
- **archived**: Arquivado (não visível)
- **scheduled**: Agendado para publicação

### Campos Principais:
- **tenant**: Escola proprietária
- **category**: Categoria de organização
- **author**: Autor do conteúdo
- **title**: Título principal
- **slug**: URL amigável
- **excerpt**: Resumo/descrição
- **body**: Conteúdo principal
- **featured_image_url**: Imagem destacada
- **meta_title/meta_description**: SEO
- **language**: Idioma do conteúdo
- **is_featured**: Destaque na home
- **published_at**: Data de publicação
- **expires_at**: Data de expiração

### Operações Disponíveis:
1. **Criar Conteúdo**: Novo artigo/página
2. **Editar Conteúdo**: Modificar existente
3. **Publicar**: Tornar visível ao público
4. **Arquivar**: Remover da visualização
5. **Agendar Publicação**: Publicar em data específica
6. **Configurar SEO**: Otimizar para buscadores
7. **Gerenciar Categorias**: Organizar conteúdo

### Arquivo de Configuração:
- Schema: `schema.ts` linha 115-161
- Tabela: `contents`

---

## 7. SISTEMA DE PAGINAS POR BLOCOS

Este é o sistema modular para criar landing pages personalizadas.

### Conceito:
- **Section**: Área da página (home, about, contact)
- **Block**: Elemento dentro da seção
- **Elements**: Componentes específicos (carousel, texto, banner, etc.)

### 7.1. SECTIONS (Seções)

#### Localização na Interface:
- **Navegação**: Sections
- **Acesso**: Editor, Admin, Super Admin

#### Campos:
- **tenant**: Escola proprietária
- **key**: Identificador único (ex: "home", "about")
- **title**: Título da seção
- **description**: Descrição da seção
- **is_active**: Status ativo/inativo
- **sort_order**: Ordem de exibição

#### Operações:
1. **Criar Seção**: Nova área da página
2. **Editar Seção**: Modificar configurações
3. **Ativar/Desativar**: Controlar visibilidade
4. **Reordenar**: Alterar ordem de exibição

#### Arquivo: `schema.ts` linha 282-313

### 7.2. BLOCKS (Blocos)

#### Localização na Interface:
- **Navegação**: Blocks
- **Acesso**: Editor, Admin, Super Admin

#### Tipos Disponíveis:
- **carousel**: Carrossel de imagens
- **richText**: Texto rico
- **imageBanner**: Banner com imagem
- **videoEmbed**: Vídeo incorporado
- **customBlock**: Bloco personalizado

#### Campos:
- **section**: Seção proprietária
- **type**: Tipo do bloco
- **title**: Título do bloco
- **order**: Ordem dentro da seção
- **visible**: Visibilidade
- **data**: Dados extras (JSON)

#### Operações:
1. **Criar Bloco**: Adicionar elemento à seção
2. **Escolher Tipo**: Definir tipo de conteúdo
3. **Configurar Elemento**: Ajustar propriedades específicas
4. **Reordenar**: Alterar posição na seção
5. **Mostrar/Ocultar**: Controlar visibilidade

#### Arquivo: `schema.ts` linha 315-351

### 7.3. CAROUSEL

#### Localização na Interface:
- **Navegação**: Carousels
- **Acesso**: Editor, Admin, Super Admin

#### Campos:
- **name**: Nome identificador
- **autoplay**: Reprodução automática
- **interval_ms**: Intervalo em milissegundos
- **show_arrows**: Exibir setas de navegação
- **show_dots**: Exibir pontos indicadores
- **aspect_ratio**: Proporção da imagem

#### Imagens do Carousel:
- **url**: URL da imagem
- **alt**: Texto alternativo
- **caption**: Legenda
- **link_url**: URL de destino
- **order**: Ordem de exibição

#### Arquivo: `schema.ts` linha 353-417

### 7.4. RICH TEXT

#### Localização na Interface:
- **Navegação**: Rich Texts
- **Acesso**: Editor, Admin, Super Admin

#### Campos:
- **name**: Nome identificador
- **content**: Conteúdo em JSON
- **text_align**: Alinhamento do texto

#### Arquivo: `schema.ts` linha 419-441

### 7.5. IMAGE BANNER

#### Localização na Interface:
- **Navegação**: Image Banners
- **Acesso**: Editor, Admin, Super Admin

#### Campos:
- **name**: Nome identificador
- **url**: URL da imagem
- **alt**: Texto alternativo
- **link_url**: URL de destino
- **overlay_text**: Texto sobreposto
- **overlay_position**: Posição do texto

#### Arquivo: `schema.ts` linha 443-476

### 7.6. VIDEO EMBED

#### Localização na Interface:
- **Navegação**: Video Embeds
- **Acesso**: Editor, Admin, Super Admin

#### Provedores Suportados:
- YouTube
- Vimeo  
- Twitch
- Direct URL

#### Campos:
- **provider**: Provedor do vídeo
- **video_id**: ID do vídeo
- **video_url**: URL completa
- **autoplay**: Reprodução automática
- **controls**: Controles do player

#### Arquivo: `schema.ts` linha 478-519

### 7.7. CUSTOM BLOCK

#### Localização na Interface:
- **Navegação**: Custom Blocks
- **Acesso**: Editor, Admin, Super Admin

#### Uso:
Permite criar blocos personalizados com componentes React customizados.

#### Campos:
- **name**: Nome identificador
- **component_name**: Nome do componente React
- **data**: Dados do componente (JSON)
- **css_classes**: Classes CSS
- **inline_styles**: Estilos inline

#### Arquivo: `schema.ts` linha 521-543

---

## 8. GESTAO DE MIDIA

### Localização na Interface:
- **Navegação**: Media Files
- **Acesso**: Editor, Admin, Super Admin

### Campos Principais:
- **tenant**: Escola proprietária
- **uploaded_by**: Usuário que fez upload
- **filename**: Nome do arquivo no sistema
- **original_filename**: Nome original
- **file_path**: Caminho no servidor
- **file_url**: URL pública
- **mime_type**: Tipo de arquivo
- **file_size**: Tamanho em bytes
- **width/height**: Dimensões (imagens)
- **alt_text**: Texto alternativo
- **caption**: Legenda

### Operações Disponíveis:
1. **Upload de Arquivo**: Enviar nova mídia
2. **Editar Metadados**: Alterar alt, caption
3. **Organizar**: Vincular a carousels/banners
4. **Deletar**: Remover arquivo

### Tipos Suportados:
- Imagens: JPG, PNG, GIF, WebP
- Vídeos: MP4, WebM
- Documentos: PDF

### Arquivo de Configuração:
- Schema: `schema.ts` linha 163-195
- Tabela: `media_files`

---

## 9. NAVEGACAO E MENUS

### 9.1. NAVIGATION MENUS

#### Localização na Interface:
- **Navegação**: Navigation Menus
- **Acesso**: Editor, Admin, Super Admin

#### Localizações Disponíveis:
- **header**: Menu superior
- **footer**: Menu inferior  
- **sidebar**: Menu lateral

#### Campos:
- **name**: Nome do menu
- **slug**: Identificador único
- **location**: Localização na página
- **is_active**: Status ativo

### 9.2. NAVIGATION MENU ITEMS

#### Localização na Interface:
- **Navegação**: Navigation Menu Items
- **Acesso**: Editor, Admin, Super Admin

#### Estrutura Hierárquica:
Suporte a menus multinível com parent/children.

#### Campos:
- **menu**: Menu proprietário
- **parent**: Item pai (para submenus)
- **title**: Texto do link
- **url**: URL de destino
- **content**: Conteúdo vinculado
- **target**: _self ou _blank
- **sort_order**: Ordem de exibição

#### Operações:
1. **Criar Item**: Adicionar link ao menu
2. **Criar Submenu**: Adicionar item hierárquico
3. **Vincular Conteúdo**: Linkar a página/artigo
4. **Reordenar**: Alterar posição no menu

### Arquivo de Configuração:
- Schema: `schema.ts` linha 197-249
- Tabelas: `navigation_menus`, `navigation_menu_items`

---

## 10. CONFIGURACOES DO SITE

### Localização na Interface:
- **Navegação**: Site Settings
- **Acesso**: Admin e Super Admin

### Tipos de Configuração:
- **text**: Textos simples
- **boolean**: Verdadeiro/falso
- **json**: Objetos complexos
- **number**: Valores numéricos

### Configurações Padrão:
- **site_title**: Título do site
- **site_description**: Descrição do site
- **analytics_enabled**: Google Analytics
- **maintenance_mode**: Modo manutenção

### Campos:
- **setting_key**: Chave única da configuração
- **setting_value**: Valor da configuração
- **setting_type**: Tipo de dado
- **is_public**: Visível publicamente
- **description**: Descrição da função

### Operações:
1. **Criar Configuração**: Nova setting
2. **Editar Valor**: Alterar configuração
3. **Ativar/Desativar**: Marcar como público

### Arquivo de Configuração:
- Schema: `schema.ts` linha 251-280
- Tabela: `site_settings`

---

## 11. AUDITORIA E MONITORAMENTO

### 11.1. AUDIT LOGS

#### Localização na Interface:
- **Navegação**: Audit Logs
- **Acesso**: Apenas Admin e Super Admin

#### Funcionalidade:
Sistema automático que registra todas as operações no banco de dados.

#### Campos Registrados:
- **table_name**: Tabela afetada
- **record_id**: ID do registro
- **operation**: INSERT/UPDATE/DELETE/SELECT
- **old_values**: Valores anteriores
- **new_values**: Valores novos
- **user**: Usuário responsável
- **ip_address**: IP de origem
- **session_id**: Sessão ativa

#### Arquivo: `schema.ts` linha 549-583

### 11.2. USER SESSIONS

#### Localização na Interface:
- **Navegação**: User Sessions
- **Acesso**: Apenas Admin e Super Admin

#### Funcionalidade:
Rastreamento de sessões ativas dos usuários.

#### Campos:
- **user**: Usuário proprietário
- **session_token**: Token único
- **ip_address**: IP de acesso
- **is_active**: Status da sessão
- **expires_at**: Data de expiração

#### Arquivo: `schema.ts` linha 585-609

### 11.3. CONNECTION STATS

#### Localização na Interface:
- **Navegação**: Connection Stats
- **Acesso**: Apenas Admin e Super Admin

#### Funcionalidade:
Estatísticas de performance do sistema.

#### Métricas:
- **active_connections**: Conexões ativas
- **total_connections**: Total de conexões
- **slow_queries**: Queries lentas
- **cpu_usage**: Uso de CPU
- **memory_usage**: Uso de memória
- **disk_usage**: Uso de disco

#### Arquivo: `schema.ts` linha 611-634

---

## 12. API GRAPHQL

### Endpoints:
- **Playground**: http://localhost:3000/api/graphql
- **Endpoint**: http://localhost:3000/api/graphql

### Queries Principais:

#### Buscar Schools:
```graphql
query GetSchools {
  schools {
    id
    name
    country
    language
    domain
    status
  }
}
```

#### Buscar Conteúdos por Tenant:
```graphql
query GetContentsByTenant($tenantId: ID!) {
  contents(where: { tenant: { id: { equals: $tenantId } } }) {
    id
    title
    slug
    status
    language
    content_type
    published_at
  }
}
```

#### Buscar Páginas por Blocos:
```graphql
query GetPageSections($tenantId: ID!, $sectionKey: String!) {
  sections(where: { 
    tenant: { id: { equals: $tenantId } },
    key: { equals: $sectionKey }
  }) {
    id
    title
    blocks(where: { visible: { equals: true } }, orderBy: { order: asc }) {
      id
      type
      title
      order
      carousel {
        name
        autoplay
        images(orderBy: { order: asc }) {
          url
          alt
          caption
        }
      }
      richText {
        content
      }
      imageBanner {
        url
        alt
        overlayText
      }
    }
  }
}
```

### Schema GraphQL:
- Arquivo: Gerado automaticamente
- Localização: `/api/graphql`

---

## 13. FLUXOS DE TRABALHO

### 13.1. CONFIGURAÇÃO INICIAL DE TENANT

1. **Acessar Schools**: Como Super Admin
2. **Criar Nova School**: 
   - Definir país e idioma
   - Configurar timezone e moeda
   - Definir domínio e slug
3. **Criar Admin Local**:
   - Acessar Cms Users
   - Vincular ao tenant criado
   - Definir role como 'admin'
4. **Configurar Site Settings**:
   - Título e descrição
   - Configurações regionais
   - Integrações (analytics, etc.)

### 13.2. CRIAÇÃO DE LANDING PAGE

1. **Definir Seções**:
   - Criar Section com key "home"
   - Definir outras seções necessárias
2. **Adicionar Blocos**:
   - Criar Block vinculado à seção
   - Escolher tipo de elemento
3. **Configurar Elementos**:
   - **Carousel**: Adicionar imagens
   - **RichText**: Escrever conteúdo
   - **ImageBanner**: Configurar banner
   - **VideoEmbed**: Incorporar vídeo
4. **Ordenar e Ativar**:
   - Definir ordem dos blocos
   - Ativar visibilidade

### 13.3. GESTÃO DE CONTEÚDO REGULAR

1. **Criar Categorias**:
   - Organizar por tipo de conteúdo
   - Definir hierarquia se necessário
2. **Criar Conteúdo**:
   - Escolher categoria apropriada
   - Escrever título e conteúdo
   - Configurar SEO
   - Definir status de publicação
3. **Upload de Mídia**:
   - Enviar imagens/vídeos
   - Definir metadados
   - Vincular ao conteúdo
4. **Publicação**:
   - Revisar conteúdo
   - Definir data de publicação
   - Ativar status 'published'

### 13.4. CONFIGURAÇÃO DE MENUS

1. **Criar Menu**:
   - Definir localização (header/footer/sidebar)
   - Nomear apropriadamente
2. **Adicionar Itens**:
   - Criar links externos
   - Vincular a conteúdos internos
   - Definir hierarquia
3. **Configurar Comportamento**:
   - Target de abertura
   - Classes CSS personalizadas
   - Ordem de exibição

### 13.5. MONITORAMENTO E MANUTENÇÃO

1. **Verificar Logs de Auditoria**:
   - Acompanhar atividades dos usuários
   - Identificar alterações importantes
2. **Monitorar Sessões**:
   - Verificar sessões ativas
   - Remover sessões inválidas
3. **Acompanhar Performance**:
   - Verificar Connection Stats
   - Monitorar recursos do sistema

---

## ARQUIVOS E LOCALIZAÇÕES

### Arquivos Principais:
- **Schema Principal**: `/backend/CmsCruzeiro/schema.ts`
- **Autenticação**: `/backend/CmsCruzeiro/auth.ts`
- **Configuração Keystone**: `/backend/CmsCruzeiro/keystone.ts`
- **Seed de Dados**: `/backend/CmsCruzeiro/seed.ts`
- **Docker Compose**: `/docker-compose.yml`
- **Schema Prisma**: `/backend/CmsCruzeiro/schema.prisma` (gerado)

### Comandos Úteis:
- **Iniciar CMS**: `npx keystone dev`
- **Reset Database**: `npx prisma migrate reset`
- **Executar Seed**: `npx tsx seed.ts`
- **Generate Schema**: `npx prisma generate`

### URLs de Acesso:
- **Admin Interface**: http://localhost:3000
- **GraphQL API**: http://localhost:3000/api/graphql
- **GraphQL Playground**: http://localhost:3000/api/graphql

### Credenciais Padrão:
- **Email**: marco.repoles@cruzeiro.com
- **Password**: cruzeiro@1921
- **Role**: super_admin

---

## SUPORTE E DESENVOLVIMENTO

### Estrutura do Projeto:
```
/backend/CmsCruzeiro/
├── schema.ts           # Schema principal
├── auth.ts             # Configuração de autenticação  
├── keystone.ts         # Configuração do Keystone
├── seed.ts             # Dados iniciais
├── package.json        # Dependências
└── prisma/             # Schema Prisma (gerado)
```

### Variáveis de Ambiente:
```
DATABASE_URL=postgresql://cruzeiro:cruzeiro1921@localhost:5432/cruzeiro_academy
SESSION_SECRET=cruzeiro1921
PORT=3000
```

Este manual cobre todas as funcionalidades do CMS Cruzeiro Academy. Para dúvidas específicas ou customizações, consulte o código-fonte nos arquivos indicados.
