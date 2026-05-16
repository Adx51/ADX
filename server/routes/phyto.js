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

// ─── Carnet de traitement PDF parser (OT records) ────────────────────────────

function normalizePhytoType(catStr) {
  const s = catStr.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
  if (s.includes('fongic')) return 'fongicide'
  if (s.includes('insect')) return 'insecticide'
  if (s.includes('herbic')) return 'herbicide'
  if (s.includes('bioc') || s.includes('biocontr')) return 'biocontrole'
  return 'autre'
}

// Regex for merged OT product line: Dose/ha(N,NNN) Quantité(N,NN) Unité IFT(N,NN)
// Format Process2wine v2.04 : Produit | Type | Cible | Dose (ha) | Quantité | IFT
const OT_NUM_RE = /(\d+,\d{3})(\d+,\d{2})(Kg|L)(\d+,\d{2})/i
const OT_CAT_RE = /Fongicides?|Insecticides?|Herbicides?|Biocontr[oô]le|N[eé]maticides?|Acaricides?|Adjuvants?|Autres?/i

function parseOTProductLine(line) {
  const numMatch = line.match(OT_NUM_RE)
  if (!numMatch) return null

  const beforeNums = line.slice(0, line.indexOf(numMatch[0]))
  const catMatch = beforeNums.match(OT_CAT_RE)

  let nom, type = 'autre', cible = null
  if (catMatch) {
    nom = beforeNums.slice(0, catMatch.index).trim()
    type = normalizePhytoType(catMatch[0])
    cible = beforeNums.slice(catMatch.index + catMatch[0].length).trim() || null
  } else {
    nom = beforeNums.trim()
  }

  if (!nom) return null
  return {
    nom,
    type,
    cible: cible || null,
    dose_ha:  parseFloat(numMatch[1].replace(',', '.')),  // Dose appliquée / ha (1er nombre, 3 décimales)
    quantite: parseFloat(numMatch[2].replace(',', '.')),  // Quantité totale pour la parcelle (2e, 2 décimales)
    unite:    numMatch[3],
    ift:      parseFloat(numMatch[4].replace(',', '.')),  // IFT (4e nombre, 2 décimales)
  }
}

