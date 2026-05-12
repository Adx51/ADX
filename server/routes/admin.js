import { Router } from 'express'
import path from 'path'
import db, { ADMIN_EMAIL, backupDb } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

// ── Backup / Export BDD ──────────────────────────────────────────────────────

router.get('/backup', async (req, res) => {
  const dest = await backupDb()
  if (!dest) return res.status(500).json({ error: 'Backup échoué' })
  res.download(dest, `lf-boyer-${path.basename(dest)}`)
})

router.get('/export', (req, res) => {
  const data = {
    exported_at: new Date().toISOString(),
    users:        db.prepare('SELECT id, email, prenom, nom, role, created_at FROM users').all(),
    parcelles:    db.prepare('SELECT * FROM parcelles').all(),
    taches:       db.prepare('SELECT * FROM taches').all(),
    vendanges:    db.prepare('SELECT * FROM vendanges').all(),
    chargements:  db.prepare('SELECT * FROM chargements').all(),
    referentiels: db.prepare('SELECT * FROM referentiels').all(),
  }
  res.setHeader('Content-Disposition', `attachment; filename="lf-boyer-export-${new Date().toISOString().slice(0,10)}.json"`)
  res.json(data)
})

// ── Users ────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  const users = db.prepare(
    'SELECT id, email, prenom, nom, role, created_at FROM users ORDER BY created_at'
  ).all()
  res.json(users)
})

router.put('/users/:id', (req, res) => {
  const { prenom, nom, email } = req.body
  if (!prenom?.trim() || !nom?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Prénom, nom et email sont requis' })
  }
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' })
  const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.trim(), req.params.id)
  if (conflict) return res.status(409).json({ error: 'Cet email est déjà utilisé' })
  db.prepare('UPDATE users SET prenom = ?, nom = ?, email = ? WHERE id = ?')
    .run(prenom.trim(), nom.trim(), email.trim(), req.params.id)
  res.json(db.prepare('SELECT id, email, prenom, nom, role, created_at FROM users WHERE id = ?').get(req.params.id))
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
  const { valeur, code_insee } = req.body
  if (!valeur?.trim()) return res.status(400).json({ error: 'La valeur est requise' })
  const { next } = db.prepare(
    'SELECT COALESCE(MAX(ordre), -1) + 1 AS next FROM referentiels WHERE type = ?'
  ).get(req.params.type)
  try {
    const info = db.prepare(
      'INSERT INTO referentiels (type, valeur, ordre, code_insee) VALUES (?, ?, ?, ?)'
    ).run(req.params.type, valeur.trim(), next, code_insee?.trim() || null)
    res.json(db.prepare('SELECT * FROM referentiels WHERE id = ?').get(info.lastInsertRowid))
  } catch {
    res.status(409).json({ error: 'Cette valeur existe déjà' })
  }
})

router.put('/referentiels/:id', (req, res) => {
  const { code_insee } = req.body
  const r = db.prepare('SELECT id FROM referentiels WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Référentiel introuvable' })
  db.prepare('UPDATE referentiels SET code_insee = ? WHERE id = ?').run(code_insee?.trim() || null, req.params.id)
  res.json(db.prepare('SELECT * FROM referentiels WHERE id = ?').get(req.params.id))
})

router.delete('/referentiels/:id', (req, res) => {
  const r = db.prepare('SELECT id FROM referentiels WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Référentiel introuvable' })
  db.prepare('DELETE FROM referentiels WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
