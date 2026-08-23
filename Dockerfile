# ─── Build frontend ───────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm install          # install all deps for build
RUN npm run build        # génère dist/

# ─── Runtime ──────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Dépendances native pour better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite

# Copier le serveur + le build React
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=builder /app/dist ./dist

# Volumes persistants
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/adx.db
ENV PHOTOS_DIR=/app/data/photos

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3001/api/auth/me || exit 1

CMD ["node", "server/index.js"]
