# ── Image unique : serveur + frontend pré-compilé ────────────
FROM node:22-alpine

# Dépendances natives pour better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite-libs

WORKDIR /app

# Serveur Node.js (source copiée depuis le build context)
COPY server ./server
RUN cd server && npm ci --omit=dev

# Frontend pré-compilé (dist/ inclus dans l'add-on)
COPY dist ./dist

# Script de démarrage
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3001

CMD [ "/run.sh" ]
