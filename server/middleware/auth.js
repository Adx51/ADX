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

// ─── Mode lecture seule ───────────────────────────────────────────────────────
// Un compte de rôle « lecteur » peut tout consulter mais ne peut rien écrire.
// Cette garde est montée GLOBALEMENT sur /api (avant toutes les routes de
// données) : toute méthode autre que GET/HEAD/OPTIONS est refusée, y compris
// sur les routes ajoutées plus tard — aucun endpoint ne peut être oublié.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function blockReadOnlyWrites(req, res, next) {
  if (READ_METHODS.has(req.method)) return next()

  const header = req.headers.authorization
  // Pas de token / token invalide : laisser requireAuth répondre 401 lui-même
  if (!header?.startsWith('Bearer ')) return next()
  let userId
  try {
    userId = jwt.verify(header.slice(7), process.env.JWT_SECRET).sub
  } catch {
    return next()
  }

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId)
  if (user?.role === 'lecteur') {
    return res.status(403).json({
      error: 'Compte en lecture seule — aucune modification autorisée',
      readOnly: true,
    })
  }
  next()
}

// Middleware de permission de suppression par ressource
// Admins : toujours autorisés. Autres : selon can_delete JSON.
export function requireDeletePermission(resource) {
  return (req, res, next) => {
    const user = db.prepare('SELECT role, can_delete FROM users WHERE id = ?').get(req.userId)
    if (!user) return res.status(401).json({ error: 'Non authentifié' })
    if (user.role === 'lecteur') {
      return res.status(403).json({ error: 'Compte en lecture seule', readOnly: true })
    }
    if (user.role === 'admin') return next()
    try {
      const perms = user.can_delete ? JSON.parse(user.can_delete) : {}
      if (perms[resource] === true) return next()
    } catch {}
    return res.status(403).json({ error: 'Permission de suppression non accordée' })
  }
}
