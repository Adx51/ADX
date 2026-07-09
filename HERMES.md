# Briefing HERMES — Add-on « LF-Boyer Vignoble » (ADX)

> Document destiné à l'agent Hermes qui administre Home Assistant sur le Pi.
> **Lis ceci avant toute action touchant les add-ons, Docker, le stockage ou le réseau.**

## Ce que c'est

L'add-on local **« LF-Boyer Vignoble »** (slug `adx_vignoble`) est une application
métier de gestion du vignoble : parcelles, tâches, vendanges (pesées kg par kg),
traitements phytosanitaires réglementaires. Elle est utilisée **tous les jours,
sur téléphone, dans les vignes**, par plusieurs utilisateurs. Ce n'est pas un
gadget domotique : les données qu'elle contient (historique des vendanges,
registre phyto) sont **irremplaçables et à valeur réglementaire**.

Elle n'a **aucune intégration avec Home Assistant** (pas d'entité, pas de
capteur, pas d'automatisation). HA lui sert uniquement d'hébergeur : Supervisor
la construit et la fait tourner comme add-on local. Il n'y a donc **rien à
« optimiser », migrer ou nettoyer** la concernant.

## Où vivent les choses

| Emplacement | Contenu | Risque |
|---|---|---|
| `/share/adx` | Clone git du code source (branche `claude/vineyard-management-app-x5DHq`) | Ne pas supprimer, ne pas changer de branche, pas de `git reset`/`checkout` |
| `/addons/adx_vignoble/` | Fichiers de l'add-on local (Dockerfile, config.yaml, run.sh, sources synchronisées par `deploy.sh`) | Le supprimer = l'add-on disparaît de HA |
| `/data` du conteneur (géré par Supervisor) | **`adx.db` (SQLite = TOUTES les données), `photos/`, `backups/` (5 sauvegardes rotatives, une toutes les 30 min), `options.json` (jwt_secret)** | **ZONE INTERDITE — perte définitive si supprimé** |
| Port `3001/tcp` | Interface web + API, exposée derrière un tunnel Cloudflare | Ne pas changer le port, ne pas toucher au tunnel |

## Interdictions absolues

1. **Ne JAMAIS désinstaller l'add-on `adx_vignoble`** — Supervisor supprime alors
   son dossier `/data` : base de données, photos ET sauvegardes perdues d'un coup.
2. **Ne JAMAIS exécuter** `docker rm`, `docker volume rm/prune`, `docker system prune --volumes`
   ou tout équivalent visant le conteneur de l'add-on (`addon_local_adx_vignoble`).
   Ne jamais `docker compose down -v` où que ce soit sur cette machine.
3. **Ne pas modifier la configuration de l'add-on**, en particulier `jwt_secret` :
   le changer invalide les sessions de tous les utilisateurs (déconnexion forcée
   sur tous les téléphones, jetons valables 30 jours).
4. **Ne pas supprimer ni déplacer** `/share/adx` et `/addons/adx_vignoble`.
5. **Ne pas toucher au tunnel Cloudflare** ni au port 3001 — l'app est utilisée
   depuis l'extérieur via ce tunnel.
6. **Pas de mise à jour/rebuild/redémarrage de l'add-on de ta propre initiative.**
   Le déploiement est déclenché par Antoine uniquement.

## Ce qui est sans danger

- **Redémarrer l'add-on** (ou le Pi) : OK si nécessaire. La base est en mode
  `journal DELETE` + `synchronous FULL`, avec sauvegarde automatique au démarrage
  et toutes les 30 min, et auto-restauration depuis le dernier backup si la base
  principale est vide/corrompue. Éviter quand même les heures de pointe
  (les vendanges en septembre-octobre : ne rien redémarrer sans demander).
- **Mises à jour de Home Assistant / Supervisor / OS** : OK, l'add-on redémarre
  tout seul derrière.
- **Sauvegardes HA complètes** : recommandé — **toujours inclure l'add-on
  `adx_vignoble`** dans les sauvegardes (son `/data` en fait partie). C'est la
  seule copie hors du dossier de l'add-on.

## Procédure de déploiement (uniquement quand Antoine le demande)

```bash
cd /share/adx
git pull origin claude/vineyard-management-app-x5DHq
./deploy.sh        # synchronise les sources vers /addons/adx_vignoble
```
Puis dans l'interface HA : **Paramètres → Add-ons → LF-Boyer Vignoble →
Reconstruire** (le build compile le frontend, ~3-5 min). L'app est indisponible
pendant le rebuild : prévenir avant.

## En cas de doute

Si une action que tu envisages touche de près ou de loin à `/share/adx`,
`/addons/adx_vignoble`, au conteneur `addon_local_adx_vignoble`, à ses volumes,
au port 3001 ou au tunnel Cloudflare : **ne fais rien et demande à Antoine**.
Une erreur ici ne casse pas une lumière connectée — elle efface des années
d'historique de vendanges.
