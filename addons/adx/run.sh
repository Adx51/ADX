#!/usr/bin/with-contenv bashio

# ── JWT Secret ────────────────────────────────────────────────
JWT_SECRET=$(bashio::config 'jwt_secret' || true)

if [ -z "$JWT_SECRET" ]; then
  # Générer automatiquement si non fourni
  JWT_SECRET=$(cat /proc/sys/kernel/random/uuid)$(cat /proc/sys/kernel/random/uuid)
  JWT_SECRET=$(echo "$JWT_SECRET" | tr -d '-')
  bashio::log.warning "jwt_secret non configuré — clé générée automatiquement."
  bashio::log.warning "Note: les sessions seront perdues au redémarrage de l'add-on."
fi

# ── Variables d'environnement ─────────────────────────────────
export NODE_ENV=production
export PORT=3001
export JWT_SECRET="$JWT_SECRET"
export DB_PATH=/data/adx.db
export PHOTOS_DIR=/data/photos

mkdir -p /data/photos

bashio::log.info "ADX Vignoble démarrage sur port 3001..."

exec node /app/server/index.js
