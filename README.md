# Cruzeiro Academy CMS - Backend API

Sistema de Gestão de Conteúdo (CMS) multi-tenant para Cruzeiro Academy com arquitetura Keystone stateless, autenticação JWT, controle de acesso por roles e filtros geográficos automáticos via CloudFront.

##  Arquitetura

### Características Principais

- **Multi-tenancy**: Isolamento completo de dados por escola/país usando `tenant_id`
- **Autenticação JWT**: Tokens stateless com `tenant_id` embutido
- **Controle de Acesso**: Sistema de roles (super_admin, admin, editor, viewer)
- **Filtros Geográficos**: Detecção automática de país via CloudFront headers
- **Upload Seguro**: AWS S3 com URLs pré-assinadas
- **Auditoria Completa**: Logs estruturados para CloudWatch
- **Monitoramento**: Health checks, métricas e readiness probes
- **Migrations Controladas**: Sistema versionado para alterações no DB

### Tecnologias Utilizadas

- **Runtime**: Node.js 22+ com ES Modules
- **Framework**: Express.js com middleware personalizados
- **Database**: PostgreSQL com conexão pooled
- **Storage**: AWS S3 para arquivos/mídia
- **Logging**: Winston com CloudWatch integration
- **Security**: Helmet, CORS, Rate Limiting, JWT
- **Validation**: Joi para validação de entrada
- **Cloud**: AWS (S3, Secrets Manager, CloudWatch)

##  Quick Start

### Pré-requisitos

```bash
# Node.js 22+
node --version

# PostgreSQL 17+
psql --version

# AWS CLI configurado (opcional)
aws --version
```

###  Status do Projeto

**EM ANDAMENTO**

### 1. Instalação

```bash
# Clonar repositório
git clone <repo-url>
cd CruzeiroAcademy

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas configurações
```

### 2. Configuração do Banco de Dados

```bash
# Criar banco de dados
createdb cruzeiro_academy

# Executar migrations
npm run migrate
# ou para dry-run: node src/migrations/run-migrations.js up --dry-run

# Verificar status
node src/migrations/run-migrations.js status
```

### 3. Configuração de Ambiente

Edite o arquivo `.env`:

```env
# Database
DATABASE_URL=postgresql://cruzeiro:cruzeiro1921@localhost:5432/cruzeiro_academy

# JWT (development only)
JWT_SECRET=RVVBTU9NVUlUT0pFU1VT

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=cruzeiro-academy-media

# CORS
CORS_ORIGIN=http://localhost:3000,https://cms.cruzeiroacademy.com
```

### 4. Executar

```bash
# Desenvolvimento
npm run dev

# Produção
npm start

# Ver logs
tail -f logs/app.log
```

##  API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
Todos os endpoints administrativos requerem autenticação JWT:

```bash
Authorization: Bearer <access_token>
```

### Endpoints Principais

####  Autenticação
```bash
# Login
POST /api/v1/auth/login
{
  "email": "admin@cruzeiroacademy.com",
  "password": "password123"
}

# Refresh Token
POST /api/v1/auth/refresh
{
  "refreshToken": "refresh_token_here"
}

# Logout
POST /api/v1/auth/logout

# Perfil do usuário
GET /api/v1/auth/me
```

####  APIs Públicas (Filtradas por País)
```bash
# Listar conteúdos (filtrados automaticamente por CloudFront-Viewer-Country)
GET /api/v1/public/contents?page=1&limit=20&category=noticias

# Conteúdo específico
GET /api/v1/public/contents/meu-artigo-slug

# Categorias
GET /api/v1/public/categories

# Escolas disponíveis
GET /api/v1/public/schools

# Busca
GET /api/v1/public/search?q=futebol&limit=10
```

####  APIs Administrativas
```bash
# Conteúdos (CRUD completo)
GET /api/v1/admin/contents
POST /api/v1/admin/contents
PUT /api/v1/admin/contents/:id
DELETE /api/v1/admin/contents/:id

# Upload de mídia
POST /api/v1/admin/media/upload
# Form-data: files[]

# URL assinada para upload direto
POST /api/v1/admin/media/presigned-upload
{
  "fileName": "image.jpg",
  "contentType": "image/jpeg"
}

# Usuários (Admin only)
GET /api/v1/admin/users

# Dashboard
GET /api/v1/admin/dashboard/stats?period=7d

# Configurações
GET /api/v1/admin/settings
PUT /api/v1/admin/settings/site_title
```

####  Monitoramento
```bash
# Health check
GET /health

# Readiness probe
GET /ready

# Métricas
GET /metrics

# Informações do sistema
GET /info
```

##  Multi-Tenancy

### Como Funciona

O sistema detecta automaticamente o país do usuário via CloudFront headers e filtra todo o conteúdo pela escola correspondente:

