import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM parcelles WHERE user_id = ? ORDER BY nom
  `).all(req.userId)
  res.json(rows)
})

router.post('/', (req, res) => {
  const { nom, surface_totale_ca, surface_plantee_ca, nombre_routes,
          cepage, gps_lat, gps_lng, photo_url, notes } = req.body
  if (!nom) return res.status(400).json({ error: 'Le nom est requis' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO parcelles
      (id, user_id, nom, surface_totale_ca, surface_plantee_ca,
       nombre_routes, cepage, gps_lat, gps_lng, photo_url, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, req.userId, nom, surface_totale_ca ?? null, surface_plantee_ca ?? null,
         nombre_routes ?? null, cepage ?? null, gps_lat ?? null, gps_lng ?? null,
         photo_url ?? null, notes ?? null)

  res.json(db.prepare('SELECT * FROM parcelles WHERE id = ?').get(id))
})

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM parcelles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })

  const vendanges = db.prepare(`
    SELECT * FROM vendanges WHERE parcelle_id = ? ORDER BY annee DESC
  `).all(req.params.id)

  res.json({ ...p, vendanges })
})

router.put('/:id', (req, res) => {
  const p = db.prepare('SELECT id FROM parcelles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })

  const { nom, surface_totale_ca, surface_plantee_ca, nombre_routes,
          cepage, gps_lat, gps_lng, photo_url, notes } = req.body

  db.prepare(`
    UPDATE parcelles SET
      nom = ?, surface_totale_ca = ?, surface_plantee_ca = ?,
      nombre_routes = ?, cepage = ?, gps_lat = ?, gps_lng = ?,
      photo_url = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nom, surface_totale_ca ?? null, surface_plantee_ca ?? null,
         nombre_routes ?? null, cepage ?? null, gps_lat ?? null, gps_lng ?? null,
         photo_url ?? null, notes ?? null, req.params.id)

  res.json(db.prepare('SELECT * FROM parcelles WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  const p = db.prepare('SELECT id FROM parcelles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!p) return res.status(404).json({ error: 'Parcelle introuvable' })
  db.prepare('DELETE FROM parcelles WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
