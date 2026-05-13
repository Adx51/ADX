import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// Liste des campagnes avec stats agrégées par année
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COALESCE(SUM(v.poids_total), 0)
         FROM vendanges v WHERE v.annee = c.annee) AS poids_total,
      (SELECT COALESCE(SUM(v.nb_caisses_total), 0)
         FROM vendanges v WHERE v.annee = c.annee) AS caisses_total,
      (SELECT COUNT(*)
         FROM vendanges v WHERE v.annee = c.annee) AS nb_vendanges,
      (SELECT COALESCE(SUM(p.surface_totale_ca), 0)
         FROM vendanges v
         JOIN parcelles p ON p.id = v.parcelle_id
         WHERE v.annee = c.annee) AS surface_vendanges_ca,
      (SELECT COALESCE(SUM(p.surface_totale_ca), 0)
         FROM parcelles p) AS surface_all_ca
    FROM campagnes c
    ORDER BY c.annee DESC
  `).all()
  res.json(rows)
})

router.post('/', (req, res) => {
  const { annee, date_debut, rendement_attendu_kgha } = req.body
  if (!annee) return res.status(400).json({ error: 'Année requise' })
  const existing = db.prepare('SELECT id FROM campagnes WHERE annee = ?').get(annee)
  if (existing) return res.status(409).json({ error: 'Une campagne existe déjà pour cette année' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO campagnes (id, user_id, annee, date_debut, rendement_attendu_kgha)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.userId, annee, date_debut || null, rendement_attendu_kgha || null)

  res.json(db.prepare('SELECT * FROM campagnes WHERE id = ?').get(id))
})

// Statistiques globales (toutes campagnes)
router.get('/stats', (req, res) => {
  const campagnes = db.prepare(`
    SELECT c.annee, c.statut, c.rendement_attendu_kgha,
      CASE WHEN c.statut = 'cloturee' AND c.poids_total_cloture IS NOT NULL
           THEN c.poids_total_cloture
           ELSE COALESCE((
             SELECT SUM(v.poids_total) FROM vendanges v
             WHERE v.annee = c.annee), 0)
      END AS poids_total,
      COALESCE((
        SELECT SUM(v.nb_caisses_total) FROM vendanges v
        WHERE v.annee = c.annee), 0) AS caisses_total,
      COALESCE((
        SELECT COUNT(*) FROM vendanges v
        WHERE v.annee = c.annee), 0) AS nb_vendanges,
      COALESCE((
        SELECT SUM(p.surface_totale_ca)
        FROM vendanges v JOIN parcelles p ON p.id = v.parcelle_id
        WHERE v.annee = c.annee), 0) AS surface_vendanges_ca
    FROM campagnes c
    ORDER BY c.annee ASC
  `).all()

  const { surface_totale_ca } = db.prepare(
    `SELECT COALESCE(SUM(surface_totale_ca), 0) AS surface_totale_ca FROM parcelles`
  ).get()

  const { nb_parcelles } = db.prepare(
    `SELECT COUNT(*) AS nb_parcelles FROM parcelles`
  ).get()

  const result = campagnes.map(c => ({
    annee: c.annee,
    statut: c.statut,
    poids_total: c.poids_total,
    caisses_total: c.caisses_total,
    nb_vendanges: c.nb_vendanges,
    surface_vendanges_ca: c.surface_vendanges_ca,
    rendement_kgha: c.surface_vendanges_ca > 0
      ? Math.round(c.poids_total / (c.surface_vendanges_ca / 10000))
      : null,
    rendement_attendu_kgha: c.rendement_attendu_kgha,
  }))

  const harvestRows = db.prepare(`
    SELECT v.annee, ch.date_chargement, COALESCE(SUM(ch.poids_kg), 0) AS kg_jour
    FROM chargements ch
    JOIN vendanges v ON v.id = ch.vendange_id
    GROUP BY v.annee, ch.date_chargement
    ORDER BY v.annee, ch.date_chargement
  `).all()

  const curvesByYear = {}
  for (const r of harvestRows) {
    if (!curvesByYear[r.annee]) curvesByYear[r.annee] = []
    curvesByYear[r.annee].push({ date: r.date_chargement, kg: r.kg_jour })
  }
  const harvestCurves = Object.entries(curvesByYear).map(([annee, days]) => {
    let cumul = 0
    const points = days.map((d, i) => { cumul += d.kg; return { day: i + 1, date: d.date, kg_cumul: Math.round(cumul) } })
    return { annee: parseInt(annee), points }
  })

  const vendangesDetail = db.prepare(`
    SELECT
      v.annee,
      v.poids_total,
      p.surface_totale_ca,
      COALESCE(p.commune_pressoir, p.commune, 'Non défini') AS commune_pressoir,
      COALESCE(p.cepages, '[]') AS cepages
    FROM vendanges v
    JOIN parcelles p ON p.id = v.parcelle_id
    WHERE v.poids_total > 0
    ORDER BY v.annee ASC
  `).all().map(row => ({
    ...row,
    cepages: (() => { try { return JSON.parse(row.cepages) } catch { return [] } })(),
  }))

  res.json({ surface_totale_ca, nb_parcelles, campagnes: result, vendangesDetail, harvestCurves })
})

// Détail d'une campagne
router.get('/:annee', (req, res) => {
  const annee = parseInt(req.params.annee)
  const campagne = db.prepare('SELECT * FROM campagnes WHERE annee = ?').get(annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  let parcelles

  if (campagne.statut === 'cloturee') {
    parcelles = db.prepare(`
      SELECT
        COALESCE(p.id, v.parcelle_id)       AS id,
        COALESCE(p.nom, v.parcelle_nom)     AS nom,
        COALESCE(p.surface_totale_ca, 0)    AS surface_totale_ca,
        COALESCE(p.surface_plantee_ca, 0)   AS surface_plantee_ca,
        COALESCE(p.commune, '')             AS commune,
        COALESCE(p.cepages, '[]')           AS cepages,
        p.statut,
        v.id   AS vendange_id,
        v.poids_total,
        v.nb_caisses_total,
        v.notes AS vendange_notes,
        v.statut AS vendange_statut
      FROM vendanges v
      LEFT JOIN parcelles p ON p.id = v.parcelle_id
      WHERE v.annee = ?
      ORDER BY nom
    `).all(annee)
  } else {
    parcelles = db.prepare(`
      SELECT p.id, p.nom, p.surface_plantee_ca, p.surface_totale_ca, p.commune, p.cepages, p.statut,
             v.id AS vendange_id, v.poids_total, v.nb_caisses_total, v.notes AS vendange_notes,
             v.statut AS vendange_statut
      FROM parcelles p
      LEFT JOIN vendanges v ON v.parcelle_id = p.id AND v.annee = ?
      ORDER BY p.nom
    `).all(annee)
  }

  parcelles = parcelles.map(p => ({
    ...p,
    cepages: p.cepages ? (() => { try { return JSON.parse(p.cepages) } catch { return [] } })() : [],
  }))

  res.json({ ...campagne, parcelles })
})

router.put('/:annee', (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id, statut FROM campagnes WHERE annee = ?').get(annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })

  const { date_debut, rendement_attendu_kgha, note_bilan } = req.body
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
  const c = db.prepare('SELECT * FROM campagnes WHERE annee = ?').get(annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })

  const totals = db.prepare(`
    SELECT COALESCE(SUM(v.poids_total), 0) AS poids_total
    FROM vendanges v WHERE v.annee = ?
  `).get(annee)

  const surfaceAll = db.prepare(`
    SELECT COALESCE(SUM(p.surface_totale_ca), 0) AS surface_ca FROM parcelles p
  `).get()

  const kgAttendu = c.rendement_attendu_kgha && surfaceAll.surface_ca
    ? Math.round(c.rendement_attendu_kgha * surfaceAll.surface_ca / 10000)
    : null

  db.prepare(`
    UPDATE campagnes SET
      statut = 'cloturee',
      date_cloture = datetime('now'),
      poids_total_cloture = ?,
      kg_attendu_cloture = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(totals.poids_total, kgAttendu, c.id)

  res.json(db.prepare('SELECT * FROM campagnes WHERE id = ?').get(c.id))
})

