import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH    = process.env.DB_PATH || path.join(__dirname, '../data/adx.db')
const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
fs.mkdirSync(BACKUP_DIR, { recursive: true })

// ─── Auto-restore : si la BDD principale est vide/absente, restaurer le backup ──
function dbHasData(filePath) {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) return false
    const probe = Database(filePath, { readonly: true })
    const row = probe.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1`).get()
    let count = 0
    if (row) {
      count = probe.prepare(`SELECT COUNT(*) AS n FROM users`).get().n
    }
    probe.close()
    return count > 0
  } catch {
    return false
  }
}

function latestBackup() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    return files[0] ? path.join(BACKUP_DIR, files[0].f) : null
  } catch { return null }
}

if (!dbHasData(DB_PATH)) {
  const backup = latestBackup()
  if (backup && dbHasData(backup)) {
    console.log(`⚠ BDD principale vide — restauration depuis ${backup}`)
    fs.copyFileSync(backup, DB_PATH)
  }
}

// ─── Ouverture BDD ────────────────────────────────────────────────────────────

const db = Database(DB_PATH)
// DELETE mode : données toujours dans le fichier principal, pas de WAL à désynchroniser
db.pragma('journal_mode = DELETE')
db.pragma('foreign_keys = ON')
db.pragma('synchronous = FULL')

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS parcelles (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom                 TEXT NOT NULL,
    surface_totale_ca   INTEGER,
    surface_plantee_ca  INTEGER,
    nombre_routes       INTEGER,
    cepage              TEXT,
    gps_lat             REAL,
    gps_lng             REAL,
    photo_url           TEXT,
    notes               TEXT,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS taches (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parcelle_id    TEXT REFERENCES parcelles(id) ON DELETE SET NULL,
    titre          TEXT NOT NULL,
    description    TEXT,
    statut         TEXT DEFAULT 'a_faire'
                       CHECK (statut IN ('a_faire','en_cours','termine')),
    priorite       TEXT DEFAULT 'normale'
                       CHECK (priorite IN ('basse','normale','haute')),
    date_echeance  TEXT,
    photo_url      TEXT,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendanges (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parcelle_id      TEXT NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
    annee            INTEGER NOT NULL,
    poids_total      REAL DEFAULT 0,
    nb_caisses_total INTEGER DEFAULT 0,
    notes            TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now')),
    UNIQUE (parcelle_id, annee)
  );

  CREATE TABLE IF NOT EXISTS chargements (
    id               TEXT PRIMARY KEY,
    vendange_id      TEXT NOT NULL REFERENCES vendanges(id) ON DELETE CASCADE,
    nombre_caisses   INTEGER NOT NULL DEFAULT 0,
    poids_kg         REAL NOT NULL DEFAULT 0,
    date_chargement  TEXT NOT NULL,
    heure_livraison  TEXT,
    notes            TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS vendange_totaux_insert
  AFTER INSERT ON chargements BEGIN
    UPDATE vendanges SET
      poids_total      = (SELECT COALESCE(SUM(poids_kg),0)       FROM chargements WHERE vendange_id = NEW.vendange_id),
      nb_caisses_total = (SELECT COALESCE(SUM(nombre_caisses),0) FROM chargements WHERE vendange_id = NEW.vendange_id),
      updated_at       = datetime('now')
    WHERE id = NEW.vendange_id;
  END;

  CREATE TRIGGER IF NOT EXISTS vendange_totaux_update
  AFTER UPDATE ON chargements BEGIN
    UPDATE vendanges SET
      poids_total      = (SELECT COALESCE(SUM(poids_kg),0)       FROM chargements WHERE vendange_id = NEW.vendange_id),
      nb_caisses_total = (SELECT COALESCE(SUM(nombre_caisses),0) FROM chargements WHERE vendange_id = NEW.vendange_id),
      updated_at       = datetime('now')
    WHERE id = NEW.vendange_id;
  END;

  CREATE TRIGGER IF NOT EXISTS vendange_totaux_delete
  AFTER DELETE ON chargements BEGIN
    UPDATE vendanges SET
      poids_total      = (SELECT COALESCE(SUM(poids_kg),0)       FROM chargements WHERE vendange_id = OLD.vendange_id),
      nb_caisses_total = (SELECT COALESCE(SUM(nombre_caisses),0) FROM chargements WHERE vendange_id = OLD.vendange_id),
      updated_at       = datetime('now')
    WHERE id = OLD.vendange_id;
  END;
`)

