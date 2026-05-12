import { Router } from 'express'
import db, { ADMIN_EMAIL } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

// ── Users ────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  const users = db.prepare(
    'SELECT id, email, prenom, nom, role, created_at FROM users ORDER BY created_at'
  ).all()
  res.json(users)
})

router.put('/users/:id/role', (req, res) => {
  const { role } = req.body
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' })
  }
  const u = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' })
  if (u.email === ADMIN_EMAIL && role !== 'admin') {
    return res.status(400).json({ error: 'Cet administrateur ne peut pas être rétrogradé' })
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id)
  res.json({ success: true })
})

router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
  }
  const u = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' })
  if (u.email === ADMIN_EMAIL) {
    return res.status(400).json({ error: 'Cet administrateur ne peut pas être supprimé' })
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ── Referentials ─────────────────────────────────────────────────────────────

router.get('/referentiels/:type', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM referentiels WHERE type = ? ORDER BY ordre, valeur'
  ).all(req.params.type)
  res.json(rows)
})

router.post('/referentiels/:type', (req, res) => {
  const { valeur } = req.body
  if (!valeur?.trim()) return res.status(400).json({ error: 'La valeur est requise' })
  const { next } = db.prepare(
    'SELECT COALESCE(MAX(ordre), -1) + 1 AS next FROM referentiels WHERE type = ?'
  ).get(req.params.type)
  try {
    const info = db.prepare(
      'INSERT INTO referentiels (type, valeur, ordre) VALUES (?, ?, ?)'
    ).run(req.params.type, valeur.trim(), next)
    res.json(db.prepare('SELECT * FROM referentiels WHERE id = ?').get(info.lastInsertRowid))
  } catch {
    res.status(409).json({ error: 'Cette valeur existe déjà' })
  }
})

router.delete('/referentiels/:id', (req, res) => {
  const r = db.prepare('SELECT id FROM referentiels WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Référentiel introuvable' })
  db.prepare('DELETE FROM referentiels WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
