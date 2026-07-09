#!/bin/bash
# ============================================================
# ADX Vignoble — Installation sur Raspberry Pi
# Fonctionne côte à côte avec Home Assistant via Docker
# ============================================================
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     ADX Vignoble — Install Pi        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Vérifications ────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "❌ Docker non trouvé."
  echo "   Sur HAOS : installez l'add-on 'Portainer' et utilisez install-portainer.md"
  echo "   Sur Raspbian/Debian : curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! command -v docker compose &>/dev/null 2>&1; then
  echo "❌ docker compose non trouvé. Installez Docker Compose v2."
  exit 1
fi

INSTALL_DIR="${1:-/opt/adx-vignoble}"
echo "📁 Répertoire d'installation : $INSTALL_DIR"

# ── Cloner / copier les fichiers ──────────────────────────────
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Générer la clé JWT ────────────────────────────────────────
if [ ! -f .env.local ]; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null \
               || openssl rand -hex 64)
  cat > .env.local <<EOF
JWT_SECRET=$JWT_SECRET
EOF
  echo "✅ Clé JWT générée dans .env.local"
else
  echo "✅ .env.local existant conservé"
fi

# ── Build et démarrage ────────────────────────────────────────
echo ""
echo "🔨 Build de l'image Docker..."
docker compose build --no-cache

echo ""
echo "🚀 Démarrage du container..."
docker compose up -d

echo ""
echo "✅ ADX Vignoble est démarré !"
echo ""

# ── Afficher l'IP ─────────────────────────────────────────────
PI_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Accès sur le réseau local :"
echo "   http://$PI_IP:3001"
echo ""
echo "📱 Pour accéder depuis l'extérieur (champs, cave) :"
echo "   Installez Tailscale sur le Pi et votre téléphone"
echo "   https://tailscale.com/download"
echo ""
echo "📋 Commandes utiles :"
echo "   docker compose logs -f adx    # voir les logs"
echo "   docker compose restart adx    # redémarrer"
echo "   docker compose down           # arrêter"
echo "   docker compose pull && docker compose up -d  # mettre à jour"