function parseCarnetPDFText(text) {
  // Détection prestataire : statut juridique + nom (sans déborder de ligne)
  // [^\n]+? non-greedy, capture jusqu'à fin de ligne ou caractère séparateur
  const presMatch = text.match(/(?:^|\n)((?:SARL|EARL|EURL|SAS|SCEV|GAEC|SCEA)\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\-\.&']{1,80}?)(?=\s*(?:--|\n|,|\(|$))/)
  const prestataire = presMatch ? presMatch[1].trim().replace(/\s+/g, ' ') : null
  const yearMatch = text.match(/\b(20\d{2})\b/)
  const annee = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // OT header: "04 juillet 2025 – OT 8904 – T8 Circuit 3 Conv."
  // Use [a-zÀ-ɏ]+ to match accented months (août, février, décembre…)
  const otHeaderRe = /^(\d{1,2})\s+([a-zÀ-ɏ]+)\s+(\d{4})\s*[-–—]+\s*OT\s+(\d+)\s*[-–—]+\s*(.+)/i

  const skipLine = l =>
    /^Produits$/i.test(l) ||
    /^NomQuantit/i.test(l) ||
    /Imprim[eé]/i.test(l) ||
    /process2wine/i.test(l) ||
    /^Page\s*\d/i.test(l) ||
    /^Totaux IFT/i.test(l)

  // Each parsed entry: one (OT date + parcelle) pair
  const traitements = []

  let currentDate = null
  let currentOTNum = null
  let currentDesc = null
  let currentParcelle = null
  let currentProduits = []
  let inOTSection = false

  function flush() {
    if (currentDate && currentProduits.length > 0) {
      traitements.push({
        date: currentDate,
        ot_num: currentOTNum,
        description: currentDesc,
        parcelle_nom_source: currentParcelle,
        produits: [...currentProduits],
      })
    }
    currentProduits = []
  }

  // Parcelle de page (entête "--") persiste à travers les OT jusqu'au prochain --
  let pageParcelle = null
  // Liste des parcelles détectées avec leurs infos (surface, cépage)
  const parcellesInfo = new Map()

  // Buffer pour reconstituer les produits dont le nom/cible est éclaté sur plusieurs lignes PDF
  let lineBuffer = []
  // Détecte la fin d'une ligne produit (les 4 nombres collés) — sert d'ancre de fin de row
  const ANCHOR_RE = /(\d+[,\.]\d{3})(\d+[,\.]\d{2})(Kg|L)(\d+[,\.]\d{2})\s*$/i

  function tryFlushProduct() {
    if (!lineBuffer.length) return
    const combined = lineBuffer.join(' ').replace(/\s+/g, ' ')
    if (ANCHOR_RE.test(combined)) {
      const prod = parseOTProductLine(combined)
      if (prod) currentProduits.push(prod)
      lineBuffer = []
    }
  }

  function resetBuffer() {
    lineBuffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (skipLine(line)) continue

    // Entête de page parcelle ("AVENTURES BOYER -- 0.1448 ha -- Chardonnay 1 -- ...")
    const headerMatch = line.match(/^(.+?)\s*--\s*([\d,\.]+)\s*ha\s*--\s*(.+?)\s*--/)
    if (headerMatch) {
      resetBuffer()
      flush()
      pageParcelle = headerMatch[1].trim()
      currentParcelle = pageParcelle
      const surface = parseFloat(headerMatch[2].replace(',', '.'))
      const cepage = headerMatch[3].trim()
      if (!parcellesInfo.has(pageParcelle)) {
        parcellesInfo.set(pageParcelle, { nomSource: pageParcelle, surfaceHa: surface, cepage })
      }
      inOTSection = false
      continue
    }

    // OT header → start new OT (mais conserve la parcelle de page)
    const otMatch = line.match(otHeaderRe)
    if (otMatch) {
      const [, day, month, year, otNum, desc] = otMatch
      const monthNum = MONTHS_FR[month.toLowerCase()]
      const newDate = monthNum ? `${year}-${monthNum}-${day.padStart(2, '0')}` : null
      // Suite de bloc OT après saut de page : même date+ot+parcelle → on continue
      if (newDate === currentDate && otNum === currentOTNum && pageParcelle === currentParcelle) {
        resetBuffer()
        inOTSection = true
        continue
      }
      resetBuffer()
      flush()
      currentDate = newDate
      currentOTNum = otNum
      currentDesc = desc.trim()
      currentParcelle = pageParcelle
      currentProduits = []
      inOTSection = true
      continue
    }

    if (!inOTSection) continue

    // "Totaux" line → flush block; skip the following IFT number
    if (/^Totaux$/i.test(line)) {
      if (i + 1 < lines.length && /^[\d,]+$/.test(lines[i + 1])) i++
      resetBuffer()
      flush()
      continue
    }

    // Accumule dans le buffer puis tente de flush (ancre numérique à la fin)
    lineBuffer.push(line)
    tryFlushProduct()
  }

  flush()

  return { prestataire, annee, traitements, parcelles: [...parcellesInfo.values()] }
}

// ── Format detection ──────────────────────────────────────────────────────────
function isMesParcelles(text) {
  return /Bilan de l.IFT MAEC/i.test(text) ||
         /mesparcelles/i.test(text) ||
         /D[eé]tail par interventions/i.test(text)
}

// ── Parser mesparcelles ("Bilan IFT MAEC - Détail par interventions") ─────────
function parseMesParcellePDFText(text) {
  const editeurMatch = text.match(/[EÉ]dit[eé] par\s*[«"]\s*(.+?)\s*[»"]/i)
  const prestataire = editeurMatch ? editeurMatch[1].trim() : null
  const yearMatch = text.match(/Ann[eé]e de r[eé]colte\s+(\d{4})/i)
  const annee = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const SURFACE_RE = /^Surface\s*:\s*([\d,\.]+)\s*ha(?:\s*[–\-]\s*Ilot\s*N°\s*:\s*(\d+))?/i
  const DATE_ROW_START = /^\d{2}\/\d{2}\/\d{2}\b/
  const SEGMENT_RE = /^(Herbicide\s*s?|Fongi(?:\.\s*\/?\s*Bact\.?)?|Insecticide\s*s?|Biocontr[oô]le\s*s?|Autres?|Molluscicide\s*s?)/i

  // IFT anchor: 4 values either concatenated "0.800.000.000.80" or space-separated "0.80 0.00 0.00 0.80"
  function hasAnchor(t) {
    return /(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})\s*$/.test(t) ||
           /(\d+[,\.]\d+)\s+(\d+[,\.]\d+)\s+(\d+[,\.]\d+)\s+(\d+[,\.]\d+)\s*$/.test(t)
  }
  function extractIft(t) {
    const m = t.match(/(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})\s*$/) ||
              t.match(/(\d+[,\.]\d+)\s+(\d+[,\.]\d+)\s+(\d+[,\.]\d+)\s+(\d+[,\.]\d+)\s*$/)
    if (!m) return null
    return { full: m[0], total: parseFloat(m[3].replace(',', '.')), bio: parseFloat(m[4].replace(',', '.')) }
  }

  // Combined dose pattern: optional surface% prefix (e.g. "87,99" max 100,XX) glued to dose (X.X+ with dot) + unit/ha
  // Surface% uses comma decimal (French), dose uses dot decimal — this distinguishes them when concatenated
  function findDoses(t) {
    const re = /((?:100|\d{1,2})[,\.]\d{1,2})?\s*(\d{1,4}\.\d+)\s*(Kg|L|KG|HL|kg|l|g|ml)\s*\/\s*ha\b/gi
    const out = []; let m
    while ((m = re.exec(t)) !== null) {
      out.push({ i: m.index, end: m.index + m[0].length, surf: m[1], dose: m[2], unit: m[3] })
    }
    return out
  }

  const parcellesMap = new Map()
  const traitements = []
  let currentParcelle = null
  let currentSurfaceHa = null
  let pendingParcelleName = null
  let lineBuffer = []

  function parseAndAddRow(combined) {
    if (/^Total\b/i.test(combined)) return
    const dateMatch = combined.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+/)
    if (!dateMatch) return
    const [full, dd, mm, yy] = dateMatch
    const dateStr = `20${yy}-${mm}-${dd}`
    let rest = combined.slice(full.length).trim()

    // Extract 4 trailing IFT values
    const ift = extractIft(rest)
    if (!ift) return
    rest = rest.slice(0, rest.lastIndexOf(ift.full)).trim()

    // Strip ref dose (rightmost match), then extract applied dose
    // The combined regex captures surface% glued with dose, so stripping the applied dose match
    // also removes the surface% prefix in one shot — no separate surface stripping needed.
    let doses = findDoses(rest)
    if (doses.length >= 1) {
      const ref = doses[doses.length - 1]
      rest = (rest.slice(0, ref.i) + rest.slice(ref.end)).trim()
    }
    doses = findDoses(rest)
    let dose_ha = null, unite = 'Kg'
    if (doses.length >= 1) {
      const appl = doses[doses.length - 1]
      dose_ha = parseFloat(appl.dose)
      unite = /^l/i.test(appl.unit) ? 'L' : 'Kg'
      rest = (rest.slice(0, appl.i) + rest.slice(appl.end)).trim()
    }

    // Extract segment → type
    const segMatch = rest.match(SEGMENT_RE)
    let type = 'autre', nom = rest
    if (segMatch) {
      const seg = segMatch[1].toLowerCase()
      if (/herbicide/.test(seg))    type = 'herbicide'
      else if (/fongi/.test(seg))   type = 'fongicide'
      else if (/insecticide/.test(seg)) type = 'insecticide'
      else if (/biocont/.test(seg)) type = 'biocontrole'
      nom = rest.slice(segMatch[0].length).trim()
    }

    let ift_value = ift.total
    if (ift.bio > 0 && ift.total === 0) { type = 'biocontrole'; ift_value = ift.bio }
    if (!nom) return

    const quantite = dose_ha != null && currentSurfaceHa
      ? Math.round(dose_ha * currentSurfaceHa * 1000) / 1000
      : null

    let trt = traitements.find(t => t.date === dateStr && t.parcelle_nom_source === currentParcelle)
    if (!trt) {
      trt = { date: dateStr, parcelle_nom_source: currentParcelle, description: null, produits: [] }
      traitements.push(trt)
    }
    trt.produits.push({ nom, type, dose_ha, quantite, unite, ift: ift_value })
  }

  function tryFlush() {
    const combined = lineBuffer.join(' ')
    if (!hasAnchor(combined)) return
    parseAndAddRow(combined)
    lineBuffer = []
  }

  for (const line of lines) {
    // Skip header/footer/column-header lines (including PDF-split fragments)
    if (/^(Exploitation|Ann[eé]e de r[eé]colte|Commune\s*:|N°\s*Siret|Ilot N°|Signature|Segment$|Produit$|Pourcent|Surf\.$|Trait[eé]e$|\(%\)$|Dose appliqu|Dose de r[eé]f|IFT herb|IFT hors|IFT [Tt]otal|Non comptab|comptabilis|[eÉ]dit[eé] par|Page \d|Bilan de l|D[eé]tail par)/i.test(line)) continue

    // Parcelle header — may span two lines separated by em dash (–)
    // Ilot N° is appended to the name for uniqueness (multiple parcelles can share the same name)
    if (/^Parcelle\s*:/i.test(line)) {
      if (lineBuffer.length) tryFlush()
      lineBuffer = []
      pendingParcelleName = null
      // Single-line: "Parcelle : NOM – Surface : X ha – Ilot N° : Y"
      const sameLine = line.match(/^Parcelle\s*:\s*(.+?)\s*[–\-]\s*Surface\s*:\s*([\d,\.]+)\s*ha(?:\s*[–\-]\s*Ilot\s*N°\s*:\s*(\d+))?/i)
      if (sameLine) {
        const baseName = sameLine[1].trim()
        const ilot = sameLine[3]
        currentParcelle = ilot ? `${baseName} — Ilot ${ilot}` : baseName
        currentSurfaceHa = parseFloat(sameLine[2].replace(',', '.'))
        if (!parcellesMap.has(currentParcelle))
          parcellesMap.set(currentParcelle, { nomSource: currentParcelle, surfaceHa: currentSurfaceHa })
      } else {
        // Name on this line, surface (and possibly Ilot) on next line
        pendingParcelleName = line.replace(/^Parcelle\s*:\s*/i, '').replace(/\s*[–\-]+\s*$/, '').trim()
      }
      continue
    }

    // Surface line following a split parcelle header
    if (pendingParcelleName) {
      const sm = line.match(SURFACE_RE)
      if (sm) {
        const ilot = sm[2]
        currentParcelle = ilot ? `${pendingParcelleName} — Ilot ${ilot}` : pendingParcelleName
        currentSurfaceHa = parseFloat(sm[1].replace(',', '.'))
        pendingParcelleName = null
        if (!parcellesMap.has(currentParcelle))
          parcellesMap.set(currentParcelle, { nomSource: currentParcelle, surfaceHa: currentSurfaceHa })
        continue
      }
      pendingParcelleName = null
    }

    if (!currentParcelle) continue

    if (DATE_ROW_START.test(line) && lineBuffer.length > 0) {
      tryFlush()
      lineBuffer = [] // Discard any header noise left in buffer
    }

    lineBuffer.push(line)
    tryFlush()
  }
  if (lineBuffer.length) tryFlush()

  return { prestataire, annee, traitements, parcelles: [...parcellesMap.values()] }
}

