import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { requireAuth, requireDeletePermission } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// Parcelles liées à une tâche (depuis la table de liaison)
function parcellesOf(tacheId) {
  return db.prepare(`
    SELECT p.id, p.nom, p.commune
    FROM tache_parcelles tp JOIN parcelles p ON p.id = tp.parcelle_id
    WHERE tp.tache_id = ?
    ORDER BY p.nom
  `).all(tacheId)
}

// Filtre une liste d'ids reçus pour ne garder que des parcelles existantes
function validParcelleIds(ids) {
  if (!Array.isArray(ids)) return []
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return []
  const placeholders = uniq.map(() => '?').join(',')
  const found = db.prepare(`SELECT id FROM parcelles WHERE id IN (${placeholders})`).all(...uniq)
  const set = new Set(found.map(r => r.id))
  return uniq.filter(id => set.has(id))
}

// Écrit les liens tâche ↔ parcelles (remplace l'existant)
function setLinks(tacheId, ids) {
  db.prepare('DELETE FROM tache_parcelles WHERE tache_id = ?').run(tacheId)
  const ins = db.prepare('INSERT OR IGNORE INTO tache_parcelles (tache_id, parcelle_id) VALUES (?, ?)')
  for (const pid of ids) ins.run(tacheId, pid)
}

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM taches
    ORDER BY COALESCE(date_debut, date_fin, date_echeance) ASC NULLS LAST, created_at DESC
  `).all()

  // Tous les liens en une requête, regroupés par tâche
  const links = db.prepare(`
    SELECT tp.tache_id, p.id, p.nom, p.commune
    FROM tache_parcelles tp JOIN parcelles p ON p.id = tp.parcelle_id
    ORDER BY p.nom
  `).all()
  const byTache = {}
  for (const l of links) {
    (byTache[l.tache_id] ||= []).push({ id: l.id, nom: l.nom, commune: l.commune })
  }

  res.json(rows.map(r => ({ ...r, parcelles: byTache[r.id] || [] })))
})

router.post('/', (req, res) => {
  const { titre, description, parcelle_ids, commune, statut, priorite, date_echeance, photo_url, date_debut, date_fin } = req.body
  if (!titre) return res.status(400).json({ error: 'Le titre est requis' })

  const ids = validParcelleIds(parcelle_ids)
  const id = uuidv4()

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO taches
        (id, user_id, parcelle_id, commune, titre, description, statut, priorite, date_echeance, photo_url, date_debut, date_fin)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, req.userId, null, commune || null, titre, description || null,
           statut || 'a_faire', priorite || 'normale', date_echeance || date_fin || null, photo_url || null,
           date_debut || null, date_fin || null)
    setLinks(id, ids)
  })
  tx()

  const t = db.prepare('SELECT * FROM taches WHERE id = ?').get(id)
  res.json({ ...t, parcelles: parcellesOf(id) })
})

router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' })
  const parcelles = parcellesOf(t.id)
  res.json({ ...t, parcelles, parcelle_ids: parcelles.map(p => p.id) })
})

// Mise à jour du statut seul — ne touche ni aux dates ni aux liens parcelles.
// Utilisé par le cycle de statut (liste des tâches, activité d'une parcelle).
router.put('/:id/statut', (req, res) => {
  const t = db.prepare('SELECT id FROM taches WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' })

  const { statut } = req.body
  if (!['a_faire', 'en_cours', 'termine'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' })
  }
  db.prepare(`UPDATE taches SET statut = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(statut, req.params.id)

  const updated = db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id)
  res.json({ ...updated, parcelles: parcellesOf(req.params.id) })
})

router.put('/:id', (req, res) => {
  const t = db.prepare('SELECT id FROM taches WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' })

  const { titre, description, parcelle_ids, commune, statut, priorite, date_echeance, photo_url, date_debut, date_fin } = req.body

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE taches SET
        titre = ?, description = ?, parcelle_id = ?, commune = ?, statut = ?,
        priorite = ?, date_echeance = ?, photo_url = ?, date_debut = ?, date_fin = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(titre, description || null, null, commune || null, statut,
           priorite, date_echeance || date_fin || null, photo_url || null,
           date_debut || null, date_fin || null, req.params.id)
    // Ne réécrire les liens que si le client a explicitement envoyé parcelle_ids —
    // sinon un PUT partiel (ex: ancien toggle de statut) effaçait tous les liens.
    if (parcelle_ids !== undefined) {
      setLinks(req.params.id, validParcelleIds(parcelle_ids))
    }
  })
  tx()

  const updated = db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id)
  res.json({ ...updated, parcelles: parcellesOf(req.params.id) })
})

router.delete('/:id', requireDeletePermission('taches'), (req, res) => {
  const t = db.prepare('SELECT id FROM taches WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' })
  db.prepare('DELETE FROM taches WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
