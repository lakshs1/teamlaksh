FROM node:20-alpine

WORKDIR /app

# Copy root and package manifests for layer caching
COPY package.json ./
COPY db/package*.json ./db/
COPY backend/package*.json ./backend/

# Install dependencies in db and backend
RUN npm --prefix db ci
RUN npm --prefix backend ci

# Copy source code
COPY db ./db
COPY backend ./backend

WORKDIR /app/backend

EXPOSE 5000

# Push Drizzle schema, seed demo users, then launch Express API server
CMD ["sh", "-c", "npm --prefix ../db run db:push && npx tsx src/scripts/seed_demo_users.ts && npx tsx src/index.ts"]
