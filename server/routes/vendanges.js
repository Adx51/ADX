import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireDeletePermission } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT v.*, COALESCE(p.nom, v.parcelle_nom) as parcelle_nom, p.surface_plantee_ca
    FROM vendanges v
    LEFT JOIN parcelles p ON p.id = v.parcelle_id
    ORDER BY v.annee DESC, COALESCE(p.nom, v.parcelle_nom) ASC NULLS LAST
  `).all()

  res.json(rows.map(r => ({
    ...r,
    parcelles: { nom: r.parcelle_nom, surface_plantee_ca: r.surface_plantee_ca },
    parcelle_nom: undefined,
    surface_plantee_ca: undefined
  })))
})

router.post('/', (req, res) => {
  const { parcelle_id, annee, notes } = req.body
  if (!parcelle_id || !annee) return res.status(400).json({ error: 'Parcelle et année requises' })

  const parcelleFull = db.prepare('SELECT id, nom FROM parcelles WHERE id = ?').get(parcelle_id)
  if (!parcelleFull) return res.status(404).json({ error: 'Parcelle introuvable' })

  // Idempotent : une vendange existe déjà pour cette parcelle/année → la renvoyer telle quelle.
  // Évite qu'un double-tap (deux POST quasi simultanés) crée des doublons ou casse la navigation.
  const existing = db.prepare('SELECT * FROM vendanges WHERE parcelle_id = ? AND annee = ?').get(parcelle_id, annee)
  if (existing) return res.json(existing)

  const id = uuidv4()
  try {
    db.prepare(`
      INSERT INTO vendanges (id, user_id, parcelle_id, parcelle_nom, annee, notes)
      VALUES (?,?,?,?,?,?)
    `).run(id, req.userId, parcelle_id, parcelleFull.nom || null, annee, notes || null)
  } catch (e) {
    // Course critique : l'index unique a rejeté l'insert car une autre requête a gagné.
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE/i.test(e.message)) {
      const row = db.prepare('SELECT * FROM vendanges WHERE parcelle_id = ? AND annee = ?').get(parcelle_id, annee)
      if (row) return res.json(row)
    }
    throw e
  }

  res.json(db.prepare('SELECT * FROM vendanges WHERE id = ?').get(id))
})

router.get('/:id', (req, res) => {
  const v = db.prepare(`
    SELECT v.*, COALESCE(p.nom, v.parcelle_nom) as parcelle_nom,
           p.surface_plantee_ca, p.surface_totale_ca, p.cepage, p.nombre_routes, p.gps_lat, p.gps_lng,
           c.rendement_attendu_kgha AS campagne_rendement_attendu,
           c.statut AS campagne_statut
    FROM vendanges v
    LEFT JOIN parcelles p ON p.id = v.parcelle_id
    LEFT JOIN campagnes c ON c.annee = v.annee
    WHERE v.id = ?
  `).get(req.params.id)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })

  const chargements = db.prepare(`
    SELECT * FROM chargements WHERE vendange_id = ?
    ORDER BY date_chargement ASC, heure_livraison ASC NULLS LAST
  `).all(req.params.id)

  const { parcelle_nom, surface_plantee_ca, surface_totale_ca, cepage, nombre_routes, gps_lat, gps_lng,
          campagne_rendement_attendu, campagne_statut, ...rest } = v
  res.json({
    ...rest,
    parcelles: { nom: parcelle_nom, surface_plantee_ca, surface_totale_ca, cepage, nombre_routes, gps_lat, gps_lng },
    campagne: { rendement_attendu_kgha: campagne_rendement_attendu, statut: campagne_statut },
    chargements
  })
})

router.put('/:id', (req, res) => {
  const v = db.prepare('SELECT id FROM vendanges WHERE id = ?').get(req.params.id)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })

  const { annee, notes } = req.body
  db.prepare(`
    UPDATE vendanges SET annee = ?, notes = ?, updated_at = datetime('now') WHERE id = ?
  `).run(annee, notes || null, req.params.id)

  res.json(db.prepare('SELECT * FROM vendanges WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireDeletePermission('vendanges'), (req, res) => {
  const v = db.prepare('SELECT id FROM vendanges WHERE id = ?').get(req.params.id)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })
  db.prepare('DELETE FROM vendanges WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/:id/cloturer', (req, res) => {
  const v = db.prepare('SELECT id FROM vendanges WHERE id = ?').get(req.params.id)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })
  db.prepare(`
    UPDATE vendanges SET statut = 'cloturee', date_cloture = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id)
  res.json(db.prepare('SELECT * FROM vendanges WHERE id = ?').get(req.params.id))
})

router.post('/:id/rouvrir', (req, res) => {
  const v = db.prepare('SELECT id FROM vendanges WHERE id = ?').get(req.params.id)
  if (!v) return res.status(404).json({ error: 'Vendange introuvable' })
  db.prepare(`
    UPDATE vendanges SET statut = 'en_cours', date_cloture = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id)
  res.json(db.prepare('SELECT * FROM vendanges WHERE id = ?').get(req.params.id))
})

export default router
