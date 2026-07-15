#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ADX Home Assistant add-on entrypoint.
# Runs PostgreSQL (pgvector) + the NestJS API + the Next.js web app in one
# container. Database and one-time seed state live in the persistent /data volume.
# ─────────────────────────────────────────────────────────────────────────────
set -e

DATA=/data
PGDATA="$DATA/pgdata"
PGBIN=/usr/lib/postgresql/16/bin
OPTIONS="$DATA/options.json"

# ── Read add-on options (written by the Supervisor) ──────────────────────────
OPENAI_API_KEY="$(jq -r '.openai_api_key // ""' "$OPTIONS" 2>/dev/null || echo "")"
JWT_SECRET="$(jq -r '.jwt_secret // ""' "$OPTIONS" 2>/dev/null || echo "")"
SEED_DEMO_DATA="$(jq -r '.seed_demo_data // false' "$OPTIONS" 2>/dev/null || echo false)"
if [ -z "$JWT_SECRET" ]; then
  # Persist a generated secret so sessions survive restarts.
  if [ -f "$DATA/.jwt_secret" ]; then
    JWT_SECRET="$(cat "$DATA/.jwt_secret")"
  else
    JWT_SECRET="$(openssl rand -hex 32)"
    echo "$JWT_SECRET" > "$DATA/.jwt_secret"
  fi
fi

export OPENAI_API_KEY JWT_SECRET
export DATABASE_URL="postgresql://adx:adx@localhost:5432/adx?schema=public"
export API_INTERNAL_URL="http://localhost:4000"
export API_PORT=4000
export CORS_ORIGIN="*"

# ── Initialise the database cluster on first run ─────────────────────────────
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[adx] Initialising PostgreSQL cluster…"
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust"
fi
chown -R postgres:postgres "$PGDATA"

echo "[adx] Starting PostgreSQL…"
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5432 -k /tmp' -w start"

# Ensure the application role and database exist.
su postgres -c "psql -h /tmp -tAc \"SELECT 1 FROM pg_roles WHERE rolname='adx'\"" | grep -q 1 \
  || su postgres -c "psql -h /tmp -c \"CREATE USER adx WITH PASSWORD 'adx' SUPERUSER;\""
su postgres -c "psql -h /tmp -tAc \"SELECT 1 FROM pg_database WHERE datname='adx'\"" | grep -q 1 \
  || su postgres -c "psql -h /tmp -c \"CREATE DATABASE adx OWNER adx;\""

cd /app

echo "[adx] Syncing schema…"
npm run db:push -w @adx/database

# Demo data is opt-in (off by default): on a public deployment the demo account
# uses well-known credentials. Enable it with the `seed_demo_data` option.
if [ "$SEED_DEMO_DATA" = "true" ]; then
  if [ ! -f "$DATA/.seeded" ]; then
    echo "[adx] Seeding demo data (first run)…"
    # The seed script is named `seed` inside the @adx/database workspace
    # (the root alias is `db:seed`). Use the workspace-local name here.
    npm run seed -w @adx/database && touch "$DATA/.seeded"
  fi
else
  # Neutralise any demo account left over from a previous seeded run so its
  # public credentials can't be used (login requires a non-null password hash).
  echo "[adx] Demo data disabled — ensuring the demo account cannot log in."
  echo "UPDATE users SET \"passwordHash\" = NULL WHERE email = 'demo@adx.wine';" \
    > /tmp/adx_disable_demo.sql
  su postgres -c "psql -h /tmp -d adx -f /tmp/adx_disable_demo.sql" || true
  rm -f /tmp/adx_disable_demo.sql
fi

export NODE_ENV=production

echo "[adx] Starting API on :4000…"
node apps/api/dist/main.js &
API_PID=$!

echo "[adx] Starting web on :3000…"
npm run start -w @adx/web &
WEB_PID=$!

shutdown() {
  echo "[adx] Shutting down…"
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA stop -m fast" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

# Exit if either service dies so the Supervisor can restart the add-on.
wait -n "$API_PID" "$WEB_PID"
shutdown
