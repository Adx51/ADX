# ─── Build ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
RUN npm install

COPY . .
RUN npm run db:generate
RUN npm run build -w @adx/api

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/package.json ./apps/api/

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
