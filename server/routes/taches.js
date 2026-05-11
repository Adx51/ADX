import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, p.nom as parcelle_nom
    FROM taches t
    LEFT JOIN parcelles p ON p.id = t.parcelle_id
    WHERE t.user_id = ?
    ORDER BY t.date_echeance ASC NULLS LAST, t.created_at DESC
  `).all(req.userId)

  res.json(rows.map(r => ({
    ...r,
    parcelles: r.parcelle_nom ? { nom: r.parcelle_nom } : null,
    parcelle_nom: undefined
  })))
})

router.post('/', (req, res) => {
  const { titre, description, parcelle_id, statut, priorite, date_echeance, photo_url } = req.body
  if (!titre) return res.status(400).json({ error: 'Le titre est requis' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO taches
      (id, user_id, parcelle_id, titre, description, statut, priorite, date_echeance, photo_url)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, req.userId, parcelle_id || null, titre, description || null,
         statut || 'a_faire', priorite || 'normale', date_echeance || null, photo_url || null)

  res.json(db.prepare('SELECT * FROM taches WHERE id = ?').get(id))
})

router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM taches WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' })
  res.json(t)
})

router.put('/:id', (req, res) => {
  const t = db.prepare('SELECT id FROM taches WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' })

  const { titre, description, parcelle_id, statut, priorite, date_echeance, photo_url } = req.body
  db.prepare(`
    UPDATE taches SET
      titre = ?, description = ?, parcelle_id = ?, statut = ?,
      priorite = ?, date_echeance = ?, photo_url = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(titre, description || null, parcelle_id || null, statut,
         priorite, date_echeance || null, photo_url || null, req.params.id)

  res.json(db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  const t = db.prepare('SELECT id FROM taches WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' })
  db.prepare('DELETE FROM taches WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
