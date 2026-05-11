# ── Stage 1 : build du frontend React ────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

# Télécharge la source depuis GitHub (branche principale)
ARG REPO_URL=https://github.com/Adx51/ADX/archive/refs/heads/claude%2Fvineyard-management-app-x5DHq.tar.gz
ADD ${REPO_URL} /tmp/repo.tar.gz
RUN tar xzf /tmp/repo.tar.gz -C /build --strip-components=1

RUN npm ci && npm run build

# ── Stage 2 : runtime serveur ─────────────────────────────────
FROM node:22-alpine

# Dépendances natives pour better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite-libs

WORKDIR /app

# Serveur Node.js
COPY --from=builder /build/server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY --from=builder /build/server ./server

# Frontend buildé
COPY --from=builder /build/dist ./dist

# Script de démarrage
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3001

CMD [ "/run.sh" ]
