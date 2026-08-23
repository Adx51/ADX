#!/bin/sh

# Lire jwt_secret depuis /data/options.json (injecté par le Supervisor HA)
JWT_SECRET=""
if [ -f /data/options.json ]; then
  JWT_SECRET=$(grep -o '"jwt_secret" *: *"[^"]*"' /data/options.json | sed 's/.*: *"//;s/"//')
fi

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(cat /proc/sys/kernel/random/uuid)$(cat /proc/sys/kernel/random/uuid)
  JWT_SECRET=$(echo "$JWT_SECRET" | tr -d '-')
  echo "Warning: jwt_secret non configuré — clé générée automatiquement."
fi

export NODE_ENV=production
export PORT=3001
export JWT_SECRET="$JWT_SECRET"
export DB_PATH=/data/adx.db
export PHOTOS_DIR=/data/photos

mkdir -p /data/photos

echo "LF-Boyer Vignoble démarrage sur port 3001 (HTTP, derrière Cloudflare)..."
exec node /app/server/index.js
