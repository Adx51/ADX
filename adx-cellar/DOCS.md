# ADX — Cave à vin (add-on Home Assistant)

Fait tourner l'application ADX (interface web + API + base PostgreSQL/pgvector)
directement sur votre Home Assistant OS / Supervised.

## Installation

1. **Paramètres → Modules complémentaires → Boutique**.
2. Menu ⋮ (en haut à droite) → **Dépôts** → ajoutez :
   ```
   https://github.com/Adx51/ADX
   ```
3. Le module **« ADX — Cave à vin »** apparaît dans la boutique. Ouvrez-le et
   cliquez sur **Installer**.
   > L'installation **télécharge une image pré-compilée** depuis GHCR (rapide,
   > adaptée au Raspberry Pi) — aucune compilation sur votre machine.
   > *Prérequis : les images doivent avoir été publiées et rendues publiques au
   > préalable — voir « Pour le mainteneur » plus bas.*
4. Onglet **Configuration** (facultatif) :
   - `ai_provider` : `openai` (payant à l'usage) ou **`gemini`** (Google, **palier
     gratuit**). Active le Sommelier IA, l'enrichissement des fiches et le scan
     d'étiquette. Sans clé, tout le reste fonctionne en mode dégradé.
   - `openai_api_key` : la clé du fournisseur choisi.
     - **OpenAI** → https://platform.openai.com (facturé à l'usage).
     - **Gemini (gratuit)** → mettez `ai_provider: gemini` et collez une clé
       obtenue sur **https://aistudio.google.com/apikey**.
   - `ai_model` / `ai_vision_model` : facultatif, pour forcer un modèle précis
     (par défaut : `gpt-4o-mini`/`gpt-4o` pour OpenAI, `gemini-2.0-flash` pour Gemini).
   - `jwt_secret` : laissez vide pour qu'un secret soit généré et conservé
     automatiquement.
   - `seed_demo_data` : **désactivé par défaut**. Activez-le uniquement pour une
     démo — il crée un compte `demo@adx.wine` / `demo1234` aux identifiants
     publics (à éviter sur une instance exposée). Tant qu'il est désactivé, ce
     compte démo est neutralisé (connexion impossible) à chaque démarrage.
5. **Démarrer**, puis **Ouvrir l'interface web** (ou `http://<votre-HA>:3000`).

## Connexion

Au premier lancement, **créez votre compte** via l'écran d'inscription.

> Pour un compte de démonstration prérempli (`demo@adx.wine` / `demo1234`),
> activez l'option `seed_demo_data` puis redémarrez le module.

## Données & persistance

- La base PostgreSQL est stockée dans le volume persistant `/data/pgdata` du
  module : vos bouteilles survivent aux redémarrages et mises à jour.
- Le jeu de démo n'est injecté qu'une seule fois (marqueur `/data/.seeded`).

## Architecture (dans le conteneur)

```
navigateur ──▶ :3000  (Next.js)  ──/api/*──▶ :4000 (NestJS API) ──▶ PostgreSQL+pgvector
```

Seul le port **3000** est exposé ; les appels API passent en *same-origin* et
sont relayés en interne. Rien d'autre n'est accessible depuis l'extérieur.

## Pour le mainteneur — publier les images (une seule fois par version)

L'add-on installe une image pré-compilée. Il faut donc la publier au préalable :

1. **Lancer le build** : onglet **Actions → « Build add-on image » → Run
   workflow** (ou poussez un tag `v0.1.0`). Le workflow construit les images
   **amd64** et **aarch64** et les pousse sur GHCR :
   - `ghcr.io/adx51/adx-cellar-amd64:0.1.0`
   - `ghcr.io/adx51/adx-cellar-aarch64:0.1.0`
2. **Rendre les paquets publics** (pour que HA puisse les tirer sans
   authentification) : sur GitHub → votre profil/orga → **Packages** → chaque
   paquet `adx-cellar-*` → **Package settings → Change visibility → Public**.
3. À chaque nouvelle version, incrémentez `version:` dans `config.yaml` puis
   relancez le workflow (le tag d'image suit automatiquement la version).

> Pour construire **depuis les sources** sur HA plutôt que tirer une image,
> supprimez la ligne `image:` de `config.yaml` : HA utilisera alors le
> `Dockerfile` local (plus lent, surtout sur Raspberry Pi).

## Notes

- Architectures supportées : **amd64** et **aarch64** (64 bits). L'ARM 32 bits
  (armv7/armhf) n'est pas couvert par le dépôt APT de PostgreSQL.
- Version initiale ; l'intégration en barre latérale (Ingress) avec
  l'authentification Home Assistant est une évolution prévue.
