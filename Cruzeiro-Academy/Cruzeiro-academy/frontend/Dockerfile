# frontend/Dockerfile.dev
FROM node:22-alpine

WORKDIR /app

# Evita re-instalar desnecessário
COPY package.json package-lock.json* ./
RUN npm install

# Código vem via volume (bind mount)
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
