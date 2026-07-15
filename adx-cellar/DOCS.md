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
   > La première installation **compile** l'application (téléchargement + build).
   > Comptez plusieurs minutes ; prévoyez une machine avec assez de RAM
   > (≥ 2 Go recommandés — un build complet peut être lourd sur petit matériel).
4. Onglet **Configuration** (facultatif) :
   - `openai_api_key` : votre clé OpenAI pour activer le Sommelier IA,
     l'enrichissement automatique des fiches et le scan. Sans clé, tout le reste
     fonctionne en mode dégradé.
   - `jwt_secret` : laissez vide pour qu'un secret soit généré et conservé
     automatiquement.
5. **Démarrer**, puis **Ouvrir l'interface web** (ou `http://<votre-HA>:3000`).

## Connexion

Un compte de démonstration est créé au premier démarrage :

- **E-mail** : `demo@adx.wine`
- **Mot de passe** : `demo1234`

Vous pouvez aussi créer votre propre compte via l'écran d'inscription.

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

## Notes

- Architectures supportées : **amd64** et **aarch64** (64 bits). L'ARM 32 bits
  (armv7/armhf) n'est pas couvert par le dépôt APT de PostgreSQL.
- Cet add-on est en version initiale ; l'intégration en barre latérale (Ingress)
  et des images pré-compilées (installation instantanée sans build) sont des
  évolutions prévues.