function parseRecapPDFText(text) {
  const presMatch = text.match(/^((?:SARL|EARL|EURL|SAS)\s+[\w\s\-\.]+)/m)
  const prestataire = presMatch ? presMatch[1].trim().replace(/\s+/g, ' ') : null
  const yearMatch = text.match(/\b(20\d{2})\b/)
  const annee = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const parcelles = []

  const skipLine = l =>
    /^Produits$/i.test(l) ||
    /^NomQuantit/i.test(l) ||
    /Imprim[eé]/i.test(l) ||
    /process2wine/i.test(l) ||
    /^Page\s*\d/i.test(l)

  // Quantité = "0,XX" ou "X,XX" ou "XX,XX" (1-2 chiffres, pas de zéro initial multiple)
  // .+ greedy → préfère le nom de produit le plus long
  // "Freeway 4800,14L" → nom="Freeway 480" qty=0,14
  // "HM Folp 800,14Kg" → nom="HM Folp 80" qty=0,14
  // "LBG-01F340,43L"   → nom="LBG-01F34" qty=0,43
  const produitRe = /^(.+)\s*((?:0|[1-9][0-9]?)[,\.][0-9]{2,3})\s*(Kg|L|g|ml|cl|hl)$/i

  // ── Passe 1 : entêtes parcelles (section "--") + produits annuels ──
  let currentParcelle = null
  for (const line of lines) {
    if (skipLine(line)) continue

    const hm = line.match(/^(.+?)\s*--\s*([\d,\.]+)\s*ha\s*--\s*(.+?)\s*--\s*.+$/)
    if (hm) {
      currentParcelle = {
        nomSource: hm[1].trim(),
        surfaceHa: parseFloat(hm[2].replace(',', '.')),
        cepage: hm[3].trim(),
        ift: null,
        cuivreKgHa: null,
        produits: [],
      }
      parcelles.push(currentParcelle)
      continue
    }

    if (currentParcelle) {
      if (line.includes('--')) { currentParcelle = null; continue }
      const pm = line.match(produitRe)
      if (pm) {
        currentParcelle.produits.push({
          nom: pm[1].trim(),
          quantite: parseFloat(pm[2].replace(',', '.')),
          unite: pm[3],
        })
      }
    }
  }

  // ── Passe 2 : extraire le bloc IFT directement (1 bloc par parcelle dans le PDF) ──
  // Format PDF : "IFT" puis entête "HerbicideFongicide..." puis ligne de 6-8 nombres
  // Colonnes : Herbicide | Fongicide | Insecticide | Autres | Bio | Biocontrôle | Total | Total(hors bioc)
  // Les nombres peuvent être collés (extraction PDF) : "1,049,280,000,008,807,3417,6610,32"
  function parseStuckNums(str) {
    const cleaned = str.replace(/[^\d,\.\s]/g, '').trim()
    if (!cleaned) return []
    // Format espacé : "1,04 9,28 0,00 ..."
    if (/\s/.test(cleaned)) {
      return cleaned.split(/\s+/)
        .filter(s => /^\d+[,\.]\d{2,3}$/.test(s))
        .map(s => parseFloat(s.replace(',', '.')))
    }
    // Format collé : on suppose 2 décimales par valeur
    // Chaque chunk entre virgules = [2 chiffres décimaux de N] + [chiffres entiers de N+1]
    const parts = cleaned.split(',')
    if (parts.length < 2) return []
    const nums = []
    let intPart = parts[0]
    for (let i = 0; i + 1 < parts.length; i++) {
      const next = parts[i + 1]
      if (next.length < 2) {
        // Dernière valeur : on prend les 2 derniers chiffres comme décimaux
        if (i === parts.length - 2) {
          nums.push(parseFloat(`${intPart}.${next.padStart(2, '0')}`))
        }
        break
      }
      const frac = next.substring(0, 2)
      nums.push(parseFloat(`${intPart}.${frac}`))
      intPart = next.substring(2)
    }
    return nums
  }

  let curIftParc = null
  let waitForIftHeader = false
  let waitForIftNumbers = false

  for (const line of lines) {
    if (skipLine(line)) continue

    const hm = line.match(/^(.+?)\s*--\s*([\d,\.]+)\s*ha\s*--/)
    if (hm) {
      curIftParc = parcelles.find(p => p.nomSource === hm[1].trim()) || null
      waitForIftHeader = false
      waitForIftNumbers = false
      continue
    }
    if (!curIftParc) continue

    if (/^IFT$/i.test(line)) { waitForIftHeader = true; continue }

    if (waitForIftHeader && /Herbicide/i.test(line) && /Fongicide/i.test(line)) {
      waitForIftHeader = false
      waitForIftNumbers = true
      continue
    }

    if (waitForIftNumbers) {
      const allNums = parseStuckNums(line)
      if (allNums.length >= 6) {
        curIftParc.ift = {
          herbicide:   allNums[0] || 0,
          fongicide:   allNums[1] || 0,
          insecticide: allNums[2] || 0,
          autres:      allNums[3] || 0,
          bio:         allNums[4] || 0,
          biocontrole: allNums[5] || 0,
          total:       allNums[6] != null ? allNums[6] : (allNums[0]+allNums[1]+allNums[2]+allNums[3]+allNums[4]+allNums[5]),
        }
        waitForIftNumbers = false
      }
    }

    // Détection cuivre "X,XX kg/ha"
    const cuMatch = line.match(/^([\d,\.]+)\s*kg\/ha$/i)
    if (cuMatch) {
      curIftParc.cuivreKgHa = parseFloat(cuMatch[1].replace(',', '.'))
    }
  }

  // Défaut si IFT non trouvé
  for (const p of parcelles) {
    if (!p.ift) {
      p.ift = { herbicide: 0, fongicide: 0, insecticide: 0, autres: 0, bio: 0, biocontrole: 0, total: 0 }
    }
    for (const k of Object.keys(p.ift)) p.ift[k] = Math.round(p.ift[k] * 100) / 100
  }

  return { prestataire, annee, parcelles }
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
    const produits = db.prepare(`
      SELECT id, rapport_id, nom, matiere_active, cible, dose, dose_homologuee, znt, dar, dre,
             type, quantite, unite, ift_value, dose_ha
      FROM rapports_phyto_produits WHERE rapport_id = ?
    `).all(r.id)
    return { ...r, parcelles, produits }
  })
  res.json(result)
})

