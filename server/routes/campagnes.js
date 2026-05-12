import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// Liste des campagnes avec stats agrégées par année
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COALESCE(SUM(v.poids_total), 0)
         FROM vendanges v WHERE v.user_id = c.user_id AND v.annee = c.annee) AS poids_total,
      (SELECT COALESCE(SUM(v.nb_caisses_total), 0)
         FROM vendanges v WHERE v.user_id = c.user_id AND v.annee = c.annee) AS caisses_total,
      (SELECT COUNT(*)
         FROM vendanges v WHERE v.user_id = c.user_id AND v.annee = c.annee) AS nb_vendanges
    FROM campagnes c
    WHERE c.user_id = ?
    ORDER BY c.annee DESC
  `).all(req.userId)
  res.json(rows)
})

router.post('/', (req, res) => {
  const { annee, date_debut, rendement_attendu_kgha } = req.body
  if (!annee) return res.status(400).json({ error: 'Année requise' })
  const existing = db.prepare('SELECT id FROM campagnes WHERE user_id = ? AND annee = ?').get(req.userId, annee)
  if (existing) return res.status(409).json({ error: 'Une campagne existe déjà pour cette année' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO campagnes (id, user_id, annee, date_debut, rendement_attendu_kgha)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.userId, annee, date_debut || null, rendement_attendu_kgha || null)

  res.json(db.prepare('SELECT * FROM campagnes WHERE id = ?').get(id))
})

// Détail d'une campagne : infos + toutes les parcelles de l'utilisateur avec leur vendange éventuelle
router.get('/:annee', (req, res) => {
  const annee = parseInt(req.params.annee)
  const campagne = db.prepare('SELECT * FROM campagnes WHERE user_id = ? AND annee = ?').get(req.userId, annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  const parcelles = db.prepare(`
    SELECT p.id, p.nom, p.surface_plantee_ca, p.surface_totale_ca, p.commune, p.cepages, p.statut,
           v.id AS vendange_id, v.poids_total, v.nb_caisses_total, v.notes AS vendange_notes
    FROM parcelles p
    LEFT JOIN vendanges v ON v.parcelle_id = p.id AND v.annee = ? AND v.user_id = p.user_id
    WHERE p.user_id = ?
    ORDER BY p.nom
  `).all(annee, req.userId).map(p => ({
    ...p,
    cepages: p.cepages ? (() => { try { return JSON.parse(p.cepages) } catch { return [] } })() : [],
  }))

  res.json({ ...campagne, parcelles })
})

router.put('/:annee', (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id, statut FROM campagnes WHERE user_id = ? AND annee = ?').get(req.userId, annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })

  const { date_debut, rendement_attendu_kgha, note_bilan } = req.body
  // Note bilan modifiable même après clôture, le reste seulement en cours
  if (c.statut === 'cloturee' && (date_debut !== undefined || rendement_attendu_kgha !== undefined)) {
    return res.status(409).json({ error: 'Campagne clôturée — réouvrez-la pour modifier ces champs' })
  }

  const fields = []
  const values = []
  if (date_debut !== undefined)             { fields.push('date_debut = ?');             values.push(date_debut || null) }
  if (rendement_attendu_kgha !== undefined) { fields.push('rendement_attendu_kgha = ?'); values.push(rendement_attendu_kgha || null) }
  if (note_bilan !== undefined)             { fields.push('note_bilan = ?');             values.push(note_bilan || null) }

  if (fields.length) {
    fields.push(`updated_at = datetime('now')`)
    values.push(c.id)
    db.prepare(`UPDATE campagnes SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  res.json(db.prepare('SELECT * FROM campagnes WHERE id = ?').get(c.id))
})

router.post('/:annee/cloturer', (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id FROM campagnes WHERE user_id = ? AND annee = ?').get(req.userId, annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })
  db.prepare(`
    UPDATE campagnes SET statut = 'cloturee', date_cloture = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(c.id)
  res.json(db.prepare('SELECT * FROM campagnes WHERE id = ?').get(c.id))
})

router.post('/:annee/rouvrir', (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id FROM campagnes WHERE user_id = ? AND annee = ?').get(req.userId, annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })
  db.prepare(`
    UPDATE campagnes SET statut = 'en_cours', date_cloture = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(c.id)
  res.json(db.prepare('SELECT * FROM campagnes WHERE id = ?').get(c.id))
})

// Export détaillé : parcelles groupées par pressoir avec tous les chargements
router.get('/:annee/export', (req, res) => {
  const annee = parseInt(req.params.annee)
  const campagne = db.prepare('SELECT * FROM campagnes WHERE user_id = ? AND annee = ?').get(req.userId, annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  const rows = db.prepare(`
    SELECT p.id AS parcelle_id, p.nom, p.surface_totale_ca, p.commune,
           COALESCE(p.commune_pressoir, p.commune) AS pressoir,
           v.id AS vendange_id, v.poids_total, v.nb_caisses_total,
           c.id AS chargement_id, c.date_chargement, c.heure_livraison,
           c.nombre_caisses, c.poids_kg, c.notes AS chargement_notes
    FROM parcelles p
    LEFT JOIN vendanges v ON v.parcelle_id = p.id AND v.annee = ? AND v.user_id = p.user_id
    LEFT JOIN chargements c ON c.vendange_id = v.id
    WHERE p.user_id = ?
    ORDER BY COALESCE(p.commune_pressoir, p.commune), p.nom, c.date_chargement, c.heure_livraison
  `).all(annee, req.userId)

  const grouped = {}
  for (const row of rows) {
    const pressoir = row.pressoir || 'Non affecté'
    if (!grouped[pressoir]) grouped[pressoir] = {}
    if (!grouped[pressoir][row.parcelle_id]) {
      grouped[pressoir][row.parcelle_id] = {
        nom: row.nom,
        surface_totale_ca: row.surface_totale_ca,
        commune: row.commune,
        vendange_id: row.vendange_id,
        poids_total: row.poids_total || 0,
        nb_caisses_total: row.nb_caisses_total || 0,
        chargements: []
      }
    }
    if (row.chargement_id) {
      grouped[pressoir][row.parcelle_id].chargements.push({
        id: row.chargement_id,
        date_chargement: row.date_chargement,
        heure_livraison: row.heure_livraison,
        nombre_caisses: row.nombre_caisses,
        poids_kg: row.poids_kg,
        notes: row.chargement_notes
      })
    }
  }

  const groupes = Object.entries(grouped).map(([pressoir, parcelles]) => ({
    pressoir,
    parcelles: Object.values(parcelles)
  }))

  res.json({ campagne, groupes })
})

router.delete('/:annee', (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id FROM campagnes WHERE user_id = ? AND annee = ?').get(req.userId, annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })
  db.prepare('DELETE FROM campagnes WHERE id = ?').run(c.id)
  res.json({ success: true })
})

export default router
