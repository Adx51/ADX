# ─────────────────────────────────────────────────────────────────────────────
# Prebuilt Home Assistant add-on image (built in CI, context = repo root).
# Bundles PostgreSQL 16 + pgvector + the NestJS API + the Next.js web app.
# Published to GHCR by .github/workflows/addon-image.yml, then pulled by HA.
# ─────────────────────────────────────────────────────────────────────────────
ARG BUILD_FROM=node:22-bookworm-slim
FROM ${BUILD_FROM}

ENV DEBIAN_FRONTEND=noninteractive

# PostgreSQL 16 + pgvector from the official PGDG apt repository.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates curl gnupg openssl jq \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-16 postgresql-16-pgvector \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching). Dev deps are needed for the build.
COPY package.json package-lock.json* turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
RUN npm install

# Build the API and web app.
COPY . .
RUN npm run db:generate \
  && npm run build -w @adx/api \
  && npm run build -w @adx/web \
  && cp adx-cellar/run.sh /run.sh \
  && chmod +x /run.sh \
  && npm cache clean --force

EXPOSE 3000
CMD ["/run.sh"]