// POST /api/phyto/rapports — save a parsed rapport
router.post('/rapports', (req, res) => {
  const { date, prestataire, notes, parcelles, produits } = req.body
  if (!date) return res.status(400).json({ error: 'date requise' })

  // Auto-ajout prestataire au référentiel
  if (prestataire && prestataire.trim()) {
    const trimmed = prestataire.trim()
    const exists = db.prepare(`SELECT id FROM referentiels WHERE type = 'prestataire' AND valeur = ?`).get(trimmed)
    if (!exists) {
      const next = db.prepare(`SELECT COALESCE(MAX(ordre), -1) + 1 AS n FROM referentiels WHERE type = 'prestataire'`).get().n
      db.prepare(`INSERT INTO referentiels (type, valeur, ordre) VALUES ('prestataire', ?, ?)`).run(trimmed, next)
    }
  }

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
    const carnet = isMesParcelles(data.text)
      ? parseMesParcellePDFText(data.text)
      : parseCarnetPDFText(data.text)
    const allParcelles = db.prepare('SELECT id, nom FROM parcelles ORDER BY nom').all()

    // Mappings sauvegardés pour ce prestataire
    const savedMappings = {}
    if (carnet.prestataire) {
      const rows = db.prepare(`SELECT nom_source, parcelle_id FROM phyto_parcelle_mapping WHERE prestataire = ?`).all(carnet.prestataire)
      for (const row of rows) savedMappings[row.nom_source] = row.parcelle_id
    }

    // Fuzzy-match parcelles (utilisé pour la confirmation utilisateur)
    const parcelles = carnet.parcelles.map(p => {
      if (savedMappings[p.nomSource]) {
        const ap = allParcelles.find(x => x.id === savedMappings[p.nomSource])
        return { ...p, parcelle_id: savedMappings[p.nomSource], nom: ap?.nom || null, confidence: 1.0 }
      }
      return { ...p, ...fuzzyMatch(p.nomSource, allParcelles) }
    })

    // Traitements : pré-lien parcelle
    const traitements = carnet.traitements.map(t => {
      if (!t.parcelle_nom_source) return { ...t, parcelle_id: null }
      if (savedMappings[t.parcelle_nom_source]) {
        return { ...t, parcelle_id: savedMappings[t.parcelle_nom_source] }
      }
      const match = fuzzyMatch(t.parcelle_nom_source, allParcelles)
      return { ...t, parcelle_id: match.parcelle_id }
    })

    res.json({
      prestataire: carnet.prestataire,
      annee: carnet.annee,
      parcelles,
      traitements,
      allParcelles,
      rawText: data.text.slice(0, 8000),
    })
  } catch (e) {
    res.status(500).json({ error: 'Erreur lecture PDF: ' + e.message })
  }
})

