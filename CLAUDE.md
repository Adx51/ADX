# CLAUDE.md

## Project: ADX Vignoble

Application PWA de gestion de vignoble. React + Vite + Tailwind CSS + Supabase.

## Commands

```bash
npm run dev      # Serveur de développement (http://localhost:5173)
npm run build    # Build de production (génère dist/ + service worker PWA)
npm run preview  # Prévisualiser le build de production
```

## Architecture

```
src/
  App.jsx                    # Router principal
  main.jsx                   # Point d'entrée React
  index.css                  # Tailwind + styles globaux (.btn-primary, .card, .input)
  contexts/
    AuthContext.jsx           # Auth Supabase (user, signIn, signUp, signOut)
    OfflineContext.jsx        # Détection online/offline + compteur queue
  lib/
    supabase.js              # Client Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    surface.js               # surface centiares ↔ "32 A 21", rendement kg/ha
    uploadPhoto.js           # Upload Supabase Storage bucket "photos"
    offlineQueue.js          # File IndexedDB pour opérations hors ligne
  components/
    Layout.jsx               # Shell : BottomNav + OfflineBanner
    BottomNav.jsx            # Navigation bas (Parcelles / Tâches / Vendange)
    PageHeader.jsx           # Header vert avec bouton retour
    PrivateRoute.jsx         # Redirect /login si non authentifié
    PhotoInput.jsx           # Input photo avec aperçu (capture caméra)
    OfflineBanner.jsx        # Bandeau hors ligne / synchronisation
  pages/
    auth/Login.jsx           # Connexion
    auth/Register.jsx        # Inscription + confirmation email
    parcelles/
      ParcellesList.jsx      # Liste + FAB
      ParcelleDetail.jsx     # Détail + historique vendanges + partage GPS
      ParcelleForm.jsx       # Création/édition (surface en ares/centiares)
    taches/
      TachesList.jsx         # Liste avec filtres statut + toggle rapide
      TacheForm.jsx          # Création/édition avec photo
    vendange/
      VendangesList.jsx      # Liste par année + totaux
      VendangeDetail.jsx     # Détail + chargements groupés par date + kg/ha
      VendangeForm.jsx       # Parcelle + année
      ChargementForm.jsx     # Date, heure, caisses, poids
supabase/
  schema.sql                 # Tables, RLS, triggers, storage
```

## Base de données Supabase

- `parcelles` — surface en **centiares** (32a 21ca = 3221 ca), GPS, photo
- `taches` — statut (a_faire/en_cours/termine), priorité, date_echeance
- `vendanges` — une par parcelle par année ; totaux calculés auto par trigger
- `chargements` — date, heure_livraison, nombre_caisses, poids_kg

Toutes les tables ont RLS activé → chaque utilisateur ne voit que ses données.

## Setup (nouveau projet)

1. Créer un projet sur supabase.com
2. Copier `.env.example` → `.env` et renseigner les deux variables
3. Exécuter `supabase/schema.sql` dans l'éditeur SQL Supabase

## Conventions

- Tailwind custom: `vigne-*` (vert), `amber-*` (vendange/récolte)
- Surface stockée en **centiares** en base, affichée "X A YY" via `caToDisplay()`
- Rendement = poids_total / surface_plantee_ha → kg/ha
- Git branch pattern: `claude/<description>`
- Default branch: `main`
- Push: `git push -u origin <branch-name>`
