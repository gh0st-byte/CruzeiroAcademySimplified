FROM node:22-alpine

WORKDIR /app

# Install dependencies for waiting for database
RUN apt-get update && apt-get install -y netcat-traditional && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Add wait script
COPY <<EOF /wait-for-db.sh
#!/bin/bash
echo "Waiting for database to be ready..."
while ! nc -z db 5432; do
  sleep 1
done
echo "Database is ready!"
exec "\$@"
EOF

RUN chmod +x /wait-for-db.sh

CMD ["/wait-for-db.sh", "npm", "run", "dev"]
