import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireAdmin)

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, p.nom AS parcelle_nom_live
    FROM traitements t
    LEFT JOIN parcelles p ON p.id = t.parcelle_id
    ORDER BY t.date DESC, t.created_at DESC
  `).all()
  res.json(rows)
})

router.post('/', (req, res) => {
  const { parcelle_id, date, type, produit, dose, surface_ca, operateur, dar, conditions, notes } = req.body
  if (!date || !type || !produit) return res.status(400).json({ error: 'date, type et produit requis' })
  const parcelle = parcelle_id ? db.prepare('SELECT nom FROM parcelles WHERE id = ?').get(parcelle_id) : null
  const id = uuidv4()
  db.prepare(`
    INSERT INTO traitements (id, parcelle_id, parcelle_nom, date, type, produit, dose, surface_ca, operateur, dar, conditions, notes, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, parcelle_id || null, parcelle?.nom || null, date, type, produit, dose || null, surface_ca || null, operateur || null, dar || null, conditions || null, notes || null, req.userId)
  res.json(db.prepare('SELECT * FROM traitements WHERE id = ?').get(id))
})

router.put('/:id', (req, res) => {
  const t = db.prepare('SELECT id FROM traitements WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Traitement introuvable' })
  const { parcelle_id, date, type, produit, dose, surface_ca, operateur, dar, conditions, notes } = req.body
  const parcelle = parcelle_id ? db.prepare('SELECT nom FROM parcelles WHERE id = ?').get(parcelle_id) : null
  db.prepare(`
    UPDATE traitements SET
      parcelle_id=?, parcelle_nom=?, date=?, type=?, produit=?, dose=?,
      surface_ca=?, operateur=?, dar=?, conditions=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(parcelle_id || null, parcelle?.nom || null, date, type, produit, dose || null, surface_ca || null, operateur || null, dar || null, conditions || null, notes || null, req.params.id)
  res.json(db.prepare('SELECT * FROM traitements WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  const t = db.prepare('SELECT id FROM traitements WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Traitement introuvable' })
  db.prepare('DELETE FROM traitements WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
