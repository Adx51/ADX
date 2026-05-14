import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// ─── Parser d'email (fonctions utilitaires) ───────────────────────────────────

const MONTHS_FR = {
  'janvier':'01','février':'02','fevrier':'02','mars':'03','avril':'04',
  'mai':'05','juin':'06','juillet':'07','août':'08','aout':'08',
  'septembre':'09','octobre':'10','novembre':'11','décembre':'12','decembre':'12'
}

function parseDate(text) {
  // "effectué le 08/05/2026" ou "08/05/2026" ou "8 mai 2026"
  let m = text.match(/effectu[eé]\s+le\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  m = text.match(/\b(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(\d{4})\b/i)
  if (m) return `${m[3]}-${MONTHS_FR[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`
  return null
}

function parseParcelles(text) {
  const results = []
  // "NOM PARCELLE (0,146 ha - 8 mai 2026, 07:32:53)"
  const re = /^(.+?)\s*\((\d+[,\.]\d+)\s*ha\s*[-–]\s*[^,]+,\s*(\d{1,2}:\d{2}(?::\d{2})?)\)/gm
  for (const m of text.matchAll(re)) {
    const nom = m[1].trim()
    // exclure les lignes de header ou metadata
    if (/^(nom|matière|cible|dose|znt|dar|dre|bonjour|nous)/i.test(nom)) continue
    results.push({
      nom_source: nom,
      surface_ha: parseFloat(m[2].replace(',','.')),
      heure: m[3]
    })
  }
  return results
}

function parseProduits(text) {
  const sections = text.split(/les produits utilis[ée]s sont\s*:?/i)
  if (sections.length < 2) return []
  const section = sections[1]
  const allLines = section.split('\n').map(l => l.trim()).filter(Boolean)
  const stopPat = /^(bien\s+cordialement|sarl|earl|email|www\.|bonjour|nous\s+vous|logo|process2wine|soci[eé]t[eé]|contact@)/i
  const endIdx = allLines.findIndex(l => stopPat.test(l))
  const lines = endIdx > 0 ? allLines.slice(0, endIdx) : allLines

  // Detect HTML format: header fields on separate lines
  const htmlHeaders = ['nom','matière active','matiere active','cible','dose','dose homologuée','dose homologuee','znt','dar','dre']
  const htmlCount = htmlHeaders.filter(f => lines.some(l => l.toLowerCase() === f)).length
  if (htmlCount >= 4) return parseProduitsHTML(lines)
  return parseProduitsTab(lines)
}

function parseProduitsHTML(lines) {
  const skip = new Set(['nom','matière active','matiere active','cible','dose','dose homologuée','dose homologuee','znt','dar','dre'])
  const data = lines.filter(l => !skip.has(l.toLowerCase()))
  const doseRe = /^([\d,\.]+)\s*(L|Kg|kg|g|ml)\/ha$/i
  const doseIdxs = []
  for (let i = 0; i < data.length; i++) {
    if (doseRe.test(data[i])) doseIdxs.push(i)
  }
  const produits = []
  for (let d = 0; d < doseIdxs.length; d++) {
    const di = doseIdxs[d]
    const prevEnd = d > 0 ? doseIdxs[d-1] + afterDoseCount(data, doseIdxs[d-1]) + 1 : 0
    const block = data.slice(prevEnd, di)
    const nom = block[0] || ''
    const rest = block.slice(1)
    const cibleRe = /^(mildiou|o[iï]dium|botrytis|d[eé]sherbage|cicadelle|acariose|insecte|pourriture|court[-\s]nou[eé]|plasmopara|uncinula|coupe\s+bourgeon|adventice)/i
    let cible = '', matiere_active = ''
    if (rest.length > 0 && cibleRe.test(rest[rest.length - 1])) {
      cible = rest[rest.length - 1]
      matiere_active = rest.slice(0, -1).join(', ')
    } else {
      matiere_active = rest.join(', ')
    }
    const { dose_hom, znt, dar, dre } = extractAfterDose(data, di)
    if (nom) produits.push({ nom, matiere_active: matiere_active || null, cible: cible || null, dose: data[di], dose_homologuee: dose_hom || null, znt: znt || null, dar, dre: dre || null })
  }
  return produits
}

function afterDoseCount(data, doseIdx) {
  let count = 0, j = doseIdx + 1
  while (j < data.length && j - doseIdx <= 6) {
    const v = data[j]
    if (/^\d+j$/i.test(v) || /^\d+h$/i.test(v) || /^\d+m$/i.test(v) || /^[\d,\.]+$/.test(v) || v === '—' || v === '-') { count++; j++ }
    else break
  }
  return count
}

function extractAfterDose(data, doseIdx) {
  let dose_hom = null, znt = null, dar = null, dre = null
  let j = doseIdx + 1
  while (j < data.length && j - doseIdx <= 6) {
    const v = data[j]
    if (/^\d+j$/i.test(v) && dar === null) { dar = parseInt(v); j++ }
    else if (/^\d+h$/i.test(v) && !dre) { dre = v; j++ }
    else if (/^\d+m$/i.test(v) && !znt) { znt = v; j++ }
    else if (/^[\d,\.]+$/.test(v) && !dose_hom) { dose_hom = v; j++ }
    else if (v === '—' || v === '-') { j++ }
    else break
  }
  return { dose_hom, znt, dar, dre }
}

function parseProduitsTab(lines) {
  let headerPassed = false
  const produits = []
  for (const line of lines) {
    if (/^nom\b/i.test(line) || /nom.*mati[eè]re.*cible/i.test(line)) { headerPassed = true; continue }
    if (/^(bien\s+cordialement|sarl|earl|email|www\.)/i.test(line)) break
    if (!headerPassed) continue
    const cols = line.split(/\t+|\s{3,}/).map(s => s.trim()).filter(Boolean)
    if (cols.length < 3) continue
    const darStr = cols[6] || ''
    const darMatch = darStr.match(/(\d+)\s*j/i)
    const dar = darMatch ? parseInt(darMatch[1]) : null
    produits.push({ nom: cols[0] || '', matiere_active: cols[1] || null, cible: cols[2] || null, dose: cols[3] || null, dose_homologuee: cols[4] || null, znt: cols[5] || null, dar, dre: cols[7] || null })
  }
  return produits
}

function parsePrestataire(text) {
  // Chercher SARL, EARL, EURL dans les dernières lignes
  const tail = text.split('\n').slice(-20).join('\n')
  const m = tail.match(/^((?:SARL|EARL|EURL|SAS|SA)\s+[\w\s\-\.]+)/m)
  return m ? m[1].trim() : null
}

function fuzzyMatch(nomSource, parcelles) {
  const norm = s => s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()

  const src = norm(nomSource)
  // Enlever mots trop communs (nom de famille du domaine)
  const srcKey = src.replace(/\b(boyer|domaine|vignes?|parcelle)\b/g, '').replace(/\s+/g,' ').trim()

  let best = null, bestScore = 0

  for (const p of parcelles) {
    const pn = norm(p.nom)
    const pk = pn.replace(/\b(boyer|domaine|vignes?|parcelle)\b/g, '').replace(/\s+/g,' ').trim()

    if (pn === src || pk === srcKey) return { parcelle_id: p.id, nom: p.nom, confidence: 1.0 }

    const words1 = srcKey.split(' ').filter(Boolean)
    const words2 = pk.split(' ').filter(Boolean)
    if (!words1.length || !words2.length) continue
    const common = words1.filter(w => w.length > 2 && words2.some(w2 => w2.includes(w) || w.includes(w2))).length
    const score = common / Math.max(words1.length, words2.length)
    if (score > bestScore) { best = p; bestScore = score }
  }

  return best && bestScore > 0.3
    ? { parcelle_id: best.id, nom: best.nom, confidence: bestScore }
    : { parcelle_id: null, nom: null, confidence: 0 }
}

function parseRecapPDFText(text) {
  // Prestataire
  const presMatch = text.match(/^((?:SARL|EARL|EURL|SAS)\s+[\w\s\-\.]+)/m)
  const prestataire = presMatch ? presMatch[1].trim().replace(/\s+/g, ' ') : null
  // Année
  const yearMatch = text.match(/\b(20\d{2})\b/)
  const annee = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const parcelles = []
  let current = null
  let inIFT = false

  for (const line of lines) {
    // Skip page headers
    if (/Imprim[eé]\s+le/i.test(line) || /Process2wine/i.test(line) || /^Page\s+\d+\s+sur/i.test(line)) continue
    // Parcelle header: "NAME -- X.XX ha -- Cépage -- Entity"
    const hm = line.match(/^(.+?)\s*--\s*([\d,\.]+)\s*ha\s*--\s*(.+?)\s*--\s*.+$/)
    if (hm) {
      if (current) parcelles.push(current)
      current = { nomSource: hm[1].trim(), surfaceHa: parseFloat(hm[2].replace(',','.')), cepage: hm[3].trim(), ift: null, cuivreKgHa: null }
      inIFT = false
      continue
    }
    if (!current) continue
    // IFT section start (not "IFT Global")
    if (line === 'IFT') { inIFT = true; continue }
    // Skip column header row
    if (inIFT && /Herbicide.*Fongicide/i.test(line)) continue
    // IFT values: 7 space-separated comma-decimals
    if (inIFT && !current.ift) {
      const m = line.match(/^([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/)
      if (m) {
        const n = s => parseFloat(s.replace(',','.'))
        current.ift = { herbicide: n(m[1]), fongicide: n(m[2]), insecticide: n(m[3]), autres: n(m[4]), bio: n(m[5]), biocontrole: n(m[6]), total: n(m[7]) }
        inIFT = false
      }
    }
    // Cuivre kg/ha
    if (!current.cuivreKgHa) {
      const cm = line.match(/^([\d,]+)\s*kg\/ha$/i)
      if (cm) current.cuivreKgHa = parseFloat(cm[1].replace(',','.'))
    }
  }
  if (current) parcelles.push(current)
  return { prestataire, annee, parcelles: parcelles.filter(p => p.ift !== null) }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const router = Router()
router.use(requireAuth, requireAdmin)

// POST /api/phyto/parse — parse email text, no DB write
router.post('/parse', (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'Texte vide' })

  const parcelles = db.prepare('SELECT id, nom FROM parcelles ORDER BY nom').all()

  const date         = parseDate(text)
  const prestataire  = parsePrestataire(text)
  const parcellesRaw = parseParcelles(text)
  const produits     = parseProduits(text)

  const parcellesMatched = parcellesRaw.map(p => ({
    ...p,
    ...fuzzyMatch(p.nom_source, parcelles)
  }))

  res.json({ date, prestataire, parcelles: parcellesMatched, produits, allParcelles: parcelles })
})

// GET /api/phyto/rapports
router.get('/rapports', (req, res) => {
  const rapports = db.prepare(`SELECT * FROM rapports_phyto ORDER BY date DESC, created_at DESC`).all()
  const result = rapports.map(r => {
    const parcelles = db.prepare(`
      SELECT rpp.*, p.nom as parcelle_nom_app
      FROM rapports_phyto_parcelles rpp
      LEFT JOIN parcelles p ON p.id = rpp.parcelle_id
      WHERE rpp.rapport_id = ?
    `).all(r.id)
    const produits = db.prepare(`SELECT * FROM rapports_phyto_produits WHERE rapport_id = ?`).all(r.id)
    return { ...r, parcelles, produits }
  })
  res.json(result)
})

// POST /api/phyto/rapports — save a parsed rapport
router.post('/rapports', (req, res) => {
  const { date, prestataire, notes, parcelles, produits } = req.body
  if (!date) return res.status(400).json({ error: 'date requise' })

  const id = uuidv4()
  db.prepare(`INSERT INTO rapports_phyto (id, date, prestataire, notes, user_id) VALUES (?,?,?,?,?)`)
    .run(id, date, prestataire || null, notes || null, req.userId)

  for (const p of (parcelles || [])) {
    db.prepare(`INSERT INTO rapports_phyto_parcelles (id, rapport_id, parcelle_id, parcelle_nom_source, surface_ha, heure) VALUES (?,?,?,?,?,?)`)
      .run(uuidv4(), id, p.parcelle_id || null, p.nom_source || null, p.surface_ha || null, p.heure || null)
  }

  for (const p of (produits || [])) {
    db.prepare(`INSERT INTO rapports_phyto_produits (id, rapport_id, nom, matiere_active, cible, dose, dose_homologuee, znt, dar, dre) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(uuidv4(), id, p.nom, p.matiere_active || null, p.cible || null, p.dose || null, p.dose_homologuee || null, p.znt || null, p.dar || null, p.dre || null)
  }

  res.json({ id })
})

// GET /api/phyto/saison/:annee — récap annuel agrégé
router.get('/saison/:annee', (req, res) => {
  const annee = String(parseInt(req.params.annee))
  if (annee === 'NaN') return res.status(400).json({ error: 'Année invalide' })

  const rapports = db.prepare(`
    SELECT * FROM rapports_phyto
    WHERE strftime('%Y', date) = ?
    ORDER BY date ASC, created_at ASC
  `).all(annee)

  const rapportsDetail = rapports.map(r => {
    const parcelles = db.prepare(`
      SELECT rpp.*, p.nom as parcelle_nom_app
      FROM rapports_phyto_parcelles rpp
      LEFT JOIN parcelles p ON p.id = rpp.parcelle_id
      WHERE rpp.rapport_id = ?
    `).all(r.id)
    const produits = db.prepare(`SELECT * FROM rapports_phyto_produits WHERE rapport_id = ?`).all(r.id)
    return { ...r, parcelles, produits }
  })

  // Aggregate produits
  const produitsMap = {}
  for (const r of rapportsDetail) {
    for (const p of r.produits) {
      const key = p.nom.toLowerCase().trim()
      if (!produitsMap[key]) {
        produitsMap[key] = { nom: p.nom, cible: p.cible || null, dar: p.dar || null, znt: p.znt || null, occurrences: 0 }
      }
      produitsMap[key].occurrences++
    }
  }
  const produits_saison = Object.values(produitsMap).sort((a, b) => b.occurrences - a.occurrences)

  // Aggregate parcelles uniques
  const parcellesSet = new Set()
  for (const r of rapportsDetail) {
    for (const p of r.parcelles) {
      parcellesSet.add(p.parcelle_nom_app || p.parcelle_nom_source || '?')
    }
  }

  // Years with data
  const annees_disponibles = db.prepare(`
    SELECT DISTINCT strftime('%Y', date) as annee
    FROM rapports_phyto WHERE date IS NOT NULL ORDER BY annee DESC
  `).all().map(r => parseInt(r.annee))

  res.json({
    annee: parseInt(annee),
    rapports: rapportsDetail,
    produits_saison,
    parcelles_saison: [...parcellesSet].sort(),
    annees_disponibles,
  })
})

// DELETE /api/phyto/rapports/:id
router.delete('/rapports/:id', (req, res) => {
  const r = db.prepare('SELECT id FROM rapports_phyto WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Rapport introuvable' })
  db.prepare('DELETE FROM rapports_phyto WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/phyto/recaps/parse-pdf — upload PDF, extract IFT per parcelle
router.post('/recaps/parse-pdf', upload.single('pdf'), async (req, res) => {
  let pdfParse
  try {
    ;({ default: pdfParse } = await import('pdf-parse'))
  } catch {
    return res.status(503).json({ error: 'Module pdf-parse manquant — reconstruire le conteneur.' })
  }
  if (!req.file) return res.status(400).json({ error: 'Fichier PDF manquant' })
  try {
    const data = await pdfParse(req.file.buffer)
    const parsed = parseRecapPDFText(data.text)
    const allParcelles = db.prepare('SELECT id, nom FROM parcelles ORDER BY nom').all()
    // Fuzzy-match parcelles
    parsed.parcelles = parsed.parcelles.map(p => ({
      ...p,
      ...fuzzyMatch(p.nomSource, allParcelles)
    }))
    parsed.allParcelles = allParcelles
    // rawText inclus temporairement pour debug du parser
    parsed.rawText = data.text.slice(0, 8000)
    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: 'Erreur lecture PDF: ' + e.message })
  }
})

// GET /api/phyto/recaps/:annee — list saved recaps for a year
router.get('/recaps/:annee', (req, res) => {
  const annee = parseInt(req.params.annee)
  const recaps = db.prepare(`SELECT * FROM recaps_annuels WHERE annee = ? ORDER BY created_at DESC`).all(annee)
  const result = recaps.map(r => ({
    ...r,
    parcelles: db.prepare(`
      SELECT rap.*, p.nom as parcelle_nom_app
      FROM recaps_annuels_parcelles rap
      LEFT JOIN parcelles p ON p.id = rap.parcelle_id
      WHERE rap.recap_id = ?
      ORDER BY parcelle_nom_source
    `).all(r.id)
  }))
  const annees = db.prepare(`SELECT DISTINCT annee FROM recaps_annuels ORDER BY annee DESC`).all().map(r => r.annee)
  res.json({ recaps: result, annees_disponibles: annees })
})

// POST /api/phyto/recaps — save a confirmed recap
router.post('/recaps', (req, res) => {
  const { annee, prestataire, parcelles } = req.body
  if (!annee || !parcelles?.length) return res.status(400).json({ error: 'annee et parcelles requis' })
  const id = uuidv4()
  db.prepare(`INSERT INTO recaps_annuels (id, annee, prestataire, user_id) VALUES (?,?,?,?)`)
    .run(id, annee, prestataire || null, req.userId)
  for (const p of parcelles) {
    db.prepare(`INSERT INTO recaps_annuels_parcelles
      (id, recap_id, parcelle_id, parcelle_nom_source, surface_ha, cepage,
       ift_herbicide, ift_fongicide, ift_insecticide, ift_autres, ift_bio, ift_biocontrole, ift_total, cuivre_kg_ha)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uuidv4(), id, p.parcelle_id || null, p.nomSource || p.parcelle_nom_source, p.surfaceHa || null, p.cepage || null,
        p.ift?.herbicide ?? 0, p.ift?.fongicide ?? 0, p.ift?.insecticide ?? 0, p.ift?.autres ?? 0,
        p.ift?.bio ?? 0, p.ift?.biocontrole ?? 0, p.ift?.total ?? 0, p.cuivreKgHa ?? null)
  }
  res.json({ id })
})

// DELETE /api/phyto/recaps/:id
router.delete('/recaps/:id', (req, res) => {
  const r = db.prepare('SELECT id FROM recaps_annuels WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Récap introuvable' })
  db.prepare('DELETE FROM recaps_annuels WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// GET /api/phyto/recaps/:annee/export.csv — CSV export for CIVC
router.get('/recaps/:annee/export.csv', (req, res) => {
  const annee = parseInt(req.params.annee)
  const rows = db.prepare(`
    SELECT rap.parcelle_nom_source, p.nom as parcelle_nom_app, rap.surface_ha, rap.cepage,
           rap.ift_herbicide, rap.ift_fongicide, rap.ift_insecticide, rap.ift_autres,
           rap.ift_bio, rap.ift_biocontrole, rap.ift_total, rap.cuivre_kg_ha,
           ra.prestataire
    FROM recaps_annuels_parcelles rap
    JOIN recaps_annuels ra ON ra.id = rap.recap_id
    LEFT JOIN parcelles p ON p.id = rap.parcelle_id
    WHERE ra.annee = ?
    ORDER BY rap.parcelle_nom_source
  `).all(annee)

  const header = 'Parcelle;Surface (ha);Cépage;IFT Herbicide;IFT Fongicide;IFT Insecticide;IFT Autres;IFT Biocontrôle;IFT Total;Cuivre (kg/ha);Prestataire'
  const csv = [header, ...rows.map(r =>
    [r.parcelle_nom_app || r.parcelle_nom_source, r.surface_ha ?? '', r.cepage ?? '',
     r.ift_herbicide, r.ift_fongicide, r.ift_insecticide, r.ift_autres,
     r.ift_biocontrole, r.ift_total, r.cuivre_kg_ha ?? '', r.prestataire ?? '']
    .join(';')
  )].join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="IFT-${annee}.csv"`)
  res.send('﻿' + csv)  // BOM for Excel
})

export default router
