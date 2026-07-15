#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ADX — one-command local setup.
# Starts the database, syncs the schema and seeds demo data.
# Usage: npm run setup   (then: npm run dev)
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ ADX setup"

if [ ! -f .env ]; then
  echo "  · creating .env from .env.example"
  cp .env.example .env
fi

echo "▸ Starting PostgreSQL (pgvector) via Docker…"
docker compose up -d db

echo "▸ Waiting for the database to accept connections…"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U adx >/dev/null 2>&1; then
    echo "  · database ready"
    break
  fi
  sleep 1
  [ "$i" = "30" ] && { echo "  ✗ database did not become ready"; exit 1; }
done

echo "▸ Generating Prisma client…"
npm run db:generate

echo "▸ Syncing schema…"
npm run db:push

echo "▸ Seeding demo data…"
npm run db:seed

cat <<'EOF'

✅ Setup complete.

  Start the app:   npm run dev
  Web:             http://localhost:3000
  API health:      http://localhost:4000/api/health

  Demo login:      demo@adx.wine  /  demo1234

EOF
