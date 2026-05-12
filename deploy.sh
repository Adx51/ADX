#!/bin/sh
# Déploiement ADX Vignoble → /addons/adx_vignoble/
# Usage: cd /share/adx && git pull && ./deploy.sh
# Puis dans HA : Add-ons → LF-Boyer Vignoble → Reconstruire

set -e

ADDON_DIR="/addons/adx_vignoble"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "→ Synchronisation vers $ADDON_DIR..."

cp "$REPO_DIR/addons/adx/config.yaml" "$ADDON_DIR/config.yaml"
cp "$REPO_DIR/addons/adx/run.sh"      "$ADDON_DIR/run.sh"
cp "$REPO_DIR/addons/adx/Dockerfile"  "$ADDON_DIR/Dockerfile"
chmod +x "$ADDON_DIR/run.sh"

cp -r "$REPO_DIR/dist/."   "$ADDON_DIR/dist/"
cp -r "$REPO_DIR/server/." "$ADDON_DIR/server/"

echo "✓ Fichiers synchronisés."
echo ""
echo "→ Maintenant dans Home Assistant :"
echo "   Add-ons → LF-Boyer Vignoble → Reconstruire"
