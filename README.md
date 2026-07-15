# 🍷 ADX — Cave à vin premium propulsée par l'IA

Plateforme web & mobile de gestion de cave à vin, pensée pour être **plus complète que
Vivino, CellarTracker ou Oeni** : inventaire précis, valorisation type portefeuille
boursier, assistant sommelier conversationnel et scan par vision IA.

> État actuel : **fondation fonctionnelle**. L'architecture, le modèle de données
> complet, l'API cœur (caves, bouteilles, IA, statistiques) et un frontend premium
> sont en place. Voir la [feuille de route](#feuille-de-route) pour la suite.

## ✨ Fonctionnalités livrées

- **Authentification** — inscription / connexion JWT (bcrypt), guard global, routes protégées côté API et web
- **Inventaire complet** — ajouter, modifier, supprimer, consommer, acheter plusieurs bouteilles
- **Structure physique de la cave** — zones (murs) → casiers → emplacements précis (colonne/rangée/niveau), avec glisser-déposer
- **Enrichissement IA automatique** — fiche technique, cépages, fenêtre de garde, accords mets/vins, histoire du domaine
- **Valorisation IA** — estimation min/moyenne/max, plus-value et rendement comme un portefeuille
- **Assistant Sommelier IA** — chat contextualisé sur votre cave réelle
- **Scanner IA** — endpoints vision pour bouteille, caisse entière et facture
- **Alertes de garde** — apogée, à boire avant, à conserver
- **Statistiques & répartition** — par couleur, région, pays, millésime
- **Design premium** — thème sombre élégant, verre dépoli, graphiques

## 🏗️ Architecture

Monorepo (npm workspaces + Turborepo) :

```
apps/
  api/        NestJS + Prisma — API REST (/api)
  web/        Next.js 14 (App Router) + Tailwind + Recharts + Framer Motion
packages/
  database/   Schéma Prisma partagé + client + seed
```

Détails dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Stack

| Couche | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Framer Motion, Recharts |
| Backend | NestJS, PostgreSQL, Prisma |
| IA | OpenAI GPT (chat + vision), embeddings, pgvector (recherche vectorielle) |
| Infra | Docker, Docker Compose, GitHub Actions CI |

## 🚀 Démarrage rapide

### Prérequis
- Node.js ≥ 20
- Docker (pour PostgreSQL + pgvector)

### Installation

```bash
npm install     # installe tout le monorepo
npm run setup   # DB + schéma + données de démo (en une commande)
npm run dev     # lance api (:4000) + web (:3000)
```

<details>
<summary>Équivalent détaillé (si vous préférez étape par étape)</summary>

```bash
cp .env.example .env          # renseignez OPENAI_API_KEY si vous l'avez
docker compose up -d db       # PostgreSQL + pgvector
npm run db:generate           # génère le client Prisma
npm run db:push               # crée le schéma
npm run db:seed               # jeu de données de démo
npm run dev                   # lance api (:4000) + web (:3000)
```

</details>

- Web : http://localhost:3000 (redirige vers `/login`)
- API : http://localhost:4000/api/health

Connectez-vous avec le compte de démonstration créé par le seed :

- **E-mail** : `demo@adx.wine`
- **Mot de passe** : `demo1234`

(ou créez un compte via `/register`).

> **Sans clé OpenAI**, l'application fonctionne quand même : l'IA passe en mode
> dégradé (heuristiques). La base de données et l'API doivent en revanche
> tourner, l'authentification étant désormais requise.

### Tout via Docker

```bash
docker compose up --build
```

## 📚 API (extrait)

Toutes les routes exigent un en-tête `Authorization: Bearer <token>`, sauf
`/api/auth/*` et `/api/health` (`@Public()`).

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Créer un compte → `{ accessToken, user }` |
| `POST` | `/api/auth/login` | Se connecter → `{ accessToken, user }` |
| `GET` | `/api/auth/me` | Profil de l'utilisateur courant |
| `GET` | `/api/cellars` | Liste des caves de l'utilisateur |
| `POST` | `/api/cellars` | Créer une cave |
| `POST` | `/api/cellars/:id/zones` | Ajouter un mur/zone |
| `POST` | `/api/cellars/zones/:zoneId/racks` | Ajouter un casier (matérialise les emplacements) |
| `GET` | `/api/bottles` | Inventaire (filtres `cellarId`, `q`, `status`) |
| `POST` | `/api/bottles` | Ajouter une bouteille (enrichissement + valorisation IA) |
| `POST` | `/api/bottles/:id/consume` | Consommer |
| `POST` | `/api/bottles/:id/move` | Déplacer vers un emplacement |
| `POST` | `/api/bottles/:id/revaluate` | Réestimer la valeur |
| `POST` | `/api/ai/sommelier` | Poser une question au sommelier |
| `POST` | `/api/ai/scan/bottle\|case\|invoice` | Scan vision |
| `GET` | `/api/stats/overview\|distribution\|alerts` | Statistiques & alertes |

## 🧭 Feuille de route

Priorités pour atteindre la vision complète :

1. ~~**Authentification** — JWT (register/login/me), guard global, protection des routes~~ ✅ **fait**
2. **Upload & Vision réels** — pipeline S3/Supabase + appels vision sur photos
3. **Recherche vectorielle** — génération d'embeddings + recommandations pgvector
4. **Historique de valorisation** — job planifié alimentant `PricePoint` + graphiques temporels
5. **App mobile** (React Native / Expo) partageant `packages/`
6. **Temps réel & offline** — synchronisation multi-appareils, mode hors connexion
7. **Import/Export** — Vivino, CellarTracker, PDF, Excel

## 📄 Licence

Propriétaire — tous droits réservés.