// ─── Migrations ──────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'antoinex.dufour@gmail.com'

const schemaVersion = db.pragma('user_version', { simple: true })

if (schemaVersion < 1) {
  try { db.exec(`ALTER TABLE users ADD COLUMN prenom TEXT NOT NULL DEFAULT ''`) } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN nom TEXT NOT NULL DEFAULT ''`) } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`) } catch {}
  try { db.exec(`ALTER TABLE parcelles ADD COLUMN commune TEXT`) } catch {}
  try { db.exec(`ALTER TABLE parcelles ADD COLUMN cepages TEXT DEFAULT '[]'`) } catch {}
  try { db.exec(`ALTER TABLE parcelles ADD COLUMN statut TEXT DEFAULT 'en_production'`) } catch {}
  try { db.exec(`ALTER TABLE parcelles ADD COLUMN annee_plantation INTEGER`) } catch {}
  db.prepare(`UPDATE users SET role = 'admin' WHERE email = ?`).run(ADMIN_EMAIL)
  db.pragma('user_version = 1')
}

if (schemaVersion < 2) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS referentiels (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      type   TEXT NOT NULL,
      valeur TEXT NOT NULL,
      ordre  INTEGER DEFAULT 0,
      UNIQUE(type, valeur)
    )
  `)
  const ins = db.prepare(`INSERT OR IGNORE INTO referentiels (type, valeur, ordre) VALUES (?, ?, ?)`)
  ;['Chouilly', 'Hautvillers'].forEach((v, i) => ins.run('commune', v, i))
  ;['Pinot Noir', 'Pinot Meunier', 'Chardonnay', 'Pinot Blanc', 'Pinot Gris', 'Arbane', 'Petit Meslier'].forEach((v, i) => ins.run('cepage', v, i))
  db.pragma('user_version = 2')
}

if (schemaVersion < 3) {
  try { db.exec(`ALTER TABLE parcelles ADD COLUMN reference_cadastrale TEXT`) } catch {}
  db.pragma('user_version = 3')
}

if (schemaVersion < 4) {
  try { db.exec(`ALTER TABLE referentiels ADD COLUMN code_insee TEXT`) } catch {}
  db.prepare(`UPDATE referentiels SET code_insee = '51154' WHERE type = 'commune' AND valeur = 'Chouilly'`).run()
  db.prepare(`UPDATE referentiels SET code_insee = '51301' WHERE type = 'commune' AND valeur = 'Hautvillers'`).run()
  db.pragma('user_version = 4')
}

if (schemaVersion < 5) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campagnes (
      id                      TEXT PRIMARY KEY,
      user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      annee                   INTEGER NOT NULL,
      date_debut              TEXT,
      rendement_attendu_kgha  INTEGER,
      statut                  TEXT NOT NULL DEFAULT 'en_cours'
                                CHECK (statut IN ('en_cours','cloturee')),
      date_cloture            TEXT,
      note_bilan              TEXT,
      created_at              TEXT DEFAULT (datetime('now')),
      updated_at              TEXT DEFAULT (datetime('now')),
      UNIQUE (user_id, annee)
    )
  `)
  db.pragma('user_version = 5')
}

if (schemaVersion < 6) {
  try { db.exec(`ALTER TABLE parcelles ADD COLUMN commune_pressoir TEXT`) } catch {}
  const ins = db.prepare(`INSERT OR IGNORE INTO referentiels (type, valeur, ordre) VALUES (?, ?, ?)`)
  ;[['Cramant', 10], ['Dizy', 11], ['Épernay', 12], ['Mareuil-sur-Aÿ', 13]].forEach(([v, o]) => ins.run('commune', v, o))
  db.prepare(`UPDATE referentiels SET code_insee = '51154' WHERE type = 'commune' AND valeur = 'Chouilly'`).run()
  db.prepare(`UPDATE referentiels SET code_insee = '51301' WHERE type = 'commune' AND valeur = 'Hautvillers'`).run()
  db.prepare(`UPDATE referentiels SET code_insee = '51154' WHERE type = 'commune' AND valeur = 'Cramant'`).run()
  db.pragma('user_version = 6')
}

