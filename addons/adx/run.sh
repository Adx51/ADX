#!/bin/sh

# Lire jwt_secret depuis /data/options.json (injecté par le Supervisor HA)
JWT_SECRET=""
SSL_CERT=""
SSL_KEY=""
if [ -f /data/options.json ]; then
  JWT_SECRET=$(grep -o '"jwt_secret" *: *"[^"]*"' /data/options.json | sed 's/.*: *"//;s/"//')
  SSL_CERT=$(grep -o '"ssl_cert" *: *"[^"]*"' /data/options.json | sed 's/.*: *"//;s/"//')
  SSL_KEY=$(grep -o '"ssl_key" *: *"[^"]*"' /data/options.json | sed 's/.*: *"//;s/"//')
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

# SSL : priorité aux fichiers fixes adx.crt/adx.key, sinon options.json
if [ -f "/ssl/adx.crt" ] && [ -f "/ssl/adx.key" ]; then
  export SSL_CERT_PATH="/ssl/adx.crt"
  export SSL_KEY_PATH="/ssl/adx.key"
  echo "ADX Vignoble : HTTPS activé (adx.crt)"
elif [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
  if [ -f "/ssl/$SSL_CERT" ] && [ -f "/ssl/$SSL_KEY" ]; then
    export SSL_CERT_PATH="/ssl/$SSL_CERT"
    export SSL_KEY_PATH="/ssl/$SSL_KEY"
    echo "ADX Vignoble : HTTPS activé avec $SSL_CERT"
  else
    echo "Warning: fichiers SSL introuvables dans /ssl/ — démarrage en HTTP."
  fi
fi

mkdir -p /data/photos

echo "ADX Vignoble démarrage sur port 3001..."
exec node /app/server/index.js
