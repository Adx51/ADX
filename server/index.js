import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

import db, { backupDb } from './db.js'
import authRoutes         from './routes/auth.js'
import parcellesRoutes    from './routes/parcelles.js'
import tachesRoutes       from './routes/taches.js'
import campagnesRoutes    from './routes/campagnes.js'
import vendangesRoutes    from './routes/vendanges.js'
import chargementsRoutes  from './routes/chargements.js'
import traitementsRoutes  from './routes/traitements.js'
import photosRoutes       from './routes/photos.js'
import adminRoutes        from './routes/admin.js'
import referentielsRoutes from './routes/referentiels.js'
import dashboardRoutes    from './routes/dashboard.js'
import phytoRoutes        from './routes/phyto.js'
import settingsRouter     from './routes/settings.js'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const PORT       = process.env.PORT || 3001
const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(process.cwd(), 'data/photos')

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant dans .env')
  process.exit(1)
}

const app = express()

// CORS : autoriser uniquement les origines explicitement déclarées.
// En production l'app est servie en same-origin (Express sert dist/) et en dev
// via le proxy Vite — aucune origine croisée n'est nécessaire par défaut.
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }))
app.use(express.json({ limit: '1mb' }))

// Photos statiques — nosniff empêche l'exécution d'un fichier déguisé en image
fs.mkdirSync(PHOTOS_DIR, { recursive: true })
app.use('/photos', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
}, express.static(PHOTOS_DIR))

// API
app.use('/api/auth',          authRoutes)
app.use('/api/parcelles',     parcellesRoutes)
app.use('/api/taches',        tachesRoutes)
app.use('/api/campagnes',     campagnesRoutes)
app.use('/api/vendanges',     vendangesRoutes)
app.use('/api/chargements',   chargementsRoutes)
app.use('/api/traitements',   traitementsRoutes)
app.use('/api/photos',        photosRoutes)
app.use('/api/admin',         adminRoutes)
app.use('/api/referentiels',  referentielsRoutes)
app.use('/api/dashboard',     dashboardRoutes)
app.use('/api/phyto',         phytoRoutes)
app.use('/api/settings',      settingsRouter)

// Toute route /api inconnue renvoie un 404 JSON (et non le index.html du SPA)
app.use('/api', (req, res) => res.status(404).json({ error: 'Route API introuvable' }))

// En production : servir l'app React buildée
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

// Gestionnaire d'erreurs global — renvoie du JSON, ne fuite jamais de stack trace
app.use((err, req, res, next) => {
  console.error('Erreur non gérée :', err.message)
  if (res.headersSent) return next(err)
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' })
})

// Backup + fermeture propre à l'arrêt du container
async function shutdown() {
  console.log('→ Arrêt en cours, backup final...')
  await backupDb()
  db.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ LF-Boyer Server démarré sur http://0.0.0.0:${PORT}`)
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`)
})
