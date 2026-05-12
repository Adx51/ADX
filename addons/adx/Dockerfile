# ── Stage 1 : build frontend ──────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Stage 2 : serveur de production ───────────────────────────
FROM node:22-alpine

RUN apk add --no-cache python3 make g++ sqlite-libs

WORKDIR /app

COPY server ./server
RUN cd server && npm ci --omit=dev

COPY --from=builder /app/dist ./dist

COPY addons/adx/run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3001

CMD [ "/run.sh" ]
