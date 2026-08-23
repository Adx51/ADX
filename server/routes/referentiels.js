import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/:type', (req, res) => {
  const rows = db.prepare(
    'SELECT valeur, code_insee FROM referentiels WHERE type = ? ORDER BY ordre, valeur'
  ).all(req.params.type)
  res.json(rows)
})

export default router