// POST /api/phyto/carnet/parse-pdf — parse OT records (individual treatments) from PDF
router.post('/carnet/parse-pdf', upload.single('pdf'), async (req, res) => {
  let pdfParse
  try {
    ;({ default: pdfParse } = await import('pdf-parse'))
  } catch {
    return res.status(503).json({ error: 'Module pdf-parse manquant — reconstruire le conteneur.' })
  }
  if (!req.file) return res.status(400).json({ error: 'Fichier PDF manquant' })
  try {
    const data = await pdfParse(req.file.buffer)
    const parsed = isMesParcelles(data.text)
      ? parseMesParcellePDFText(data.text)
      : parseCarnetPDFText(data.text)
    const allParcelles = db.prepare('SELECT id, nom FROM parcelles ORDER BY nom').all()

    // Load saved mappings for this prestataire
    const savedMappings = {}
    if (parsed.prestataire) {
      const rows = db.prepare(`SELECT nom_source, parcelle_id FROM phyto_parcelle_mapping WHERE prestataire = ?`).all(parsed.prestataire)
      for (const row of rows) savedMappings[row.nom_source] = row.parcelle_id
    }

    // Fuzzy-match parcelle per traitement
    parsed.traitements = parsed.traitements.map(t => {
      if (!t.parcelle_nom_source) return { ...t, parcelle_id: null, nom_app: null, confidence: 0 }
      if (savedMappings[t.parcelle_nom_source]) {
        const ap = allParcelles.find(x => x.id === savedMappings[t.parcelle_nom_source])
        return { ...t, parcelle_id: savedMappings[t.parcelle_nom_source], nom_app: ap?.nom || null, confidence: 1.0 }
      }
      const match = fuzzyMatch(t.parcelle_nom_source, allParcelles)
      return { ...t, parcelle_id: match.parcelle_id, nom_app: match.nom, confidence: match.confidence }
    })

    parsed.allParcelles = allParcelles
    if (parsed.traitements.length === 0) parsed.rawText = data.text.slice(0, 8000)
    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: 'Erreur lecture PDF: ' + e.message })
  }
})

