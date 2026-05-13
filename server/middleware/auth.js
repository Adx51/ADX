import jwt from 'jsonwebtoken'
import db from '../db.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' })
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

export function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }
  next()
}

// Middleware de permission de suppression par ressource
// Admins : toujours autorisés. Autres : selon can_delete JSON.
export function requireDeletePermission(resource) {
  return (req, res, next) => {
    const user = db.prepare('SELECT role, can_delete FROM users WHERE id = ?').get(req.userId)
    if (!user) return res.status(401).json({ error: 'Non authentifié' })
    if (user.role === 'admin') return next()
    try {
      const perms = user.can_delete ? JSON.parse(user.can_delete) : {}
      if (perms[resource] === true) return next()
    } catch {}
    return res.status(403).json({ error: 'Permission de suppression non accordée' })
  }
}
