import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function makeToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' })
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' })

  const hash = await bcrypt.hash(password, 12)
  const id = uuidv4()
  db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)').run(id, email.toLowerCase(), hash)

  res.json({ token: makeToken(id), user: { id, email: email.toLowerCase() } })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
  if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' })

  res.json({ token: makeToken(user.id), user: { id: user.id, email: user.email } })
})

router.get('/me', (req, res) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' })
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(payload.sub)
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })
    res.json({ user })
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
})

export default router
