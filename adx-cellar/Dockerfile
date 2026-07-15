ARG BUILD_FROM=node:22-bookworm-slim
FROM ${BUILD_FROM}

# App source to build (overridable from build.yaml args).
ARG ADX_REPO="https://github.com/Adx51/ADX.git"
ARG ADX_REF="claude/wine-cellar-app-tl4zvr"

ENV DEBIAN_FRONTEND=noninteractive

# System deps + PostgreSQL 16 with pgvector from the official PGDG apt repo.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates git curl gnupg openssl jq \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-16 postgresql-16-pgvector \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Fetch and build the monorepo. Dev deps are required for the build step, so we
# do NOT set NODE_ENV=production here (that is set at runtime in run.sh).
RUN git clone --depth 1 --branch "${ADX_REF}" "${ADX_REPO}" . \
  && npm install \
  && npm run db:generate \
  && npm run build -w @adx/api \
  && npm run build -w @adx/web \
  && npm cache clean --force

COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000
CMD ["/run.sh"]
