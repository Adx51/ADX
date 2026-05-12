import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

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
  const rows = db.prepare(`SELECT * FROM parcelles WHERE user_id = ? ORDER BY nom`).all(req.userId)
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
  const p = db.prepare('SELECT * FROM parcelles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })

  const vendanges = db.prepare(`
    SELECT v.*, c.rendement_attendu_kgha
    FROM vendanges v
    LEFT JOIN campagnes c ON c.user_id = v.user_id AND c.annee = v.annee
    WHERE v.parcelle_id = ?
    ORDER BY v.annee DESC
  `).all(req.params.id)

  res.json({ ...parseParcelle(p), vendanges })
})

router.put('/:id', (req, res) => {
  const p = db.prepare('SELECT id FROM parcelles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
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

router.delete('/:id', (req, res) => {
  const p = db.prepare('SELECT id FROM parcelles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })
  db.prepare('DELETE FROM parcelles WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
