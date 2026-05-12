import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

import authRoutes         from './routes/auth.js'
import parcellesRoutes    from './routes/parcelles.js'
import tachesRoutes       from './routes/taches.js'
import vendangesRoutes    from './routes/vendanges.js'
import chargementsRoutes  from './routes/chargements.js'
import photosRoutes       from './routes/photos.js'
import adminRoutes        from './routes/admin.js'
import referentielsRoutes from './routes/referentiels.js'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const PORT       = process.env.PORT || 3001
const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(process.cwd(), 'data/photos')

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant dans .env')
  process.exit(1)
}

const app = express()

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true
}))
app.use(express.json({ limit: '1mb' }))

// Photos statiques
fs.mkdirSync(PHOTOS_DIR, { recursive: true })
app.use('/photos', express.static(PHOTOS_DIR))

// API
app.use('/api/auth',          authRoutes)
app.use('/api/parcelles',     parcellesRoutes)
app.use('/api/taches',        tachesRoutes)
app.use('/api/vendanges',     vendangesRoutes)
app.use('/api/chargements',   chargementsRoutes)
app.use('/api/photos',        photosRoutes)
app.use('/api/admin',         adminRoutes)
app.use('/api/referentiels',  referentielsRoutes)

// En production : servir l'app React buildée
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

const SSL_CERT = process.env.SSL_CERT_PATH
const SSL_KEY  = process.env.SSL_KEY_PATH

if (SSL_CERT && SSL_KEY && fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
  const { createServer } = await import('https')
  const httpsOptions = {
    cert: fs.readFileSync(SSL_CERT),
    key:  fs.readFileSync(SSL_KEY),
  }
  createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`✅ ADX Server démarré sur https://0.0.0.0:${PORT}`)
    console.log(`   Mode: ${process.env.NODE_ENV || 'development'} | SSL: ${SSL_CERT}`)
  })
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ ADX Server démarré sur http://0.0.0.0:${PORT}`)
    console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`)
  })
}
