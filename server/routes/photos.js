import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(process.cwd(), 'data/photos')

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(PHOTOS_DIR, req.userId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${Date.now()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Fichier image uniquement'))
  }
})

router.post('/', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' })
  const url = `/photos/${req.userId}/${req.file.filename}`
  res.json({ url })
})

export default router
