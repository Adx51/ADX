import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireDeletePermission } from '../middleware/auth.js'
// pdfExport importé dynamiquement pour éviter un crash au démarrage si pdfkit absent

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

// ── Bilan de campagne ────────────────────────────────────────────────────
// Document de fin de vendange : les chiffres de l'année, la comparaison entre
// pressoirs, le classement des parcelles et leur écart à leur propre moyenne
// des années passées. Tout est calculé ici pour que l'écran n'ait qu'à
// afficher — et que le PDF et l'écran ne puissent pas diverger.
const ha = ca => (ca || 0) / 10000
const rendement = (kg, ca) => (ca > 0 ? Math.round(kg / ha(ca)) : null)
const arr1 = n => Math.round(n * 10) / 10

function cepageLibelle(cepagesJson) {
  let list = []
  try { list = JSON.parse(cepagesJson || '[]') } catch {}
  if (!Array.isArray(list) || list.length === 0) return 'Non renseigné'
  return list.length === 1 ? list[0] : list.join(' + ')
}

// Agrège des parcelles selon une clé (pressoir, commune, cépage) et calcule
// pour chaque groupe sa surface, sa récolte, son rendement et sa part du total.
function grouper(parcelles, cle, totalPoids) {
  const m = new Map()
  for (const p of parcelles) {
    const k = cle(p) || 'Non défini'
    const g = m.get(k) || { libelle: k, nb_parcelles: 0, surface_ca: 0, poids: 0, caisses: 0 }
    g.nb_parcelles += 1
    g.surface_ca   += p.surface_totale_ca || 0
    g.poids        += p.poids_total || 0
    g.caisses      += p.nb_caisses_total || 0
    m.set(k, g)
  }
  return [...m.values()]
    .map(g => ({
      ...g,
      poids: arr1(g.poids),
      rendement_kgha: rendement(g.poids, g.surface_ca),
      part_pct: totalPoids > 0 ? Math.round(g.poids / totalPoids * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.poids - a.poids)
}

router.get('/:annee/bilan', (req, res) => {
  const annee = parseInt(req.params.annee)
  const campagne = db.prepare('SELECT * FROM campagnes WHERE annee = ?').get(annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  // Parcelles vendangées cette année, avec leur récolte.
  const rows = db.prepare(`
    SELECT p.id, p.nom, p.commune, p.cepages, p.surface_totale_ca,
           COALESCE(NULLIF(p.commune_pressoir, ''), p.commune, 'Non défini') AS pressoir,
           v.id AS vendange_id,
           COALESCE(v.poids_total, 0)      AS poids_total,
           COALESCE(v.nb_caisses_total, 0) AS nb_caisses_total
    FROM parcelles p
    LEFT JOIN vendanges v ON v.parcelle_id = p.id AND v.annee = ?
    ORDER BY p.nom COLLATE NOCASE
  `).all(annee)

  const vendangees = rows.filter(r => r.vendange_id && r.poids_total > 0)

  // Moyenne historique de chaque parcelle, années précédentes uniquement.
  // La surface retenue est la surface actuelle : c'est une approximation, mais
  // la seule possible — on ne conserve pas l'historique des surfaces.
  const histo = db.prepare(`
    SELECT v.parcelle_id, v.annee, v.poids_total
    FROM vendanges v
    WHERE v.annee < ? AND COALESCE(v.poids_total, 0) > 0
  `).all(annee)

  const histoParParcelle = new Map()
  for (const h of histo) {
    if (!histoParParcelle.has(h.parcelle_id)) histoParParcelle.set(h.parcelle_id, [])
    histoParParcelle.get(h.parcelle_id).push(h)
  }

  const totalPoids   = vendangees.reduce((s, r) => s + r.poids_total, 0)
  const totalCaisses = vendangees.reduce((s, r) => s + r.nb_caisses_total, 0)
  const surfaceVendangeeCa = vendangees.reduce((s, r) => s + (r.surface_totale_ca || 0), 0)
  const surfaceTotaleCa    = rows.reduce((s, r) => s + (r.surface_totale_ca || 0), 0)
  const rendementMoyen = rendement(totalPoids, surfaceVendangeeCa)

  const parcelles = vendangees.map(r => {
    const rdt = rendement(r.poids_total, r.surface_totale_ca)
    const passe = (histoParParcelle.get(r.id) || [])
      .map(h => rendement(h.poids_total, r.surface_totale_ca))
      .filter(v => v != null)
    const moyenneHisto = passe.length
      ? Math.round(passe.reduce((s, v) => s + v, 0) / passe.length)
      : null

    return {
      id: r.id,
      nom: r.nom,
      commune: r.commune,
      pressoir: r.pressoir,
      cepage: cepageLibelle(r.cepages),
      surface_totale_ca: r.surface_totale_ca,
      poids: arr1(r.poids_total),
      caisses: r.nb_caisses_total,
      rendement_kgha: rdt,
      // Écart au rendement moyen du domaine cette année.
      ecart_domaine_pct: rendementMoyen && rdt != null
        ? Math.round((rdt - rendementMoyen) / rendementMoyen * 100) : null,
      // Écart à sa propre moyenne des années précédentes : c'est le chiffre
      // qui dit si la parcelle décroche, indépendamment du millésime.
      moyenne_historique_kgha: moyenneHisto,
      nb_annees_historique: passe.length,
      ecart_historique_pct: moyenneHisto && rdt != null
        ? Math.round((rdt - moyenneHisto) / moyenneHisto * 100) : null,
    }
  }).sort((a, b) => (b.rendement_kgha || 0) - (a.rendement_kgha || 0))

  // Rythme de la vendange, jour par jour
  const jours = db.prepare(`
    SELECT ch.date_chargement AS date,
           COALESCE(SUM(ch.poids_kg), 0)       AS kg,
           COALESCE(SUM(ch.nombre_caisses), 0) AS caisses,
           COUNT(*)                            AS nb_chargements
    FROM chargements ch
    JOIN vendanges v ON v.id = ch.vendange_id
    WHERE v.annee = ?
    GROUP BY ch.date_chargement
    ORDER BY ch.date_chargement ASC
  `).all(annee)

  let cumul = 0
  const rythme = jours.map(j => {
    cumul += j.kg
    return { ...j, kg: arr1(j.kg), cumul: arr1(cumul) }
  })
  const jourMax = rythme.reduce((best, j) => (!best || j.kg > best.kg ? j : best), null)

  const kgAttendu = campagne.kg_attendu_cloture != null
    ? campagne.kg_attendu_cloture
    : campagne.rendement_attendu_kgha
      ? Math.round(campagne.rendement_attendu_kgha * surfaceTotaleCa / 10000)
      : null

  res.json({
    campagne: {
      annee: campagne.annee,
      statut: campagne.statut,
      date_debut: campagne.date_debut,
      date_cloture: campagne.date_cloture,
      rendement_attendu_kgha: campagne.rendement_attendu_kgha,
      note_bilan: campagne.note_bilan,
    },
    totaux: {
      poids: arr1(totalPoids),
      caisses: totalCaisses,
      surface_vendangee_ca: surfaceVendangeeCa,
      surface_totale_ca: surfaceTotaleCa,
      rendement_kgha: rendementMoyen,
      kg_attendu: kgAttendu,
      pct_objectif: kgAttendu ? Math.round(totalPoids / kgAttendu * 100) : null,
      nb_parcelles_vendangees: vendangees.length,
      nb_parcelles: rows.length,
      poids_moyen_caisse: totalCaisses > 0 ? arr1(totalPoids / totalCaisses) : null,
      premier_jour: rythme[0]?.date || null,
      dernier_jour: rythme[rythme.length - 1]?.date || null,
      nb_jours: rythme.length,
      nb_chargements: rythme.reduce((s, j) => s + j.nb_chargements, 0),
    },
    pressoirs: grouper(vendangees, p => p.pressoir, totalPoids),
    communes:  grouper(vendangees, p => p.commune,  totalPoids),
    cepages:   grouper(vendangees, p => cepageLibelle(p.cepages), totalPoids),
    parcelles,
    rythme,
    jour_max: jourMax,
  })
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
        COALESCE(p.commune_pressoir, '')    AS commune_pressoir,
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
      SELECT p.id, p.nom, p.surface_plantee_ca, p.surface_totale_ca, p.commune,
             p.commune_pressoir, p.cepages, p.statut,
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

// PDF par parcelle
router.get('/:annee/pdf-export', async (req, res) => {
  let buildPdfExport
  try {
    ;({ buildPdfExport } = await import('../lib/pdfExport.js'))
  } catch {
    return res.status(503).json({ error: 'Module pdfkit absent — reconstruire le conteneur.' })
  }

  const annee = parseInt(req.params.annee)
  const campagne = db.prepare('SELECT * FROM campagnes WHERE annee = ?').get(annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  const rows = db.prepare(`
    SELECT p.id AS parcelle_id, p.nom, p.surface_totale_ca, p.commune,
           COALESCE(p.commune_pressoir, p.commune) AS pressoir,
           v.id AS vendange_id, v.poids_total, v.nb_caisses_total,
           c.id AS chargement_id, c.date_chargement, c.heure_livraison,
           c.nombre_caisses, c.poids_kg
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
        nom: row.nom, surface_totale_ca: row.surface_totale_ca,
        vendange_id: row.vendange_id, poids_total: row.poids_total || 0,
        nb_caisses_total: row.nb_caisses_total || 0, chargements: []
      }
    }
    if (row.chargement_id) {
      grouped[pressoir][row.parcelle_id].chargements.push({
        id: row.chargement_id, date_chargement: row.date_chargement,
        heure_livraison: row.heure_livraison,
        nombre_caisses: row.nombre_caisses, poids_kg: row.poids_kg
      })
    }
  }
  const groupes = Object.entries(grouped).map(([pressoir, parcelles]) => ({
    pressoir, parcelles: Object.values(parcelles)
  }))

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="vendanges-${annee}-parcelles.pdf"`)
  buildPdfExport(annee, groupes).pipe(res)
})

// PDF journalier
router.get('/:annee/pdf-journalier', async (req, res) => {
  let buildPdfJournalier
  try {
    ;({ buildPdfJournalier } = await import('../lib/pdfExport.js'))
  } catch {
    return res.status(503).json({ error: 'Module pdfkit absent — reconstruire le conteneur.' })
  }

  const annee = parseInt(req.params.annee)
  const campagne = db.prepare('SELECT * FROM campagnes WHERE annee = ?').get(annee)
  if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' })

  const rows = db.prepare(`
    SELECT ch.id, ch.date_chargement, ch.heure_livraison,
           ch.nombre_caisses, ch.poids_kg,
           COALESCE(p.nom, v.parcelle_nom) AS parcelle_nom,
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
  let jours = Object.entries(byDate).map(([date, chargements]) => ({
    date, chargements,
    total_caisses: chargements.reduce((s, c) => s + (c.nombre_caisses || 0), 0),
    total_poids:   chargements.reduce((s, c) => s + (c.poids_kg || 0), 0),
  }))

  // ?date=YYYY-MM-DD : le PDF ne contient que cette journée. C'est le document
  // envoyé au pressoir le soir même — il ne doit pas embarquer toute la campagne.
  const seul = req.query.date
  if (seul) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(seul)) return res.status(400).json({ error: 'Date invalide' })
    jours = jours.filter(j => j.date === seul)
    if (jours.length === 0) return res.status(404).json({ error: 'Aucun chargement ce jour-là' })
  }

  const total_caisses = jours.reduce((s, j) => s + j.total_caisses, 0)
  const total_poids   = jours.reduce((s, j) => s + j.total_poids, 0)

  const nomFichier = seul
    ? `vendanges-${seul}.pdf`
    : `vendanges-${annee}-journalier.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`)
  buildPdfJournalier(annee, jours, total_caisses, total_poids).pipe(res)
})

router.delete('/:annee', requireDeletePermission('campagnes'), (req, res) => {
  const annee = parseInt(req.params.annee)
  const c = db.prepare('SELECT id FROM campagnes WHERE annee = ?').get(annee)
  if (!c) return res.status(404).json({ error: 'Campagne introuvable' })
  db.prepare('DELETE FROM campagnes WHERE id = ?').run(c.id)
  res.json({ success: true })
})

export default router
