# Installer ADX Vignoble via Portainer (Home Assistant OS)

Si tu utilises **Home Assistant OS** (HAOS), tu ne peux pas exécuter de commandes shell directement.
La solution la plus simple : **Portainer** (add-on officiel HA).

## Étape 1 : Installer Portainer dans Home Assistant

1. Dans HA → **Paramètres → Add-ons → Boutique**
2. Chercher **"Portainer"**
3. Installer et démarrer
4. Ouvrir l'interface web Portainer

## Étape 2 : Créer le stack ADX dans Portainer

1. Dans Portainer → **Stacks → + Add stack**
2. Nom du stack : `adx-vignoble`
3. Coller ce docker-compose dans l'éditeur :

```yaml
version: "3.8"
services:
  adx:
    image: ghcr.io/adx51/adx:latest   # ou build local si disponible
    container_name: adx-vignoble
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - adx-data:/app/data
    environment:
      NODE_ENV: production
      PORT: "3001"
      JWT_SECRET: "REMPLACER-PAR-UNE-LONGUE-CLE-ALEATOIRE"
      DB_PATH: /app/data/adx.db
      PHOTOS_DIR: /app/data/photos

volumes:
  adx-data:
```

> ⚠️ **Important** : Remplacer `JWT_SECRET` par une chaîne aléatoire longue.
> Tu peux en générer une sur : https://generate-secret.vercel.app/64

4. Cliquer **"Deploy the stack"**

## Étape 3 : Accéder à l'application

Depuis ton réseau local :
```
http://IP-DU-PI:3001
```

## Étape 4 (optionnel) : Accès depuis l'extérieur avec Tailscale

Home Assistant a un **add-on Tailscale officiel** :

1. HA → Add-ons → Boutique → **Tailscale**
2. Installer, configurer et connecter ton compte Tailscale
3. Installer Tailscale sur ton téléphone
4. Accéder à l'app via l'IP Tailscale du Pi : `http://100.x.x.x:3001`

Tailscale crée un VPN privé entre tes appareils — tes données ne passent jamais par internet en clair.

## Alternative : intégration dans le reverse proxy HA

Si tu utilises le **Nginx Proxy Manager** ou **Caddy** add-on dans HA,
tu peux exposer l'app sur un sous-domaine comme `vignoble.ton-domaine.fr`.
