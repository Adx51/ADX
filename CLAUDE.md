# CLAUDE.md

## Project: ADX Vignoble

Application PWA de gestion de vignoble. React + Vite + Tailwind CSS + backend Express/SQLite auto-hébergé.

## Commands

```bash
# Développement (frontend + backend séparés)
npm run dev          # Frontend Vite sur :5173, proxy vers :3001
npm run server:dev   # Backend Express avec hot-reload sur :3001

# Production (sur le Pi)
npm run build        # Build React → dist/
npm run server       # Démarrer le serveur Express (sert aussi dist/)

# Docker (déploiement Pi)
docker compose up -d        # Démarrer
docker compose logs -f adx  # Logs
docker compose down         # Arrêter
```

## Architecture

```
server/                     # Backend Node.js/Express
  index.js                  # Point d'entrée Express
  db.js                     # SQLite (better-sqlite3) + schéma + triggers
  middleware/auth.js         # Vérification JWT
  routes/
    auth.js                 # POST /api/auth/login|register, GET /api/auth/me
    parcelles.js            # CRUD /api/parcelles
    taches.js               # CRUD /api/taches
    vendanges.js            # CRUD /api/vendanges (avec chargements inclus dans GET /:id)
    chargements.js          # CRUD /api/chargements
    photos.js               # POST /api/photos (multer → data/photos/)
  .env.example              # Variables d'environnement serveur
  package.json              # Dépendances serveur indépendantes

src/                        # Frontend React
  lib/
    api.js                  # Client fetch JWT (remplace supabase.js)
    surface.js              # Centiares ↔ "32 A 21", rendement kg/ha
    uploadPhoto.js          # POST /api/photos (multipart)
    offlineQueue.js         # File IndexedDB pour opérations hors ligne
  contexts/
    AuthContext.jsx          # Auth JWT (token dans localStorage)
    OfflineContext.jsx       # Détection online/offline
  components/
    Layout.jsx / BottomNav.jsx / PageHeader.jsx / PhotoInput.jsx / OfflineBanner.jsx
  pages/
    auth/Login.jsx, Register.jsx
    parcelles/ ParcellesList, ParcelleDetail, ParcelleForm
    taches/    TachesList, TacheForm
    vendange/  VendangesList, VendangeDetail, VendangeForm, ChargementForm

Dockerfile                  # Build multi-stage (frontend puis serveur)
docker-compose.yml          # Service adx, volume adx-data (SQLite + photos)
scripts/
  install-pi.sh             # Script d'installation sur Raspbian/Debian
  install-portainer.md      # Guide installation via Portainer (HAOS)
```

## Base de données SQLite

- `parcelles` — surface en **centiares** (32a 21ca = 3221 ca), GPS, photo
- `taches` — statut (a_faire/en_cours/termine), priorité, date_echeance, photo
- `vendanges` — une par parcelle par année ; poids_total/nb_caisses_total mis à jour par triggers SQLite
- `chargements` — date, heure_livraison, nombre_caisses, poids_kg

Schéma auto-créé au démarrage du serveur (db.js).

## Déploiement sur Raspberry Pi avec Home Assistant

Le Pi tourne déjà Home Assistant → utiliser **Docker** pour isoler l'app.

**HAOS (Home Assistant OS) :**
→ Voir `scripts/install-portainer.md` — ajouter via Portainer add-on HA

**Raspbian/Debian avec HA Container :**
```bash
cd /opt && git clone <repo> adx-vignoble && cd adx-vignoble
cp server/.env.example .env.local
# Éditer .env.local : générer JWT_SECRET
bash scripts/install-pi.sh
```

**Accès :**
- Réseau local : `http://IP-PI:3001`
- Depuis l'extérieur : Tailscale (add-on HA officiel) → `http://100.x.x.x:3001`

## Conventions

- Auth : JWT dans localStorage (`adx_token`), durée 30 jours
- Tailwind custom: `vigne-*` (vert), `amber-*` (vendange)
- Surface stockée en **centiares**, affichée "X A YY" via `caToDisplay()`
- Rendement = poids_total / surface_plantee_ha → kg/ha
- Pas de fichier .env à la racine pour le frontend (pas de Supabase)
- Git branch pattern: `claude/<description>`, push: `git push -u origin <branch>`