router.post('/:annee/rouvrir', (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id FROM campagnes WHERE annee = ?').get(annee)
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
  const campagne = db.prepare('SELECT * FROM campagnes WHERE annee = ?').get(annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  const rows = db.prepare(`
    SELECT p.id AS parcelle_id, p.nom, p.surface_totale_ca, p.commune,
           COALESCE(p.commune_pressoir, p.commune) AS pressoir,
           v.id AS vendange_id, v.poids_total, v.nb_caisses_total,
           c.id AS chargement_id, c.date_chargement, c.heure_livraison,
           c.nombre_caisses, c.poids_kg, c.notes AS chargement_notes
    FROM parcelles p
    LEFT JOIN vendanges v ON v.parcelle_id = p.id AND v.annee = ?
    LEFT JOIN chargements c ON c.vendange_id = v.id
    ORDER BY COALESCE(p.commune_pressoir, p.commune), p.nom, c.date_chargement, c.heure_livraison
  `).all(annee)

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

// Export journalier : chargements groupés par date
router.get('/:annee/export-journalier', (req, res) => {
  const annee = parseInt(req.params.annee)
  const campagne = db.prepare('SELECT * FROM campagnes WHERE annee = ?').get(annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  const rows = db.prepare(`
    SELECT ch.id, ch.date_chargement, ch.heure_livraison,
           ch.nombre_caisses, ch.poids_kg, ch.notes,
           COALESCE(p.nom, v.parcelle_nom) AS parcelle_nom,
           COALESCE(p.commune_pressoir, p.commune, '') AS pressoir,
           COALESCE(p.commune, '') AS commune
    FROM chargements ch
    JOIN vendanges v ON v.id = ch.vendange_id
    LEFT JOIN parcelles p ON p.id = v.parcelle_id
    WHERE v.annee = ?
    ORDER BY ch.date_chargement ASC, ch.heure_livraison ASC NULLS LAST, parcelle_nom ASC
  `).all(annee)

  const byDate = {}
  for (const row of rows) {
    if (!byDate[row.date_chargement]) byDate[row.date_chargement] = []
    byDate[row.date_chargement].push(row)
  }

  const jours = Object.entries(byDate).map(([date, chargements]) => ({
    date,
    chargements,
    total_caisses: chargements.reduce((s, c) => s + (c.nombre_caisses || 0), 0),
    total_poids:   chargements.reduce((s, c) => s + (c.poids_kg || 0), 0),
  }))

  res.json({
    campagne,
    jours,
    total_caisses: jours.reduce((s, j) => s + j.total_caisses, 0),
    total_poids:   jours.reduce((s, j) => s + j.total_poids, 0),
  })
})

router.delete('/:annee', requireAdmin, (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id FROM campagnes WHERE annee = ?').get(annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })
  db.prepare('DELETE FROM campagnes WHERE id = ?').run(c.id)
  res.json({ success: true })
})

export default router
