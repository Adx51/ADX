import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// POST /api/livraisons
// Enregistre une livraison au pressoir répartie sur plusieurs parcelles.
//
// Le pressoir ne pèse qu'une fois la remorque entière ; la répartition entre
// parcelles est calculée côté client au prorata des caisses. On enregistre
// malgré tout UN CHARGEMENT PAR PARCELLE : c'est ce qui permet de garder un
// rendement kg/ha juste et une déclaration de récolte exploitable. Les lignes
// partagent un livraison_id pour rester rattachables à la même pesée.
//
// Tout est fait dans UNE transaction : hors ligne cela ne produit qu'une seule
// opération en file, et une livraison ne peut jamais être enregistrée à moitié
// (ce qui fausserait le total pesé).
router.post('/', (req, res) => {
  const { annee, date_chargement, heure_livraison, notes, lignes } = req.body

  if (!date_chargement) return res.status(400).json({ error: 'Date requise' })
  if (!Number.isInteger(annee)) return res.status(400).json({ error: 'Année requise' })
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne à enregistrer' })
  }

  // On ignore les lignes vides (une parcelle peut se retrouver à 0 caisse si
  // toute la livraison a été basculée sur une autre).
  const valides = lignes.filter(l =>
    l && l.parcelle_id &&
    Number(l.nombre_caisses) > 0 &&
    Number.isFinite(Number(l.poids_kg)) && Number(l.poids_kg) >= 0
  )
  if (valides.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne exploitable' })
  }

  // Toutes les parcelles doivent exister
  const ids = [...new Set(valides.map(l => l.parcelle_id))]
  const placeholders = ids.map(() => '?').join(',')
  const trouvees = db.prepare(`SELECT id FROM parcelles WHERE id IN (${placeholders})`).all(...ids)
  if (trouvees.length !== ids.length) {
    return res.status(404).json({ error: 'Parcelle introuvable' })
  }

  const livraisonId = uuidv4()
  let cree = []

  try {
    const tx = db.transaction(() => {
      for (const l of valides) {
        // La vendange de cette parcelle pour l'année peut ne pas exister
        // encore (parcelle pas encore commencée) : on la crée au passage.
        let v = db.prepare('SELECT id, statut FROM vendanges WHERE parcelle_id = ? AND annee = ?')
                  .get(l.parcelle_id, annee)
        if (!v) {
          const p = db.prepare('SELECT nom FROM parcelles WHERE id = ?').get(l.parcelle_id)
          const vid = uuidv4()
          db.prepare(`
            INSERT INTO vendanges (id, user_id, parcelle_id, parcelle_nom, annee)
            VALUES (?,?,?,?,?)
          `).run(vid, req.userId, l.parcelle_id, p?.nom || null, annee)
          v = { id: vid, statut: 'en_cours' }
        }
        if (v.statut === 'cloturee') {
          const p = db.prepare('SELECT nom FROM parcelles WHERE id = ?').get(l.parcelle_id)
          throw new Error(`La vendange de ${p?.nom || 'cette parcelle'} est clôturée — rouvrez-la pour enregistrer cette livraison`)
        }

        const cid = uuidv4()
        db.prepare(`
          INSERT INTO chargements
            (id, vendange_id, nombre_caisses, poids_kg, date_chargement, heure_livraison, notes, livraison_id)
          VALUES (?,?,?,?,?,?,?,?)
        `).run(cid, v.id, Math.round(Number(l.nombre_caisses)), Number(l.poids_kg),
               date_chargement, heure_livraison || null, notes || null, livraisonId)
        cree.push(cid)
      }
    })
    tx()
  } catch (e) {
    // La transaction a été annulée : rien n'a été écrit.
    return res.status(409).json({ error: e.message })
  }

  const rows = db.prepare(
    `SELECT * FROM chargements WHERE livraison_id = ? ORDER BY rowid`
  ).all(livraisonId)

  res.json({ livraison_id: livraisonId, chargements: rows })
})

export default router