```javascript
// Header enviado pelo CloudFront
CloudFront-Viewer-Country: BR

// Sistema mapeia:
BR -> BRA -> Cruzeiro Academy Brasil (tenant_id)
US -> USA -> Cruzeiro Academy USA (tenant_id)  
JP -> JPN -> Cruzeiro Academy Japan (tenant_id)
```

### Escolas/Tenants Disponíveis

1. **Brasil** (`BRA`) - `br.cruzeiroacademy.com`
2. **Estados Unidos** (`USA`) - `us.cruzeiroacademy.com`
3. **Japão** (`JPN`) - `jp.cruzeiroacademy.com`
4. **Peru** (`PER`) - `pe.cruzeiroacademy.com`
5. **Colômbia** (`COL`) - `co.cruzeiroacademy.com`
6. **Tailândia** (`THA`) - `th.cruzeiroacademy.com`

##  Sistema de Roles

### Hierarquia de Permissões

1. **super_admin**: Acesso total a todos os tenants
2. **admin**: Gestão completa do seu tenant
3. **editor**: Criar/editar conteúdos
4. **viewer**: Apenas leitura

### Controle de Acesso

```javascript
// Middleware aplicado automaticamente
app.use('/admin', authenticate, checkTenantAccess());

// Controle específico por role
app.use('/admin/users', requireAdminAccess);
app.use('/admin/contents', requireWriteAccess); // admin + editor
```

##  Estrutura do Banco de Dados

### Tabelas Principais

- **schools**: Tenants (escolas por país)
- **cms_users**: Usuários administrativos
- **contents**: Conteúdos do CMS
- **content_categories**: Categorias
- **media_files**: Arquivos/mídia
- **site_settings**: Configurações
- **audit_logs**: Logs de auditoria
- **user_sessions**: Sessões JWT

### Diagrama de Relacionamentos

```
schools (tenant) 1:N cms_users
schools (tenant) 1:N contents
schools (tenant) 1:N content_categories
contents N:1 content_categories
contents N:1 cms_users (author)
contents 1:N media_files
```

##  Migrations

### Executar Migrations

```bash
# Ver status
npm run migrate status

# Executar todas pendentes
npm run migrate up

# Dry run (ver o que seria executado)
npm run migrate up --dry-run

# Executar até versão específica
npm run migrate up --target=20250828000002

# Rollback (se arquivo de rollback existir)
npm run migrate rollback 20250828000001
```

### Criar Nova Migration

```bash
# Formato: YYYYMMDDHHMMSS_description.sql
touch src/migrations/sql/20250829120000_add_new_feature.sql

# Rollback (opcional)
touch src/migrations/sql/rollbacks/20250829120000_rollback.sql
```

##  Upload de Arquivos

### Upload Direto (Multipart)

```bash
curl -X POST \
  http://localhost:3000/api/v1/admin/media/upload \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'files=@image1.jpg' \
  -F 'files=@document.pdf'
```

### Upload com URL Pré-assinada (Recomendado)

```bash
# 1. Obter URL assinada
curl -X POST \
  http://localhost:3000/api/v1/admin/media/presigned-upload \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName": "my-image.jpg",
    "contentType": "image/jpeg"
  }'

# 2. Upload direto para S3 usando a URL retornada
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @my-image.jpg
```

##  Deploy

### Docker (Recomendado)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build
docker build -t cruzeiro-academy-cms .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AWS_ACCESS_KEY_ID="..." \
  cruzeiro-academy-cms
```

### AWS ECS/Fargate

```yaml
# task-definition.json (exemplo)
{
  "family": "cruzeiro-academy-cms",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "cms-api",
      "image": "your-ecr-repo:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-credentials"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ]
    }
  ]
}
```

### Configuração de Produção

#### AWS Secrets Manager
```json
{
  "host": "your-rds-endpoint.amazonaws.com",
  "port": 5432,
  "dbname": "cruzeiro_academy",
  "username": "cms_user",
  "password": "secure_password"
}
```

#### Environment Variables
```env
NODE_ENV=production
PORT=3000

# Secrets Manager
DB_SECRET_NAME=cruzeiro-academy/db-credentials
JWT_SECRET_NAME=cruzeiro-academy/jwt-secret

# CloudWatch
CLOUDWATCH_LOG_GROUP=/aws/ecs/cruzeiro-academy-cms
CLOUDWATCH_LOG_STREAM=backend

# S3
S3_BUCKET_NAME=cruzeiro-academy-media-prod
S3_CLOUDFRONT_DOMAIN=media.cruzeiroacademy.com
```

##  Monitoramento e Logs

### Health Checks

```bash
# Load Balancer Health Check
GET /health
# Response: {"status": "healthy", "uptime": 3600}

# Kubernetes Readiness Probe  
GET /ready
# Verifica DB, tabelas críticas, configuração