// POST /api/phyto/carnet — save OT records as rapports_phyto (source=pdf_carnet)
router.post('/carnet', (req, res) => {
  const { prestataire, traitements } = req.body
  if (!traitements?.length) return res.status(400).json({ error: 'traitements requis' })

  const insMapping = db.prepare(`INSERT OR REPLACE INTO phyto_parcelle_mapping (prestataire, nom_source, parcelle_id, updated_at) VALUES (?,?,?,datetime('now'))`)
  const ids = []

  for (const t of traitements) {
    if (!t.date) continue
    const id = uuidv4()
    db.prepare(`INSERT INTO rapports_phyto (id, date, prestataire, notes, user_id, source) VALUES (?,?,?,?,?,?)`)
      .run(id, t.date, prestataire || null, t.ot_num ? `OT ${t.ot_num}` : null, req.userId, 'pdf_carnet')

    if (t.parcelle_nom_source) {
      db.prepare(`INSERT INTO rapports_phyto_parcelles (id, rapport_id, parcelle_id, parcelle_nom_source) VALUES (?,?,?,?)`)
        .run(uuidv4(), id, t.parcelle_id || null, t.parcelle_nom_source)
      if (t.parcelle_id) {
        insMapping.run(prestataire || '', t.parcelle_nom_source, t.parcelle_id)
      }
    }

    for (const p of (t.produits || [])) {
      db.prepare(`INSERT INTO rapports_phyto_produits (id, rapport_id, nom, cible, type, quantite, unite, ift_value, dose_ha) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(uuidv4(), id, p.nom, p.cible || null, p.type || null, p.quantite ?? null, p.unite || null, p.ift ?? null, p.dose_ha ?? null)
    }

    ids.push(id)
  }

  res.json({ ids, count: ids.length })
})

// ─── Agrégat IFT calculé à la volée depuis rapports_phyto ─────────────────────
function aggregateIftByYear(annee) {
  // Tous les rapports + produits + parcelles pour l'année
  const rows = db.prepare(`
    SELECT
      rp.id as rapport_id, rp.date, rp.prestataire,
      rpp.parcelle_id, rpp.parcelle_nom_source,
      p.nom as parcelle_nom_app,
      rpr.nom as prod_nom, rpr.type as prod_type, rpr.ift_value, rpr.quantite, rpr.unite, rpr.dose_ha
    FROM rapports_phyto rp
    LEFT JOIN rapports_phyto_parcelles rpp ON rpp.rapport_id = rp.id
    LEFT JOIN parcelles p ON p.id = rpp.parcelle_id
    LEFT JOIN rapports_phyto_produits rpr ON rpr.rapport_id = rp.id
    WHERE strftime('%Y', rp.date) = ?
  `).all(String(annee))

  // Grouper par parcelle (par id si lié, sinon par nom_source)
  const parcellesMap = new Map()
  for (const r of rows) {
    const key = r.parcelle_id || r.parcelle_nom_source || '__sans_parcelle__'
    if (!parcellesMap.has(key)) {
      parcellesMap.set(key, {
        parcelle_id: r.parcelle_id,
        parcelle_nom_source: r.parcelle_nom_source,
        parcelle_nom_app: r.parcelle_nom_app,
        prestataire: r.prestataire,
        ift_herbicide: 0, ift_fongicide: 0, ift_insecticide: 0,
        ift_autres: 0, ift_bio: 0, ift_biocontrole: 0, ift_total: 0,
        cuivre_kg: 0, surface_ha: null,
        produits: [],
      })
    }
    const acc = parcellesMap.get(key)
    if (!r.prod_nom) continue

    const ift = r.ift_value || 0
    acc.ift_total += ift
    const t = (r.prod_type || 'autre').toLowerCase()
    if (t === 'herbicide')   acc.ift_herbicide += ift
    else if (t === 'fongicide')   acc.ift_fongicide += ift
    else if (t === 'insecticide') acc.ift_insecticide += ift
    else if (t === 'biocontrole') acc.ift_biocontrole += ift
    else acc.ift_autres += ift

    // Cuivre : produits contenant "cuivre" ou "cu " ou cuivre dans le nom (heuristique simple)
    if (/cuivre|nordox|kocide|champ\s*flo|colpenn|bouillie\s*bordelaise/i.test(r.prod_nom) && r.unite?.toLowerCase() === 'kg') {
      acc.cuivre_kg += r.quantite || 0
    }

    // Surface depuis quantite/dose_ha si dispo
    if (!acc.surface_ha && r.dose_ha > 0 && r.quantite > 0) {
      acc.surface_ha = Math.round(r.quantite / r.dose_ha * 100) / 100
    }

    // Cumul produits (somme quantite par nom)
    const prodExisting = acc.produits.find(p => p.nom === r.prod_nom)
    if (prodExisting) {
      prodExisting.quantite = Math.round((prodExisting.quantite + (r.quantite || 0)) * 1000) / 1000
    } else {
      acc.produits.push({ nom: r.prod_nom, quantite: r.quantite || 0, unite: r.unite })
    }
  }

  // Calcule cuivre kg/ha + arrondi IFT
  const parcelles = [...parcellesMap.values()].map(p => {
    const cuivre_kg_ha = p.surface_ha > 0 ? Math.round(p.cuivre_kg / p.surface_ha * 100) / 100 : null
    return {
      ...p,
      ift_herbicide:   Math.round(p.ift_herbicide * 100) / 100,
      ift_fongicide:   Math.round(p.ift_fongicide * 100) / 100,
      ift_insecticide: Math.round(p.ift_insecticide * 100) / 100,
      ift_autres:      Math.round(p.ift_autres * 100) / 100,
      ift_bio:         0,  // pas distinguable du carnet seul
      ift_biocontrole: Math.round(p.ift_biocontrole * 100) / 100,
      ift_total:       Math.round(p.ift_total * 100) / 100,
      cuivre_kg_ha,
    }
  })
  parcelles.sort((a, b) => (a.parcelle_nom_app || a.parcelle_nom_source || '').localeCompare(b.parcelle_nom_app || b.parcelle_nom_source || '', 'fr'))

  return parcelles
}

// GET /api/phyto/recaps/:annee — agrégat IFT calculé depuis rapports_phyto
router.get('/recaps/:annee', (req, res) => {
  const annee = parseInt(req.params.annee)
  const parcelles = aggregateIftByYear(annee)
  // Prestataire = celui le plus représenté
  const prestComp = {}
  for (const p of parcelles) {
    if (p.prestataire) prestComp[p.prestataire] = (prestComp[p.prestataire] || 0) + 1
  }
  const prestataire = Object.entries(prestComp).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Années avec données
  const anneesRows = db.prepare(`SELECT DISTINCT strftime('%Y', date) as a FROM rapports_phyto WHERE date IS NOT NULL ORDER BY a DESC`).all()
  const annees = anneesRows.map(r => parseInt(r.a)).filter(Boolean)

  // 1 seul "recap" virtuel (puisqu'on agrège)
  const recap = parcelles.length > 0
    ? { id: `agg-${annee}`, annee, prestataire, parcelles }
    : null

  res.json({ recaps: recap ? [recap] : [], annees_disponibles: annees })
})

// POST /api/phyto/recaps — sauvegarde uniquement les traitements datés (carnet)
router.post('/recaps', (req, res) => {
  const { prestataire, parcelles, traitements } = req.body

  // Auto-ajout du prestataire au référentiel s'il est nouveau
  if (prestataire && prestataire.trim()) {
    const trimmed = prestataire.trim()
    const exists = db.prepare(`SELECT id FROM referentiels WHERE type = 'prestataire' AND valeur = ?`).get(trimmed)
    if (!exists) {
      const next = db.prepare(`SELECT COALESCE(MAX(ordre), -1) + 1 AS n FROM referentiels WHERE type = 'prestataire'`).get().n
      db.prepare(`INSERT INTO referentiels (type, valeur, ordre) VALUES ('prestataire', ?, ?)`).run(trimmed, next)
    }
  }

  // Mappings utilisateur (nom_source → parcelle_id) viennent de la confirmation parcelles
  const insMapping = db.prepare(`INSERT OR REPLACE INTO phyto_parcelle_mapping (prestataire, nom_source, parcelle_id, updated_at) VALUES (?,?,?,datetime('now'))`)
  const sourceToParcelle = {}
  for (const p of (parcelles || [])) {
    const src = p.nomSource || p.parcelle_nom_source
    if (src && p.parcelle_id) {
      sourceToParcelle[src] = p.parcelle_id
      insMapping.run(prestataire || '', src, p.parcelle_id)
    }
  }

  let nbTraitements = 0
  if (Array.isArray(traitements)) {
    for (const t of traitements) {
      if (!t.date) continue
      const rId = uuidv4()
      db.prepare(`INSERT INTO rapports_phyto (id, date, prestataire, notes, user_id, source) VALUES (?,?,?,?,?,?)`)
        .run(rId, t.date, prestataire || null, t.ot_num ? `OT ${t.ot_num}${t.description ? ' — ' + t.description : ''}` : (t.description || null), req.userId, 'pdf_carnet')

      const linkedId = sourceToParcelle[t.parcelle_nom_source] || t.parcelle_id || null
      if (t.parcelle_nom_source) {
        db.prepare(`INSERT INTO rapports_phyto_parcelles (id, rapport_id, parcelle_id, parcelle_nom_source) VALUES (?,?,?,?)`)
          .run(uuidv4(), rId, linkedId, t.parcelle_nom_source)
      }

      for (const pr of (t.produits || [])) {
        db.prepare(`INSERT INTO rapports_phyto_produits (id, rapport_id, nom, cible, type, quantite, unite, ift_value, dose_ha) VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(uuidv4(), rId, pr.nom, pr.cible || null, pr.type || null, pr.quantite ?? null, pr.unite || null, pr.ift ?? null, pr.dose_ha ?? null)
      }
      nbTraitements++
    }
  }

  res.json({ nbTraitements })
})

