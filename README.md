#  Cruzeiro Academy CMS

Um sistema de gerenciamento de conteúdo (CMS) headless multi-tenant desenvolvido para a Cruzeiro Academy, utilizando KeystoneJS 6, React e PostgreSQL.

##  Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Configuração do Ambiente](#configuração-do-ambiente)
- [Instalação e Execução](#instalação-e-execução)
- [API GraphQL](#api-graphql)
- [Funcionalidades](#funcionalidades)
- [Permissões e Acesso](#permissões-e-acesso)
- [Deployment](#deployment)
- [Contribuindo](#contribuindo)

##  Visão Geral

O Cruzeiro Academy CMS é uma plataforma headless desenvolvida para gerenciar conteúdo educacional em múltiplos países e idiomas. O sistema oferece uma arquitetura que permite a gestão de diferentes academias do Cruzeiro ao redor do mundo através de uma única instância.

### Características Principais

- **CMS Headless**: API GraphQL para integração com qualquer frontend
- **Gestão de Conteúdo**: Artigos, páginas, notícias e eventos
- **Sistema de Permissões**: Controle granular de acesso por roles
- **Internacionalização**: Suporte a múltiplos idiomas e moedas
- **Interface Administrativa**: Interface web para gestão de conteúdo

##  Arquitetura

### Visão Geral da Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React/Vite)  │◄───┤   (KeystoneJS)  │◄───┤   (PostgreSQL)  │
│   Port: 5173    │    │   Port: 3000    │    │   Port: 5433    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```


##  Tecnologias

### Backend
- **KeystoneJS 6**: Framework CMS headless
- **TypeScript**: Linguagem de programação
- **GraphQL**: API de consulta e manipulação de dados
- **Prisma**: ORM para banco de dados
- **PostgreSQL**: Banco de dados relacional

### Frontend
- **React 19**: Biblioteca de interface de usuário
- **Vite**: Build tool e dev server
- **ESLint**: Linting de código

### DevOps
- **Docker**: Containerização
- **Docker Compose**: Orquestração de containers
- **PostgreSQL 17**: Banco de dados em container

##  Estrutura do Projeto

```
CruzeiroAcademy/
├── .env.example                    # Template de variáveis de ambiente
├── .gitignore                      # Arquivos ignorados pelo Git
├── README.md                       # Este arquivo
└── Cruzeiro-Academy/
    └── Cruzeiro-academy/
        ├── docker-compose.yml      # Configuração Docker
        ├── backend/
        │   └── CmsCruzeiro/        # Backend KeystoneJS
        │       ├── keystone.ts     # Configuração principal
        │       ├── schema.ts       # Schema do banco de dados
        │       ├── auth.ts         # Configuração de autenticação
        │       ├── seed.ts         # Dados iniciais
        │       ├── package.json    # Dependências do backend
        │       ├── Dockerfile      # Container do backend
        │       └── schema.prisma   # Schema Prisma (auto-gerado)
        ├── frontend/               # Frontend React
        │   ├── src/...
        │   ├── package.json        # Dependências do frontend
        │   ├── vite.config.js      # Configuração Vite
        │   └── Dockerfile          # Container do frontend
        └── db/
            └── data/...            # Dados persistentes PostgreSQL
```

##  Configuração do Ambiente

### 1. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp .env.example Cruzeiro-Academy/Cruzeiro-academy/.env
```

### Variáveis Principais

```env
# Banco de Dados
DATABASE_URL=postgresql://cruzeiro:cruzeiro1921@db:5432/cruzeiro_academy
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cruzeiro_academy

# Autenticação
SESSION_SECRET=cruzeiro1921
JWT_SECRET=your-super-secret-jwt-key

# Servidor
NODE_ENV=development
PORT=3000

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 2. Pré-requisitos

- **Docker** e **Docker Compose** instalados
- **Node.js** 22+ (se executar localmente)
- **PostgreSQL** 17+ (se executar localmente)

##  Instalação e Execução

### Opção 1: Docker Compose (Recomendado)

```bash
# Clone o repositório
git clone <repository-url>
cd CruzeiroAcademy/Cruzeiro-Academy/Cruzeiro-academy

# Execute todos os serviços
docker-compose up -d

# Visualize os logs
docker-compose logs -f
```

### Opção 2: Execução Local

#### Backend

```bash
cd Cruzeiro-Academy/Cruzeiro-academy/backend/CmsCruzeiro

# Instalar dependências
npm install

# Executar migrações do banco
npx prisma migrate dev

# Popular dados iniciais
npm run seed

# Executar em modo desenvolvimento
npm run dev
```

#### Frontend

```bash
cd Cruzeiro-Academy/Cruzeiro-academy/frontend

# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev
```

### 3. Acesso às Aplicações

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Admin CMS**: [http://localhost:3000](http://localhost:3000)
- **GraphQL Playground**: [http://localhost:3000/api/graphql](http://localhost:3000/api/graphql)



##  API GraphQL

### Schema Principal

O sistema oferece uma API GraphQL completa com as seguintes entidades:

#### Entidades Principais

1. **School** 
   - Configurações de escola/academia
   - Informações de localização e idioma
   - Status e configurações personalizadas

2. **User** 
   - Usuários do sistema CMS
   - Roles: super_admin, admin, editor
   - Vinculação a tenant específico

4. **Content**
   - Artigos, páginas, notícias e eventos
   - Status: draft, published, archived, scheduled
   - Metadados SEO e campos personalizados

### Exemplo de Consultas

```graphql
# Buscar conteúdos publicados
query GetPublishedContent {
  contents(where: { status: { equals: "published" } }) {
    id
    title
    excerpt
    publishedAt
    author {
      firstName
      lastName
    }
  }
}

# Criar novo conteúdo
mutation CreateContent($data: ContentCreateInput!) {
  createContent(data: $data) {
    id
    title
    status
  }
}
```

##  Funcionalidades

### Sistema Multi-tenant
- Gestão de múltiplas academias/escolas
- Configurações específicas por região

### Gestão de Conteúdo
- Editor de conteúdo rico
- Categorização hierárquica
- Controle de versão
- Metadados SEO

### Sistema de Usuários
- Autenticação baseada em sessão
- Roles e permissões granulares
- Auditoria de acessos
- Gestão de perfis

### APIs e Integrações
- API GraphQL completa
- Webhooks para integrações
- Suporte a uploads de mídia
- Cache inteligente

##  Permissões e Acesso

### Roles Disponíveis

1. **Super Admin**: Acesso total ao sistema
2. **Admin**: Gestão de editores
3. **Editor**: Criação e edição de conteúdo

### Controle de Acesso

- **Schools**: Apenas admins podem criar/editar
- **Users**: Usuários podem editar próprio perfil
- **Content**: Editores podem criar/editar

##  Docker

### Serviços

- **db**: PostgreSQL 17 (porta 5433)
- **backend**: KeystoneJS (porta 3000)
- **frontend**: React/Vite (porta 5173)

### Comandos Úteis

```bash
# Iniciar todos os serviços
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f

# Parar serviços
docker-compose down

# Rebuild containers
docker-compose up --build

# Acesso ao container do backend
docker-compose exec backend sh

# Backup do banco de dados
docker-compose exec db pg_dump -U postgres admin_db > backup.sql
```

##  Deployment

### Ambiente de Produção

Para produção, configure:

1. **Variáveis de Ambiente Seguras**
   - Use AWS Secrets Manager para credenciais
   - Configure CORS adequadamente
   - Desabilite `initFirstItem`

2. **Banco de Dados**
   - RDS PostgreSQL com backups automáticos
   - Configuração de SSL
   - Monitoring e alertas

3. **Infraestrutura**
   - ECS/EKS para containers
   - CloudFront para CDN
   - ALB para load balancing

##  Monitoramento

### Health Checks
- Endpoint: `/api/health`
- Timeout: 10 segundos
- Logs: CloudWatch

### Métricas
- Contadores de visualização
- Auditoria de ações
- Performance de queries



### Desenvolvimento


### Padrões de Código

- TypeScript para tipagem estática
- ESLint para qualidade de código
- Prisma para migrations
- Commits semânticos

### Testes

```bash
# Backend
cd backend/CmsCruzeiro
npm test

# Frontend
cd frontend
npm run test
```

##  Scripts Disponíveis

### Backend
```bash
npm run dev      # Desenvolvimento
npm run build    # Build para produção
npm run start    # Iniciar produção
npm run seed     # Popular dados iniciais
```

### Frontend
```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build para produção
npm run preview  # Preview do build
npm run lint     # Verificar código
```

##  Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**
   ```bash
   # Verificar se PostgreSQL está rodando
   docker-compose ps
   
   # Verificar logs do banco
   docker-compose logs db
   ```

2. **Erro de permissão**
   - Verifique se o usuário tem a role adequada
   - Confirme se está autenticado

3. **Erro de CORS**
   - Verifique configuração CORS no keystone.ts
   - Confirme URL do frontend nas variáveis

### Logs

```bash
# Logs do backend
docker-compose logs -f backend

# Logs do frontend
docker-compose logs -f frontend

# Logs do banco
docker-compose logs -f db
```

##  Recursos Adicionais

- [Documentação KeystoneJS](https://keystonejs.com/docs)
- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/guide/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

##  Licença

Este projeto é proprietário da Cruzeiro Esporte Clube - SAF.

##  Suporte

Para suporte técnico, entre em contato com a equipe de desenvolvimento:
 *<h3> Email: <i> Marco.Repoles@cruzeiro.com.br </i> </h3>
 <br>

---

**Cruzeiro Academy** - *Formando campeões dentro e fora de campo*
