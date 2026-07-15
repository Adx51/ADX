# Architecture ADX

## Vue d'ensemble

ADX est un **monorepo** (npm workspaces + Turborepo) organisé en applications
déployables (`apps/`) et bibliothèques partagées (`packages/`).

```
┌─────────────┐        HTTP/REST         ┌──────────────┐      Prisma      ┌────────────┐
│   web       │ ───────────────────────▶ │   api        │ ───────────────▶ │ PostgreSQL │
│  Next.js    │  /api/*                   │  NestJS      │                  │ + pgvector │
└─────────────┘                           └──────┬───────┘                  └────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  OpenAI      │  chat · vision · embeddings
                                          └──────────────┘
```

## Modèle de données

Le schéma (`packages/database/prisma/schema.prisma`) sépare deux notions clés :

- **`Wine`** — le vin *canonique* (domaine + cuvée + millésime), dédupliqué et
  enrichi par l'IA une seule fois. Porte la fiche technique, la fenêtre de garde,
  les accords, et un `embedding vector(1536)` pour la recherche sémantique.
- **`Bottle`** — une *possession* concrète dans une cave : quantité, prix d'achat,
  valorisation, emplacement, notes personnelles.

Cette séparation évite de dupliquer l'enrichissement IA à chaque bouteille et
permet d'agréger les cotes de marché (`PricePoint`) au niveau du vin.

### Structure physique

`Cellar → Zone (mur) → Rack (casier) → Position (colonne/rangée/niveau)`

Chaque `Position` référence au plus une `Bottle` (`bottleId` unique), ce qui
garantit qu'on sait exactement où se trouve chaque bouteille et rend le
glisser-déposer trivial : déplacer une bouteille = réaffecter un `bottleId`.

### Multi-utilisateurs

`Membership` relie `User` et `Cellar` avec un `Role`
(`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`) — partage familial et gestion des droits.

## Backend (NestJS)

Modules :

| Module | Responsabilité |
| --- | --- |
| `PrismaModule` | Client Prisma partagé (global) |
| `AiModule` | `OpenAiService` (wrapper tolérant aux pannes), `EnrichmentService`, `SommelierService`, `ScannerService` |
| `WinesModule` | Résolution *find-or-create* + enrichissement du vin canonique |
| `BottlesModule` | CRUD, consommation, achat, déplacement, revalorisation |
| `CellarsModule` | Caves + zones + casiers (matérialisation des emplacements) |
| `StatsModule` | Portefeuille, répartitions, alertes de garde |

**Tolérance aux pannes IA** : `OpenAiService.isEnabled` est vérifié partout ;
sans `OPENAI_API_KEY`, l'enrichissement et la valorisation basculent sur des
heuristiques et l'application reste pleinement fonctionnelle.

**Authentification (provisoire)** : `@CurrentUserId()` lit l'en-tête `x-user-id`
(ou `DEMO_USER_ID`). Les points d'appel sont déjà en place — il suffira de
brancher un guard JWT (Auth.js/Clerk) qui peuple `req.user` sans toucher aux
contrôleurs.

## Frontend (Next.js App Router)

- **Server Components** pour les pages data (dashboard, bouteilles, portefeuille),
  avec `withFallback()` qui affiche des données de démo si l'API est injoignable.
- **Client Components** pour l'interactif (chat sommelier, grille de casier
  drag-and-drop).
- **Design system** : Tailwind avec palette bordeaux/or, effet verre dépoli,
  Recharts pour la data-viz, thème sombre par défaut.

## Scalabilité (100k+ bouteilles)

- Index sur `(cellarId, status)`, `wineId`, `region`, `country`, `color`.
- `Wine` dédupliqué → l'enrichissement IA (coûteux) ne s'exécute qu'une fois par vin.
- `pgvector` pour la recherche sémantique et les recommandations à grande échelle.
- Champs de valorisation dénormalisés sur `Bottle` pour des requêtes de
  portefeuille rapides sans jointure sur l'historique.

## Déploiement

- **Dockerfiles multi-stage** pour `api` et `web`.
- **docker-compose** orchestre `db` (pgvector) + `api` + `web`.
- **CI GitHub Actions** : install → generate Prisma → typecheck → lint → build.
- Cible production : conteneurs orchestrables (Kubernetes), migrations via
  `prisma migrate deploy`.