if (schemaVersion < 7) {
  try { db.exec(`ALTER TABLE vendanges ADD COLUMN statut TEXT NOT NULL DEFAULT 'en_cours'`) } catch {}
  try { db.exec(`ALTER TABLE vendanges ADD COLUMN date_cloture TEXT`) } catch {}
  db.pragma('user_version = 7')
}

if (schemaVersion < 8) {
  // Snapshot totals sur campagnes (figés à la clôture)
  try { db.exec(`ALTER TABLE campagnes ADD COLUMN poids_total_cloture REAL`) } catch {}
  try { db.exec(`ALTER TABLE campagnes ADD COLUMN kg_attendu_cloture REAL`) } catch {}

  // Recréer vendanges avec FK SET NULL + colonne parcelle_nom (persistance historique)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendanges_new (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parcelle_id      TEXT REFERENCES parcelles(id) ON DELETE SET NULL,
      parcelle_nom     TEXT,
      annee            INTEGER NOT NULL,
      poids_total      REAL DEFAULT 0,
      nb_caisses_total INTEGER DEFAULT 0,
      statut           TEXT NOT NULL DEFAULT 'en_cours',
      date_cloture     TEXT,
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    INSERT INTO vendanges_new (id, user_id, parcelle_id, parcelle_nom, annee,
      poids_total, nb_caisses_total, statut, date_cloture, notes, created_at, updated_at)
    SELECT v.id, v.user_id, v.parcelle_id, p.nom,
      v.annee, v.poids_total, v.nb_caisses_total,
      COALESCE(v.statut, 'en_cours'), v.date_cloture,
      v.notes, v.created_at, v.updated_at
    FROM vendanges v
    LEFT JOIN parcelles p ON p.id = v.parcelle_id;

    DROP TABLE vendanges;
    ALTER TABLE vendanges_new RENAME TO vendanges;

    DROP TRIGGER IF EXISTS vendange_totaux_insert;
    DROP TRIGGER IF EXISTS vendange_totaux_update;
    DROP TRIGGER IF EXISTS vendange_totaux_delete;

    CREATE TRIGGER vendange_totaux_insert
    AFTER INSERT ON chargements BEGIN
      UPDATE vendanges SET
        poids_total      = (SELECT COALESCE(SUM(poids_kg),0)       FROM chargements WHERE vendange_id = NEW.vendange_id),
        nb_caisses_total = (SELECT COALESCE(SUM(nombre_caisses),0) FROM chargements WHERE vendange_id = NEW.vendange_id),
        updated_at       = datetime('now')
      WHERE id = NEW.vendange_id;
    END;

    CREATE TRIGGER vendange_totaux_update
    AFTER UPDATE ON chargements BEGIN
      UPDATE vendanges SET
        poids_total      = (SELECT COALESCE(SUM(poids_kg),0)       FROM chargements WHERE vendange_id = NEW.vendange_id),
        nb_caisses_total = (SELECT COALESCE(SUM(nombre_caisses),0) FROM chargements WHERE vendange_id = NEW.vendange_id),
        updated_at       = datetime('now')
      WHERE id = NEW.vendange_id;
    END;

    CREATE TRIGGER vendange_totaux_delete
    AFTER DELETE ON chargements BEGIN
      UPDATE vendanges SET
        poids_total      = (SELECT COALESCE(SUM(poids_kg),0)       FROM chargements WHERE vendange_id = OLD.vendange_id),
        nb_caisses_total = (SELECT COALESCE(SUM(nombre_caisses),0) FROM chargements WHERE vendange_id = OLD.vendange_id),
        updated_at       = datetime('now')
      WHERE id = OLD.vendange_id;
    END;
  `)
  db.pragma('user_version = 8')
}

// ─── Backup automatique : 5 dernières sauvegardes rotatives ──────────────────

const MAX_BACKUPS = 5

export async function backupDb() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest  = path.join(BACKUP_DIR, `adx-${stamp}.db`)
    await db.backup(dest)
    // Rotation : ne garder que les MAX_BACKUPS plus récents
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of files.slice(MAX_BACKUPS)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, old.f)) } catch {}
    }
    return dest
  } catch (e) {
    console.error('Backup BDD échoué :', e.message)
    return null
  }
}

// Backup initial au démarrage + toutes les 30 minutes
backupDb()
setInterval(backupDb, 30 * 60 * 1000)

// Backwards-compat : ancien export utilisé par index.js
export function checkpointDb() { backupDb() }

export { ADMIN_EMAIL }
export default db