# Kubernetes Liveness Probe
GET /live
# Verifica se aplicação não está travada
```

### Métricas

```bash
# Métricas da aplicação
GET /metrics

# Formato Prometheus
GET /metrics?format=prometheus

# Informações do sistema
GET /info
```

### CloudWatch Integration

```javascript
// Logs estruturados automaticamente
logger.info('User login', {
  userId: 'uuid',
  tenantId: 'uuid',
  ip: '192.168.1.1',
  context: 'authentication'
});

// Auditoria automática
logger.audit('content_created', 'contents', userId, tenantId, {
  contentId: 'uuid',
  title: 'New Article'
});
```

##  Desenvolvimento

### Estrutura do Código

```
src/
├── config/          # Configurações (DB, Logger, etc)
├── middleware/      # Middlewares customizados
├── routes/          # Definição de rotas
├── controllers/     # Lógica de negócio
├── services/        # Serviços (Auth, Upload, etc)
├── models/          # Models/DTOs (se necessário)
├── utils/           # Utilitários
├── migrations/      # Migrations do banco
│   ├── sql/         # Arquivos .sql
│   └── rollbacks/   # Rollbacks (opcional)
└── scripts/         # Scripts utilitários
```

### Comandos de Desenvolvimento

```bash
# Desenvolvimento com hot reload
npm run dev

# Executar migrations
npm run migrate

# Linting
npm run lint

# Formatação
npm run format

# Testes
npm test
```

### Debugging

```bash
# Logs detalhados
DEBUG=cms:* npm run dev

# Correlação de requests
# Cada request recebe X-Correlation-ID automático

# Debug específico de módulo
DEBUG=cms:auth,cms:database npm run dev
```

##  Segurança

### Medidas Implementadas

1. **Rate Limiting**: 1000 req/15min global, 10 req/15min auth
2. **CORS**: Configurado para domínios específicos
3. **Helmet**: Headers de segurança HTTP
4. **JWT Secure**: Tokens com expiração e refresh
5. **Audit Logging**: Todas as operações são logadas
6. **SQL Injection**: Queries parametrizadas
7. **Secrets Manager**: Credenciais em produção
8. **HTTPS Only**: Cookies seguros em produção

### Configuração de CORS

```javascript
// Suporte a wildcards
CORS_ORIGIN=https://*.cruzeiroacademy.com,http://localhost:*

// Específico
CORS_ORIGIN=https://cms.cruzeiroacademy.com,https://br.cruzeiroacademy.com
```

##  Troubleshooting

### Problemas Comuns

#### 1. Erro de Conexão com DB
```bash
# Verificar conexão
psql -h localhost -U postgres -d cruzeiro_academy -c "SELECT NOW();"

# Ver logs de conexão
DEBUG=cms:database npm run dev
```

#### 2. JWT Token Inválido
```bash
# Verificar secret
node -e "console.log(process.env.JWT_SECRET)"

# Verificar expiração
GET /api/v1/auth/verify
```

#### 3. Upload Falhando
```bash
# Verificar credenciais AWS
aws s3 ls s3://cruzeiro-academy-media/

# Verificar permissões bucket
aws s3api get-bucket-policy --bucket cruzeiro-academy-media
```

#### 4. CloudFront Country não detectado
```bash
# Testar com header manual
curl -H "CloudFront-Viewer-Country: BR" \
  http://localhost:3000/api/v1/public/contents

# Verificar logs
grep "Location info extracted" logs/app.log
```

### Comandos de Diagnóstico

```bash
# Status geral
GET /health

# Métricas detalhadas
GET /metrics

# Info do sistema
GET /info

# Logs de auditoria
GET /api/v1/admin/audit-logs?operation=LOGIN

# Conexões ativas do DB
SELECT * FROM pg_stat_activity WHERE datname = 'cruzeiro_academy';
```


### Padrões

- **Code Style**: ESLint + Prettier
- **Testing**: Jest para testes unitários

## Documentation
- [**KeystoneJ**](https://keystonejs.com/docs)
- [**Vite**](https://vite.dev/guide/)
- [**React**](https://react.dev/learn)
- [**PostgreeSQL**](https://www.postgresql.org/docs/)
- [**Docker**](https://docs.docker.com/)
- [**UbuntuServer**](https://documentation.ubuntu.com/server/)
- [**AWS-ECS**](https://docs.aws.amazon.com/ecs/)

##  Licença

© Cruzeiro Espote Clube - SAF

---

##  Links Úteis

- [API Documentation](http://localhost:3000/api/v1/docs)
- [Health Check](http://localhost:3000/health)
- [Metrics](http://localhost:3000/metrics)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [AWS S3 SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [Express.js](https://expressjs.com/)
- [Winston Logging](https://github.com/winstonjs/winston)

Para dúvidas ou suporte, entre em contato com a equipe de desenvolvimento.
