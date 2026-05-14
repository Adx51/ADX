import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

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
  // Section après "Les produits utilisés sont :"
  const sections = text.split(/les produits utilis[ée]s sont\s*:?/i)
  if (sections.length < 2) return []

  const section = sections[1]
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean)
  const produits = []
  let headerPassed = false

  for (const line of lines) {
    // Ligne de header du tableau
    if (/^nom\b/i.test(line) || /nom.*mati[eè]re.*cible/i.test(line)) {
      headerPassed = true
      continue
    }
    // Fin de la section produits
    if (/^(bien\s+cordialement|sarl|earl|email|www\.|bonjour|nous\s+vous)/i.test(line)) break
    if (!headerPassed) continue

    // Splitter : tabs ou 2+ espaces
    const cols = line.split(/\t+|\s{3,}/).map(s => s.trim()).filter(Boolean)
    if (cols.length < 3) continue

    // Extraire DAR en jours (ex: "42j" → 42)
    const darStr = cols[6] || ''
    const darMatch = darStr.match(/(\d+)\s*j/i)
    const dar = darMatch ? parseInt(darMatch[1]) : null

    produits.push({
      nom:              cols[0] || '',
      matiere_active:   cols[1] || '',
      cible:            cols[2] || '',
      dose:             cols[3] || '',
      dose_homologuee:  cols[4] || '',
      znt:              cols[5] || '',
      dar,
      dre:              cols[7] || ''
    })
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

// DELETE /api/phyto/rapports/:id
router.delete('/rapports/:id', (req, res) => {
  const r = db.prepare('SELECT id FROM rapports_phyto WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Rapport introuvable' })
  db.prepare('DELETE FROM rapports_phyto WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
