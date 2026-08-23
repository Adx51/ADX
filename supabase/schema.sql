-- ============================================================
-- ADX Vignoble - Schéma Supabase
-- Exécuter dans l'éditeur SQL de votre projet Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE PARCELLES
-- Surface en ares + centiares (ex: 32 ares 21 ca = 0.3221 ha)
-- ============================================================
CREATE TABLE IF NOT EXISTS parcelles (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nom              TEXT NOT NULL,
  -- Surface totale en centiares (1 are = 100 ca, 1 ha = 10000 ca)
  surface_totale_ca   INTEGER,  -- ex: 3221 pour 32a 21ca
  surface_plantee_ca  INTEGER,  -- surface effectivement plantée
  nombre_routes    INTEGER,
  cepage           TEXT,
  gps_lat          DECIMAL(11,8),
  gps_lng          DECIMAL(11,8),
  photo_url        TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE parcelles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their parcelles"
  ON parcelles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE TACHES
-- ============================================================
CREATE TABLE IF NOT EXISTS taches (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parcelle_id   UUID REFERENCES parcelles(id) ON DELETE SET NULL,
  titre         TEXT NOT NULL,
  description   TEXT,
  statut        TEXT DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'termine')),
  priorite      TEXT DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute')),
  date_echeance DATE,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE taches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their taches"
  ON taches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE VENDANGES (une par parcelle par année)
-- ============================================================
CREATE TABLE IF NOT EXISTS vendanges (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parcelle_id   UUID REFERENCES parcelles(id) ON DELETE CASCADE NOT NULL,
  annee         INTEGER NOT NULL,
  poids_total   DECIMAL(10,2) DEFAULT 0,   -- mis à jour automatiquement
  nb_caisses_total INTEGER DEFAULT 0,       -- mis à jour automatiquement
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parcelle_id, annee)
);

ALTER TABLE vendanges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their vendanges"
  ON vendanges FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE CHARGEMENTS
-- Chaque livraison au pressoir : date, heure, nb caisses, poids
-- Exemple: 26/08/25 à 10h50 → 17 caisses → 710 kg
-- ============================================================
CREATE TABLE IF NOT EXISTS chargements (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendange_id      UUID REFERENCES vendanges(id) ON DELETE CASCADE NOT NULL,
  nombre_caisses   INTEGER NOT NULL DEFAULT 0,
  poids_kg         DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_chargement  DATE NOT NULL,
  heure_livraison  TIME,          -- heure d'arrivée au pressoir
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chargements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage chargements via vendanges"
  ON chargements FOR ALL
  USING (
    EXISTS (SELECT 1 FROM vendanges v WHERE v.id = vendange_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM vendanges v WHERE v.id = vendange_id AND v.user_id = auth.uid())
  );

-- ============================================================
-- TRIGGER: recalcule poids_total et nb_caisses_total
-- ============================================================
CREATE OR REPLACE FUNCTION update_vendange_totaux()
RETURNS TRIGGER AS $$
DECLARE
  vid UUID;
BEGIN
  vid := COALESCE(NEW.vendange_id, OLD.vendange_id);
  UPDATE vendanges
  SET
    poids_total      = (SELECT COALESCE(SUM(poids_kg), 0)       FROM chargements WHERE vendange_id = vid),
    nb_caisses_total = (SELECT COALESCE(SUM(nombre_caisses), 0) FROM chargements WHERE vendange_id = vid),
    updated_at       = NOW()
  WHERE id = vid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_update_vendange_totaux
  AFTER INSERT OR UPDATE OR DELETE ON chargements
  FOR EACH ROW EXECUTE FUNCTION update_vendange_totaux();

-- ============================================================
-- TRIGGER: updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_parcelles_upd   BEFORE UPDATE ON parcelles   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_taches_upd      BEFORE UPDATE ON taches       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_vendanges_upd   BEFORE UPDATE ON vendanges    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_chargements_upd BEFORE UPDATE ON chargements  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- STORAGE: bucket photos (public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users can upload photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

CREATE POLICY "Users delete own photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
