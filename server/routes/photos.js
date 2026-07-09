import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(process.cwd(), 'data/photos')

// Signatures binaires des formats raster autorisés.
// On rejette tout le reste (notamment le SVG, qui peut porter du JavaScript → XSS stocké).
const SIGNATURES = [
  { ext: '.jpg',  bytes: [0xFF, 0xD8, 0xFF] },
  { ext: '.png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { ext: '.gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: '.webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" + "WEBP" en position 8
]

function detectExt(buf) {
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => buf[i] === b)) {
      if (sig.ext === '.webp' && buf.slice(8, 12).toString('ascii') !== 'WEBP') continue
      return sig.ext
    }
  }
  return null
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(PHOTOS_DIR, req.userId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    // Nom aléatoire (anti-collision, anti-traversal) ; extension validée après écriture
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.tmp`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') cb(null, true)
    else cb(new Error('Format image non autorisé'))
  }
})

router.post('/', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' })
  const tmpPath = req.file.path
  let fd = null
  try {
    const buf = Buffer.alloc(12)
    fd = fs.openSync(tmpPath, 'r')
    fs.readSync(fd, buf, 0, 12, 0)
    fs.closeSync(fd); fd = null

    const ext = detectExt(buf)
    if (!ext) {
      fs.unlinkSync(tmpPath)
      return res.status(400).json({ error: 'Fichier image invalide' })
    }

    const finalName = path.basename(tmpPath, '.tmp') + ext
    fs.renameSync(tmpPath, path.join(path.dirname(tmpPath), finalName))
    res.json({ url: `/photos/${req.userId}/${finalName}` })
  } catch {
    try { if (fd !== null) fs.closeSync(fd) } catch {}
    try { fs.unlinkSync(tmpPath) } catch {}
    res.status(500).json({ error: "Échec du traitement de l'image" })
  }
})

export default router
