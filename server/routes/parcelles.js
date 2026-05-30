import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireDeletePermission } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

function parseParcelle(p) {
  if (!p) return p
  return {
    ...p,
    cepages: p.cepages ? (() => { try { return JSON.parse(p.cepages) } catch { return [] } })() : []
  }
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM parcelles ORDER BY nom`).all()
  res.json(rows.map(parseParcelle))
})

router.post('/', (req, res) => {
  const { nom, surface_totale_ca, surface_plantee_ca, nombre_routes,
          commune, commune_pressoir, cepages, statut, annee_plantation,
          gps_lat, gps_lng, photo_url, notes, reference_cadastrale } = req.body
  if (!nom) return res.status(400).json({ error: 'Le nom est requis' })
  if (!surface_totale_ca) return res.status(400).json({ error: 'La surface totale est requise' })

  const id = uuidv4()
  const cepagesStr = Array.isArray(cepages) ? JSON.stringify(cepages) : '[]'

  db.prepare(`
    INSERT INTO parcelles
      (id, user_id, nom, surface_totale_ca, surface_plantee_ca,
       nombre_routes, commune, commune_pressoir, cepages, statut, annee_plantation,
       gps_lat, gps_lng, photo_url, notes, reference_cadastrale)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, req.userId, nom,
    surface_totale_ca ?? null, surface_plantee_ca ?? null,
    nombre_routes ?? null, commune ?? null, commune_pressoir ?? null, cepagesStr,
    statut ?? 'en_production', annee_plantation ?? null,
    gps_lat ?? null, gps_lng ?? null, photo_url ?? null, notes ?? null,
    reference_cadastrale ?? null)

  res.json(parseParcelle(db.prepare('SELECT * FROM parcelles WHERE id = ?').get(id)))
})

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM parcelles WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })

  const vendanges = db.prepare(`
    SELECT v.*, c.rendement_attendu_kgha
    FROM vendanges v
    LEFT JOIN campagnes c ON c.annee = v.annee
    WHERE v.parcelle_id = ?
    ORDER BY v.annee DESC
  `).all(req.params.id)

  res.json({ ...parseParcelle(p), vendanges })
})

// Comparaison rendement année par année : cette parcelle vs moyenne des parcelles
// rattachées au même pressoir de référence (commune_pressoir || commune)
router.get('/:id/comparaison-pressoir', (req, res) => {
  const p = db.prepare('SELECT * FROM parcelles WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })

  const pressoir = p.commune_pressoir || p.commune
  if (!pressoir) return res.json({ pressoir: null, annees: [] })

  // Toutes les parcelles rattachées au même pressoir (y compris celle-ci)
  const groupParcelles = db.prepare(`
    SELECT id, surface_plantee_ca, surface_totale_ca
    FROM parcelles
    WHERE COALESCE(NULLIF(commune_pressoir, ''), commune) = ?
  `).all(pressoir)

  const ids = groupParcelles.map(x => x.id)
  if (ids.length === 0) return res.json({ pressoir, annees: [] })

  // Vendanges du groupe
  const placeholders = ids.map(() => '?').join(',')
  const vendanges = db.prepare(`
    SELECT parcelle_id, annee, poids_total
    FROM vendanges
    WHERE parcelle_id IN (${placeholders})
  `).all(...ids)

  // surface en ha utilisée pour le calcul du rendement (plantée prioritaire, sinon totale)
  function surfaceHa(par) {
    const ca = par.surface_plantee_ca || par.surface_totale_ca || 0
    return ca / 10000
  }
  const parcelleMap = new Map(groupParcelles.map(x => [x.id, x]))

  // Agrège par année
  const byYear = new Map()
  for (const v of vendanges) {
    const par = parcelleMap.get(v.parcelle_id)
    const ha = surfaceHa(par)
    if (!ha || !v.poids_total) continue
    if (!byYear.has(v.annee)) byYear.set(v.annee, { poidsGroup: 0, haGroup: 0, parcelleSet: new Set(), kgha_parcelle: null })
    const y = byYear.get(v.annee)
    y.poidsGroup += v.poids_total
    y.haGroup    += ha
    y.parcelleSet.add(v.parcelle_id)
    if (v.parcelle_id === p.id) {
      y.kgha_parcelle = Math.round(v.poids_total / ha)
    }
  }

  const annees = [...byYear.entries()]
    .filter(([, y]) => y.kgha_parcelle !== null) // n'afficher que les années où cette parcelle a des données
    .map(([annee, y]) => ({
      annee,
      kgha_parcelle: y.kgha_parcelle,
      kgha_pressoir: y.haGroup > 0 ? Math.round(y.poidsGroup / y.haGroup) : null,
      n_parcelles:   y.parcelleSet.size
    }))
    .sort((a, b) => a.annee - b.annee)

  res.json({ pressoir, annees })
})

router.get('/:id/activite', (req, res) => {
  const p = db.prepare('SELECT id FROM parcelles WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })

  // Tâches liées à cette parcelle (lien direct ou via une tâche multi-parcelles/commune)
  const taches = db.prepare(`
    SELECT t.id, t.titre, t.statut, t.priorite, t.date_echeance, t.created_at, t.commune
    FROM taches t
    JOIN tache_parcelles tp ON tp.tache_id = t.id
    WHERE tp.parcelle_id = ?
    ORDER BY t.date_echeance ASC NULLS LAST, t.created_at DESC
  `).all(req.params.id)

  const traitements = db.prepare(`
    SELECT id, date, type, produit, dose
    FROM traitements
    WHERE parcelle_id = ?
    ORDER BY date DESC
    LIMIT 30
  `).all(req.params.id)

  res.json({ taches, traitements })
})

router.put('/:id', (req, res) => {
  const p = db.prepare('SELECT id FROM parcelles WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })

  const { nom, surface_totale_ca, surface_plantee_ca, nombre_routes,
          commune, commune_pressoir, cepages, statut, annee_plantation,
          gps_lat, gps_lng, photo_url, notes, reference_cadastrale } = req.body
  const cepagesStr = Array.isArray(cepages) ? JSON.stringify(cepages) : '[]'

  db.prepare(`
    UPDATE parcelles SET
      nom = ?, surface_totale_ca = ?, surface_plantee_ca = ?,
      nombre_routes = ?, commune = ?, commune_pressoir = ?, cepages = ?, statut = ?, annee_plantation = ?,
      gps_lat = ?, gps_lng = ?, photo_url = ?, notes = ?,
      reference_cadastrale = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nom, surface_totale_ca ?? null, surface_plantee_ca ?? null,
    nombre_routes ?? null, commune ?? null, commune_pressoir ?? null, cepagesStr,
    statut ?? 'en_production', annee_plantation ?? null,
    gps_lat ?? null, gps_lng ?? null, photo_url ?? null, notes ?? null,
    reference_cadastrale ?? null, req.params.id)

  res.json(parseParcelle(db.prepare('SELECT * FROM parcelles WHERE id = ?').get(req.params.id)))
})

router.delete('/:id', requireDeletePermission('parcelles'), (req, res) => {
  const p = db.prepare('SELECT id FROM parcelles WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })
  db.prepare('DELETE FROM parcelles WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
