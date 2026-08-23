import PDFDocument from 'pdfkit'

const MARGIN    = 40
const PAGE_W    = 595.28
const PAGE_H    = 841.89
const CONTENT_W = PAGE_W - MARGIN * 2  // 515.28

const C = {
  border:  '#999999',
  headBg:  '#e5e7eb',
  totalBg: '#d1d5db',
  subBg:   '#fef3c7',
  text:    '#111827',
  dim:     '#6b7280',
  mid:     '#374151',
}

const ROW_H = 22
const HDR_H = 24

// ── Helpers surface ────────────────────────────────────────────────────
function caToDisplay(ca) {
  if (!ca && ca !== 0) return '—'
  const a = Math.floor(ca / 100), c = ca % 100
  return c === 0 ? `${a} A` : `${a} A ${String(c).padStart(2, '0')}`
}
function caToDisplayHa(ca) {
  if (!ca && ca !== 0) return '—'
  if (ca < 10000) return caToDisplay(ca)
  const ha = Math.floor(ca / 10000), a = Math.floor((ca % 10000) / 100), c = ca % 100
  if (a === 0 && c === 0) return `${ha} ha`
  if (c === 0) return `${ha} ha ${a} A`
  return `${ha} ha ${a} A ${String(c).padStart(2, '0')}`
}
function rendKgHa(poids, surfCa) {
  if (!surfCa || !poids) return null
  return Math.round(poids / (surfCa / 10000))
}
function frNum(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
function formatDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const DAYS   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet',
                  'août','septembre','octobre','novembre','décembre']
  return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`
}

// ── Dessin d'une cellule ───────────────────────────────────────────────
function cell(doc, x, y, w, h, opts = {}) {
  const { bg, text, sz = 9, bold = false, italic = false,
          align = 'left', color = C.text, pad = 5 } = opts
  doc.save()
  if (bg) {
    doc.rect(x, y, w, h).fillAndStroke(bg, C.border)
  } else {
    doc.rect(x, y, w, h).stroke(C.border)
  }
  if (text !== undefined && text !== null) {
    const fontName = bold ? 'Helvetica-Bold' : italic ? 'Helvetica-Oblique' : 'Helvetica'
    const ty = y + Math.max(2, (h - sz * 1.3) / 2)
    doc.font(fontName).fontSize(sz).fillColor(color)
       .text(String(text), x + pad, ty, { width: w - pad * 2, align, lineBreak: false, ellipsis: true })
  }
  doc.restore()
}

// ── Export par parcelle (groupé par pressoir) ──────────────────────────
export function buildPdfExport(annee, groupes) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true })

  const cw = [Math.round(CONTENT_W * 0.46), Math.round(CONTENT_W * 0.34), 0]
  cw[2] = CONTENT_W - cw[0] - cw[1]

  groupes.forEach((groupe, gi) => {
    if (gi > 0) doc.addPage()
    let y = MARGIN

    // Titre
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
       .text(`VENDANGES ${annee}`, MARGIN, y, { width: CONTENT_W, align: 'center', lineBreak: false })
    y += 18
    doc.font('Helvetica').fontSize(10).fillColor(C.mid)
       .text(`PARCELLES DE ${groupe.pressoir.toUpperCase()}`, MARGIN, y, { width: CONTENT_W, align: 'center', lineBreak: false })
    y += 22

    // En-tête colonnes
    const hx = MARGIN
    cell(doc, hx,                    y, cw[0], HDR_H, { bg: C.headBg, text: 'NOM',       bold: true, sz: 8 })
    cell(doc, hx + cw[0],            y, cw[1], HDR_H, { bg: C.headBg, text: 'POIDS',     bold: true, sz: 8, align: 'center' })
    cell(doc, hx + cw[0] + cw[1],   y, cw[2], HDR_H, { bg: C.headBg, text: 'RENDEMENT', bold: true, sz: 8, align: 'center' })
    y += HDR_H

    // Totaux groupe
    const vendangees = groupe.parcelles.filter(p => p.vendange_id)
    const totalSurf  = groupe.parcelles.reduce((s, p) => s + (p.surface_totale_ca || 0), 0)
    const totalPoids = vendangees.reduce((s, p) => s + (p.poids_total || 0), 0)
    const totalCaiss = vendangees.reduce((s, p) => s + (p.nb_caisses_total || 0), 0)
    const rendTotal  = rendKgHa(totalPoids, totalSurf)

    for (const p of groupe.parcelles) {
      const hasV   = Boolean(p.vendange_id)
      const chargs = p.chargements || []
      const rend   = hasV ? rendKgHa(p.poids_total, p.surface_totale_ca) : null

      // Parcelle sans vendange
      if (!hasV) {
        if (y + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }
        cell(doc, hx,                  y, cw[0], ROW_H, { text: `${p.nom}  ${caToDisplayHa(p.surface_totale_ca)}`, italic: true, color: C.dim, sz: 8 })
        cell(doc, hx + cw[0],          y, cw[1], ROW_H, { text: 'Non commencé', italic: true, color: C.dim, align: 'center', sz: 8 })
        cell(doc, hx + cw[0] + cw[1], y, cw[2], ROW_H)
        y += ROW_H
        continue
      }

      // Vendange sans chargements
      if (chargs.length === 0) {
        if (y + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }
        cell(doc, hx,                  y, cw[0], ROW_H, { text: `${p.nom.toUpperCase()}  ${caToDisplayHa(p.surface_totale_ca)}`, bold: true })
        cell(doc, hx + cw[0],          y, cw[1], ROW_H, { text: 'Aucun chargement', italic: true, color: C.dim, align: 'center', sz: 8 })
        cell(doc, hx + cw[0] + cw[1], y, cw[2], ROW_H, { text: '—', align: 'center' })
        y += ROW_H
        continue
      }

      // Chargements (cellules nom + rendement en "spanning")
      const nRows  = chargs.length + 1  // toujours une ligne Total
      const blockH = nRows * ROW_H

      if (y + blockH > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }

      // Col 0 : nom (spanning)
      doc.save()
      doc.rect(hx, y, cw[0], blockH).stroke(C.border)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text)
         .text(p.nom.toUpperCase(), hx + 5, y + 5, { width: cw[0] - 10, lineBreak: false, ellipsis: true })
      doc.font('Helvetica').fontSize(7.5).fillColor(C.dim)
         .text(caToDisplayHa(p.surface_totale_ca), hx + 5, y + 17, { width: cw[0] - 10, lineBreak: false })
      doc.restore()

      // Col 2 : rendement (spanning)
      const rx = hx + cw[0] + cw[1]
      const rendStr = rend ? `${frNum(rend)} kg/ha` : '—'
      doc.save()
      doc.rect(rx, y, cw[2], blockH).stroke(C.border)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text)
         .text(rendStr, rx + 3, y + (blockH - 11) / 2, { width: cw[2] - 6, align: 'center', lineBreak: false })
      doc.restore()

      // Col 1 : une ligne par chargement
      const cx = hx + cw[0]
      let ry = y
      for (const c of chargs) {
        const heure = c.heure_livraison ? c.heure_livraison.slice(0, 5) : '—'
        doc.save()
        doc.rect(cx, ry, cw[1], ROW_H).stroke(C.border)
        doc.font('Helvetica').fontSize(8).fillColor(C.dim)
           .text(heure, cx + 5, ry + (ROW_H - 10) / 2, { width: 38, lineBreak: false })
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text)
           .text(`${c.nombre_caisses}c  ${c.poids_kg} kg`, cx + 46, ry + (ROW_H - 11) / 2,
                 { width: cw[1] - 52, align: 'right', lineBreak: false })
        doc.restore()
        ry += ROW_H
      }

      // Ligne Total (toujours affichée)
      {
        const totC = chargs.reduce((s, c) => s + (c.nombre_caisses || 0), 0)
        const totP = Number(p.poids_total || 0).toFixed(0)
        doc.save()
        doc.rect(cx, ry, cw[1], ROW_H).fillAndStroke(C.subBg, C.border)
        doc.font('Helvetica').fontSize(7.5).fillColor(C.mid)
           .text('Total', cx + 5, ry + (ROW_H - 9) / 2, { width: 35, lineBreak: false })
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text)
           .text(`${totC}c  ${totP} kg`, cx + 43, ry + (ROW_H - 11) / 2,
                 { width: cw[1] - 49, align: 'right', lineBreak: false })
        doc.restore()
      }

      y += blockH
    }

    // Ligne total groupe
    if (y + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }
    cell(doc, hx,                  y, cw[0], ROW_H, { bg: C.totalBg, text: `TOTAL — ${caToDisplayHa(totalSurf)}`,  bold: true })
    cell(doc, hx + cw[0],          y, cw[1], ROW_H, { bg: C.totalBg, text: `${totalCaiss}c   ${frNum(totalPoids)} kg`, bold: true, align: 'center' })
    cell(doc, hx + cw[0] + cw[1], y, cw[2], ROW_H, { bg: C.totalBg, text: rendTotal ? `${frNum(rendTotal)} kg/ha` : '—', bold: true, align: 'center' })
  })

  doc.end()
  return doc
}

// ── Export journalier ──────────────────────────────────────────────────
export function buildPdfJournalier(annee, jours, totalCaisses, totalPoids) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true })

  const cw = [52, 0, 95, 115]
  cw[1] = CONTENT_W - cw[0] - cw[2] - cw[3]

  let y = MARGIN
  const x = MARGIN

  // Titre
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
     .text(`VENDANGES ${annee}`, MARGIN, y, { width: CONTENT_W, align: 'center', lineBreak: false })
  y += 18
  doc.font('Helvetica').fontSize(10).fillColor(C.mid)
     .text('BILAN JOURNALIER', MARGIN, y, { width: CONTENT_W, align: 'center', lineBreak: false })
  y += 22

  for (const jour of jours) {
    // Page break si on n'a pas la place pour au moins en-tête + 1 ligne
    if (y + HDR_H + HDR_H + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }

    // En-tête date (pleine largeur)
    doc.save()
    doc.rect(x, y, CONTENT_W, HDR_H).fillAndStroke(C.headBg, C.border)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
       .text(formatDate(jour.date), x + 6, y + (HDR_H - 12) / 2, { width: CONTENT_W - 12, lineBreak: false })
    doc.restore()
    y += HDR_H

    // En-tête colonnes
    cell(doc, x,                         y, cw[0], HDR_H, { bg: C.headBg, text: 'HEURE',    bold: true, sz: 8, align: 'center' })
    cell(doc, x + cw[0],                 y, cw[1], HDR_H, { bg: C.headBg, text: 'PARCELLE', bold: true, sz: 8 })
    cell(doc, x + cw[0] + cw[1],         y, cw[2], HDR_H, { bg: C.headBg, text: 'CAISSES',  bold: true, sz: 8, align: 'center' })
    cell(doc, x + cw[0] + cw[1] + cw[2], y, cw[3], HDR_H, { bg: C.headBg, text: 'POIDS',    bold: true, sz: 8, align: 'center' })
    y += HDR_H

    // Chargements
    for (const c of jour.chargements) {
      if (y + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }
      cell(doc, x,                         y, cw[0], ROW_H, { text: c.heure_livraison ? c.heure_livraison.slice(0, 5) : '—', color: C.dim, align: 'center', sz: 8 })
      cell(doc, x + cw[0],                 y, cw[1], ROW_H, { text: (c.parcelle_nom || '—').toUpperCase(), bold: true, sz: 9 })
      cell(doc, x + cw[0] + cw[1],         y, cw[2], ROW_H, { text: String(c.nombre_caisses), align: 'center' })
      cell(doc, x + cw[0] + cw[1] + cw[2], y, cw[3], ROW_H, { text: `${c.poids_kg} kg`, align: 'center' })
      y += ROW_H
    }

    // Sous-total jour
    if (y + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }
    cell(doc, x,                         y, cw[0] + cw[1], ROW_H, { bg: C.subBg, text: 'Total du jour', bold: true, sz: 8 })
    cell(doc, x + cw[0] + cw[1],         y, cw[2],         ROW_H, { bg: C.subBg, text: String(jour.total_caisses), bold: true, align: 'center' })
    cell(doc, x + cw[0] + cw[1] + cw[2], y, cw[3],         ROW_H, { bg: C.subBg, text: `${Number(jour.total_poids).toFixed(0)} kg`, bold: true, align: 'center' })
    y += ROW_H + 8
  }

  // Total général
  if (jours.length > 1) {
    if (y + ROW_H > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN }
    const label = `TOTAL GÉNÉRAL — ${jours.length} jour${jours.length > 1 ? 's' : ''}`
    cell(doc, x,                         y, cw[0] + cw[1], ROW_H, { bg: C.totalBg, text: label, bold: true })
    cell(doc, x + cw[0] + cw[1],         y, cw[2],         ROW_H, { bg: C.totalBg, text: String(totalCaisses), bold: true, align: 'center' })
    cell(doc, x + cw[0] + cw[1] + cw[2], y, cw[3],         ROW_H, { bg: C.totalBg, text: `${Number(totalPoids).toFixed(0)} kg`, bold: true, align: 'center' })
  }

  doc.end()
  return doc
}
