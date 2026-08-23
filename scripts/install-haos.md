# Installation ADX Vignoble sur ton Pi (HAOS 17.2)

IP du Pi : **192.168.1.43**

## Méthode recommandée : Add-on local HA

### Étape 1 — Copier le dossier de l'add-on

Ouvre le **terminal SSH** (add-on déjà installé) ou **Studio Code Server**.

Dans le terminal :
```bash
# Aller dans le dossier config de HA
cd /config

# Créer le dossier addons s'il n'existe pas
mkdir -p addons

# Option A — depuis le réseau (si tu as accès internet sur le Pi)
wget -qO /tmp/adx-addon.tar.gz \
  https://github.com/Adx51/ADX/archive/refs/heads/main.tar.gz
tar xzf /tmp/adx-addon.tar.gz -C /tmp
cp -r /tmp/ADX-main/addons/adx /config/addons/adx_vignoble
rm -rf /tmp/ADX-main /tmp/adx-addon.tar.gz

# Option B — si tu as cloné le repo sur le Pi
# cp -r /share/ADX/addons/adx /config/addons/adx_vignoble
```

### Étape 2 — HA détecte l'add-on

Dans Home Assistant :
1. **Paramètres → Add-ons → Boutique des add-ons**
2. Cliquer les **3 points** (en haut à droite) → **Vérifier les mises à jour**
3. Chercher "ADX Vignoble" → il apparaît dans "Local add-ons"
4. Cliquer → **Installer** (le build prend ~5 minutes, ça compile le frontend React)

### Étape 3 — Configurer le JWT Secret

1. Dans l'add-on ADX → onglet **Configuration**
2. Renseigner `jwt_secret` avec une chaîne aléatoire longue :
   ```
   Exemple : 8f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
   ```
   Tu peux en générer une depuis le terminal :
   ```bash
   cat /proc/sys/kernel/random/uuid | tr -d '-'
   ```
3. **Sauvegarder**

### Étape 4 — Démarrer

1. Onglet **Info** → **Démarrer**
2. L'app est accessible sur : **http://192.168.1.43:3001**

---

## Accès depuis l'extérieur via Cloudflared

Tu as déjà **Cloudflared** qui tourne ! Pour exposer l'app :

1. Dans l'add-on Cloudflared → **Configuration**
2. Ajouter dans `additional_hosts` :
   ```yaml
   - hostname: vignoble.ton-domaine.fr
     service: http://localhost:3001
   ```
3. Redémarrer Cloudflared

L'app sera accessible en HTTPS depuis n'importe où : `https://vignoble.ton-domaine.fr`

> Si tu n'as pas encore de domaine configuré dans Cloudflared, va dans le dashboard
> Cloudflare → Zero Trust → Tunnels pour configurer un nouveau hostname.

---

## Données et sauvegardes

Les données sont dans le volume de l'add-on (`/data/`) :
- `/data/adx.db` — base SQLite (tout l'historique)
- `/data/photos/` — toutes les photos

HA sauvegarde automatiquement les données des add-ons dans ses **snapshots/backups**.
Tes données vignoble sont donc incluses dans tes sauvegardes HA habituelles. ✅

---

## Mise à jour

Quand une nouvelle version est disponible :
1. Retélécharger le dossier addon (Étape 1)
2. Reconstruire dans HA → onglet Info → **Reconstruire**

Tes données ne sont pas affectées par une mise à jour (elles sont dans `/data`).
