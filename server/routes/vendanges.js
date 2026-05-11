import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT v.*, p.nom as parcelle_nom, p.surface_plantee_ca
    FROM vendanges v
    JOIN parcelles p ON p.id = v.parcelle_id
    WHERE v.user_id = ?
    ORDER BY v.annee DESC, p.nom ASC
  `).all(req.userId)

  res.json(rows.map(r => ({
    ...r,
    parcelles: { nom: r.parcelle_nom, surface_plantee_ca: r.surface_plantee_ca },
    parcelle_nom: undefined,
    surface_plantee_ca: undefined
  })))
})

router.post('/', (req, res) => {
  const { parcelle_id, annee, notes } = req.body
  if (!parcelle_id || !annee) return res.status(400).json({ error: 'Parcelle et année requises' })

  const parcelle = db.prepare('SELECT id FROM parcelles WHERE id = ? AND user_id = ?').get(parcelle_id, req.userId)
  if (!parcelle) return res.status(404).json({ error: 'Parcelle introuvable' })

  const existing = db.prepare('SELECT id FROM vendanges WHERE parcelle_id = ? AND annee = ?').get(parcelle_id, annee)
  if (existing) return res.status(409).json({ error: 'Une vendange existe déjà pour cette parcelle et cette année' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO vendanges (id, user_id, parcelle_id, annee, notes)
    VALUES (?,?,?,?,?)
  `).run(id, req.userId, parcelle_id, annee, notes || null)

  res.json(db.prepare('SELECT * FROM vendanges WHERE id = ?').get(id))
})

router.get('/:id', (req, res) => {
  const v = db.prepare(`
    SELECT v.*, p.nom as parcelle_nom, p.surface_plantee_ca,
           p.surface_totale_ca, p.cepage, p.nombre_routes, p.gps_lat, p.gps_lng
    FROM vendanges v
    JOIN parcelles p ON p.id = v.parcelle_id
    WHERE v.id = ? AND v.user_id = ?
  `).get(req.params.id, req.userId)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })

  const chargements = db.prepare(`
    SELECT * FROM chargements WHERE vendange_id = ?
    ORDER BY date_chargement ASC, heure_livraison ASC NULLS LAST
  `).all(req.params.id)

  const { parcelle_nom, surface_plantee_ca, surface_totale_ca, cepage, nombre_routes, gps_lat, gps_lng, ...rest } = v
  res.json({
    ...rest,
    parcelles: { nom: parcelle_nom, surface_plantee_ca, surface_totale_ca, cepage, nombre_routes, gps_lat, gps_lng },
    chargements
  })
})

router.put('/:id', (req, res) => {
  const v = db.prepare('SELECT id FROM vendanges WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })

  const { annee, notes } = req.body
  db.prepare(`
    UPDATE vendanges SET annee = ?, notes = ?, updated_at = datetime('now') WHERE id = ?
  `).run(annee, notes || null, req.params.id)

  res.json(db.prepare('SELECT * FROM vendanges WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  const v = db.prepare('SELECT id FROM vendanges WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })
  db.prepare('DELETE FROM vendanges WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
