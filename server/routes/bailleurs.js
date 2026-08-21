import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

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

// GET /api/bailleurs/releve/:annee
// Relevé des kilos dus à chaque bailleur pour une saison : les parcelles
// qu'il loue, ce qui y a été récolté, et sa part. Document destiné à être
// imprimé et remis au bailleur, puisque la part lui est livrée en raisin.
router.get('/releve/:annee', (req, res) => {
  const annee = parseInt(req.params.annee, 10)
  if (!Number.isInteger(annee)) return res.status(400).json({ error: 'Année invalide' })

  const rows = db.prepare(`
    SELECT p.id, p.nom AS parcelle_nom, p.commune, p.bailleur, p.bailleur_taux,
           p.surface_totale_ca,
           COALESCE(v.poids_total, 0)      AS poids_total,
           COALESCE(v.nb_caisses_total, 0) AS nb_caisses_total
    FROM parcelles p
    LEFT JOIN vendanges v ON v.parcelle_id = p.id AND v.annee = ?
    WHERE p.bailleur IS NOT NULL AND TRIM(p.bailleur) <> ''
    ORDER BY p.bailleur COLLATE NOCASE, p.nom COLLATE NOCASE
  `).all(annee)

  // Regroupement par bailleur
  const parBailleur = new Map()
  for (const r of rows) {
    const part = partBailleur(r.poids_total, r.bailleur_taux)
    if (!parBailleur.has(r.bailleur)) {
      parBailleur.set(r.bailleur, { bailleur: r.bailleur, parcelles: [], total_recolte: 0, total_part: 0 })
    }
    const b = parBailleur.get(r.bailleur)
    b.parcelles.push({
      id: r.id,
      nom: r.parcelle_nom,
      commune: r.commune,
      taux: r.bailleur_taux,
      surface_totale_ca: r.surface_totale_ca,
      poids_total: r.poids_total,
      nb_caisses_total: r.nb_caisses_total,
      part_kg: Math.round(part * 10) / 10,
    })
    b.total_recolte += r.poids_total
    b.total_part    += part
  }

  const bailleurs = [...parBailleur.values()].map(b => ({
    ...b,
    total_recolte: Math.round(b.total_recolte * 10) / 10,
    total_part:    Math.round(b.total_part * 10) / 10,
  }))

  res.json({
    annee,
    bailleurs,
    total_part: Math.round(bailleurs.reduce((s, b) => s + b.total_part, 0) * 10) / 10,
  })
})

export default router
