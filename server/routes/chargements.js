import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/:id', (req, res) => {
  const c = db.prepare(`SELECT * FROM chargements WHERE id = ?`).get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Chargement introuvable' })
  res.json(c)
})

router.post('/', (req, res) => {
  const { vendange_id, nombre_caisses, poids_kg, date_chargement, heure_livraison, notes } = req.body
  if (!vendange_id || !date_chargement) return res.status(400).json({ error: 'Champs requis manquants' })

  const v = db.prepare('SELECT id, statut FROM vendanges WHERE id = ?').get(vendange_id)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })
  if (v.statut === 'cloturee') return res.status(409).json({ error: 'Vendange clôturée — rouvrez-la pour ajouter un chargement' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO chargements
      (id, vendange_id, nombre_caisses, poids_kg, date_chargement, heure_livraison, notes)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, vendange_id, nombre_caisses || 0, poids_kg || 0,
         date_chargement, heure_livraison || null, notes || null)

  res.json(db.prepare('SELECT * FROM chargements WHERE id = ?').get(id))
})

router.put('/:id', (req, res) => {
  const c = db.prepare(`
    SELECT c.id, v.statut AS vendange_statut FROM chargements c
    JOIN vendanges v ON v.id = c.vendange_id
    WHERE c.id = ?
  `).get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Chargement introuvable' })
  if (c.vendange_statut === 'cloturee') return res.status(409).json({ error: 'Vendange clôturée — rouvrez-la pour modifier' })

  const { nombre_caisses, poids_kg, date_chargement, heure_livraison, notes } = req.body
  db.prepare(`
    UPDATE chargements SET
      nombre_caisses = ?, poids_kg = ?, date_chargement = ?,
      heure_livraison = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nombre_caisses, poids_kg, date_chargement, heure_livraison || null, notes || null, req.params.id)

  res.json(db.prepare('SELECT * FROM chargements WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  const c = db.prepare(`
    SELECT c.id, v.statut AS vendange_statut FROM chargements c
    JOIN vendanges v ON v.id = c.vendange_id
    WHERE c.id = ?
  `).get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Chargement introuvable' })
  if (c.vendange_statut === 'cloturee') return res.status(409).json({ error: 'Vendange clôturée — rouvrez-la pour supprimer' })
  db.prepare('DELETE FROM chargements WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
