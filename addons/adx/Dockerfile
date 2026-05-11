# ── Stage 1 : build du frontend React ────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /build

ARG REPO_BRANCH=claude/vineyard-management-app-x5DHq
RUN git clone --depth=1 --branch "${REPO_BRANCH}" \
      https://github.com/Adx51/ADX.git . && \
    rm -rf .git

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
