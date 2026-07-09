import { Router } from 'express'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// Lecture des settings publics (pour la météo)
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]))
  res.json(settings)
})

// Mise à jour admin seulement
router.put('/', requireAuth, requireAdmin, (req, res) => {
  const allowed = ['weather_lat', 'weather_lng', 'weather_label']
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) stmt.run(key, String(value))
  }
  const rows = db.prepare('SELECT key, value FROM settings').all()
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])))
})

export default router
