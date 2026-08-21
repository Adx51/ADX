import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
// Réservé à l'administrateur, comme le registre phytosanitaire : le suivi des
// bailleurs n'est pas encore assez abouti pour être ouvert aux autres comptes.
router.use(requireAuth, requireAdmin)

// Part revenant au bailleur selon le taux du bail.
// « au quart » : 1/4 — quart franc champenois, le bailleur ne supporte
//                aucune charge d'exploitation.
// « au tiers »  : 1/3 — plafond de droit commun (règle du tiercement).
// La division est faite ici, exactement : rien n'est stocké en décimal.
const DIVISEUR = { quart: 4, tiers: 3 }

export function partBailleur(poidsTotal, taux) {
  const d = DIVISEUR[taux]
  if (!d || !poidsTotal) return 0
  return poidsTotal / d
}

// Cépage auquel rattacher la récolte d'une parcelle.
// Une parcelle mono-cépage — le cas courant en Champagne — attribue toute sa
// récolte à ce cépage. Une parcelle plantée en plusieurs cépages ne peut PAS
// être ventilée : les pesées sont faites par parcelle, pas par cépage. On la
// regroupe alors sous le libellé de son assemblage, sans inventer de clé de
// répartition qui fausserait un document remis au bailleur.
function cepageDe(cepagesJson) {
  let list = []
  try { list = JSON.parse(cepagesJson || '[]') } catch {}
  if (!Array.isArray(list) || list.length === 0) return 'Cépage non renseigné'
  if (list.length === 1) return list[0]
  return list.join(' + ')
}

const arrondi = n => Math.round(n * 10) / 10

// GET /api/bailleurs/releve/:annee
// Relevé destiné à être imprimé et remis au bailleur : par cépage, ce qui lui
// est dû, ce qui lui a déjà été livré et ce qui reste à livrer ; puis le
// détail parcelle par parcelle.
router.get('/releve/:annee', (req, res) => {
  const annee = parseInt(req.params.annee, 10)
  if (!Number.isInteger(annee)) return res.status(400).json({ error: 'Année invalide' })

  const rows = db.prepare(`
    SELECT p.id, p.nom AS parcelle_nom, p.commune, p.cepages,
           p.bailleur, p.bailleur_taux, p.surface_totale_ca,
           COALESCE(v.poids_total, 0)      AS poids_total,
           COALESCE(v.nb_caisses_total, 0) AS nb_caisses_total
    FROM parcelles p
    LEFT JOIN vendanges v ON v.parcelle_id = p.id AND v.annee = ?
    WHERE p.bailleur IS NOT NULL AND TRIM(p.bailleur) <> ''
    ORDER BY p.bailleur COLLATE NOCASE, p.nom COLLATE NOCASE
  `).all(annee)

  const livraisons = db.prepare(`
    SELECT id, bailleur, date_livraison, cepage, poids_kg, notes
    FROM livraisons_bailleur
    WHERE annee = ?
    ORDER BY date_livraison ASC, created_at ASC
  `).all(annee)

  const parBailleur = new Map()
  function bloc(nom) {
    if (!parBailleur.has(nom)) {
      parBailleur.set(nom, {
        bailleur: nom, parcelles: [], cepages: new Map(), livraisons: [],
        total_recolte: 0, total_du: 0, total_livre: 0,
      })
    }
    return parBailleur.get(nom)
  }

  // Ce qui est dû, ventilé par cépage
  for (const r of rows) {
    const b = bloc(r.bailleur)
    const cep = cepageDe(r.cepages)
    const du = partBailleur(r.poids_total, r.bailleur_taux)

    b.parcelles.push({
      id: r.id,
      nom: r.parcelle_nom,
      commune: r.commune,
      cepage: cep,
      taux: r.bailleur_taux,
      surface_totale_ca: r.surface_totale_ca,
      poids_total: r.poids_total,
      nb_caisses_total: r.nb_caisses_total,
      part_kg: arrondi(du),
    })

    const c = b.cepages.get(cep) || { cepage: cep, du: 0, livre: 0 }
    c.du += du
    b.cepages.set(cep, c)

    b.total_recolte += r.poids_total
    b.total_du      += du
  }

  // Ce qui a déjà été livré, imputé sur le cépage correspondant
  for (const l of livraisons) {
    const b = bloc(l.bailleur)
    b.livraisons.push(l)
    b.total_livre += l.poids_kg || 0

    const cle = l.cepage || 'Cépage non renseigné'
    const c = b.cepages.get(cle) || { cepage: cle, du: 0, livre: 0 }
    c.livre += l.poids_kg || 0
    b.cepages.set(cle, c)
  }

  const bailleurs = [...parBailleur.values()]
    .map(b => ({
      bailleur: b.bailleur,
      parcelles: b.parcelles,
      livraisons: b.livraisons,
      cepages: [...b.cepages.values()]
        .map(c => ({
          cepage: c.cepage,
          du:     arrondi(c.du),
          livre:  arrondi(c.livre),
          reste:  arrondi(c.du - c.livre),
        }))
        .sort((a, b2) => a.cepage.localeCompare(b2.cepage, 'fr')),
      total_recolte: arrondi(b.total_recolte),
      total_du:      arrondi(b.total_du),
      total_livre:   arrondi(b.total_livre),
      total_reste:   arrondi(b.total_du - b.total_livre),
    }))
    .sort((a, b2) => a.bailleur.localeCompare(b2.bailleur, 'fr'))

  res.json({
    annee,
    bailleurs,
    total_du:    arrondi(bailleurs.reduce((s, b) => s + b.total_du, 0)),
    total_livre: arrondi(bailleurs.reduce((s, b) => s + b.total_livre, 0)),
    total_reste: arrondi(bailleurs.reduce((s, b) => s + b.total_reste, 0)),
  })
})

// POST /api/bailleurs/livraisons — enregistre une livraison de raisin
router.post('/livraisons', (req, res) => {
  const { bailleur, annee, date_livraison, cepage, poids_kg, notes } = req.body
  if (!bailleur?.trim())          return res.status(400).json({ error: 'Bailleur requis' })
  if (!Number.isInteger(annee))   return res.status(400).json({ error: 'Année requise' })
  if (!date_livraison)            return res.status(400).json({ error: 'Date requise' })
  const kg = Number(poids_kg)
  if (!Number.isFinite(kg) || kg <= 0) return res.status(400).json({ error: 'Poids invalide' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO livraisons_bailleur
      (id, bailleur, annee, date_livraison, cepage, poids_kg, notes, user_id)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(id, bailleur.trim(), annee, date_livraison,
         cepage?.trim() || null, kg, notes?.trim() || null, req.userId)

  res.json(db.prepare('SELECT * FROM livraisons_bailleur WHERE id = ?').get(id))
})

router.delete('/livraisons/:id', (req, res) => {
  const l = db.prepare('SELECT id FROM livraisons_bailleur WHERE id = ?').get(req.params.id)
  if (!l) return res.status(404).json({ error: 'Livraison introuvable' })
  db.prepare('DELETE FROM livraisons_bailleur WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
