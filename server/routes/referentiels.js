import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/:type', (req, res) => {
  const rows = db.prepare(
    'SELECT valeur FROM referentiels WHERE type = ? ORDER BY ordre, valeur'
  ).all(req.params.type)
  res.json(rows.map(r => r.valeur))
})

export default router
