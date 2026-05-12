import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/adx.db')

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

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

  -- Triggers: recalcule automatiquement les totaux vendange
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

export { ADMIN_EMAIL }
export default db