// DELETE /api/phyto/recaps/:id — supprime tous les rapports d'une année (id = "agg-YYYY")
router.delete('/recaps/:id', (req, res) => {
  const match = req.params.id.match(/^agg-(\d{4})$/)
  if (!match) return res.status(400).json({ error: 'id invalide' })
  const annee = match[1]
  const rapports = db.prepare(`SELECT id FROM rapports_phyto WHERE strftime('%Y', date) = ?`).all(annee)
  for (const r of rapports) {
    db.prepare('DELETE FROM rapports_phyto WHERE id = ?').run(r.id)
  }
  res.json({ ok: true, deleted: rapports.length })
})

// GET /api/phyto/recaps/:annee/export.csv — CSV export agrégé depuis rapports_phyto
router.get('/recaps/:annee/export.csv', (req, res) => {
  const annee = parseInt(req.params.annee)
  const parcelles = aggregateIftByYear(annee)

  const header = 'Parcelle;Surface (ha);IFT Herbicide;IFT Fongicide;IFT Insecticide;IFT Autres;IFT Biocontrôle;IFT Total;Cuivre (kg/ha);Prestataire'
  const csv = [header, ...parcelles.map(p =>
    [p.parcelle_nom_app || p.parcelle_nom_source, p.surface_ha ?? '',
     p.ift_herbicide, p.ift_fongicide, p.ift_insecticide, p.ift_autres,
     p.ift_biocontrole, p.ift_total, p.cuivre_kg_ha ?? '', p.prestataire ?? '']
    .join(';')
  )].join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="IFT-${annee}.csv"`)
  res.send('﻿' + csv)
})

export default router
