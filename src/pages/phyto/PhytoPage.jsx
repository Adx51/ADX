import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Leaf, Upload, Trash2, BookOpen, LayoutList, Layers, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { api } from '../../lib/api'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import PageHeader from '../../components/PageHeader'

const TYPE_COLOR = {
  fongicide:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  insecticide: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  herbicide:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  biocontrole: 'bg-vigne-100 text-vigne-700 dark:bg-vigne-900/30 dark:text-vigne-400',
  autre:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: fr })
}

function fmtDose(prod) {
  if (prod.dose_ha != null) return `${prod.dose_ha} ${prod.unite || ''}/ha`
  if (prod.dose) return prod.dose
  if (prod.quantite != null) return `${prod.quantite} ${prod.unite || ''}`
  return '—'
}

// ── Vue par OT (groupement par numéro d'OT) ──────────────────────────────────
function VueOTCard({ ot, rapports, confirmDelete, setConfirmDelete, onDelete }) {
  // Tous les rapports partagent date + OT — on prend le premier comme référence
  const ref = rapports[0]
  const dateStr = fmtDate(ref.date)
  // Liste des parcelles (uniques) avec surfaces
  const parcellesMap = new Map()
  for (const r of rapports) {
    for (const p of r.parcelles) {
      const key = p.parcelle_id || p.parcelle_nom_source || '?'
      if (!parcellesMap.has(key)) {
        const nom = p.parcelle_nom_app || p.parcelle_nom_source || '?'
        // Surface : depuis la parcelle liée ou calculée depuis quantite/dose_ha
        let surface = p.surface_ha
        if (!surface) {
          const prod = r.produits.find(pr => pr.dose_ha > 0 && pr.quantite > 0)
          if (prod) surface = Math.round(prod.quantite / prod.dose_ha * 100) / 100
        }
        parcellesMap.set(key, { nom, surface })
      }
    }
  }
  const parcelles = [...parcellesMap.values()]

  // Produits unifiés : on prend les produits du 1er rapport, on somme les quantités sur tous
  const produitsMerged = ref.produits.map(p => {
    let totalQty = 0
    for (const r of rapports) {
      const match = r.produits.find(pr => pr.nom === p.nom)
      if (match?.quantite) totalQty += match.quantite
    }
    return { ...p, quantite_totale: Math.round(totalQty * 1000) / 1000 }
  })

  const deleteKey = `ot-${ot}-${ref.date}`
  const ids = rapports.map(r => r.id)

  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{dateStr}</p>
            <span className="text-xs font-semibold text-vigne-600 dark:text-vigne-400">OT {ot}</span>
            {ref.source === 'pdf_carnet' && (
              <span className="text-[10px] bg-vigne-50 dark:bg-vigne-900/20 text-vigne-600 dark:text-vigne-400 px-1.5 py-0.5 rounded-full">PDF</span>
            )}
            {ref.prestataire && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{ref.prestataire}</span>
            )}
          </div>
          {ref.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{ref.notes.replace(/^OT\s+\d+\s*—?\s*/, '')}</p>
          )}
        </div>
        {confirmDelete === deleteKey ? (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => onDelete(ids)} className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg">Suppr. tout</button>
            <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400">Annuler</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(deleteKey)} className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Parcelles concernées */}
      {parcelles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parcelles.map((p, i) => (
            <span key={i} className="text-[10px] bg-vigne-50 dark:bg-vigne-900/20 text-vigne-700 dark:text-vigne-400 px-1.5 py-0.5 rounded-full">
              📍 {p.nom}{p.surface ? ` · ${p.surface} ha` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Produits (dose/IFT constants par OT, quantité = total cumulée parcelles) */}
      {produitsMerged.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left py-1 px-1 font-medium">Produit</th>
                <th className="text-left py-1 px-1 font-medium hidden sm:table-cell">Cible</th>
                <th className="text-right py-1 px-1 font-medium">Dose app.</th>
                <th className="text-right py-1 px-1 font-medium">Qté tot.</th>
                <th className="text-right py-1 px-1 font-medium">IFT</th>
              </tr>
            </thead>
            <tbody>
              {produitsMerged.map((p, j) => (
                <tr key={j} className="border-t border-gray-100 dark:border-gray-700/50">
                  <td className="py-1 px-1">
                    <div className="flex items-center gap-1.5">
                      {p.type && (
                        <span className={`text-[9px] px-1 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLOR[p.type] || TYPE_COLOR.autre}`}>
                          {p.type.slice(0, 4)}
                        </span>
                      )}
                      <span className="text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{p.nom}</span>
                    </div>
                  </td>
                  <td className="py-1 px-1 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{p.cible || '—'}</td>
                  <td className="py-1 px-1 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtDose(p)}</td>
                  <td className="py-1 px-1 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {p.quantite_totale > 0 ? `${p.quantite_totale} ${p.unite || ''}` : '—'}
                  </td>
                  <td className="py-1 px-1 text-right font-semibold text-gray-700 dark:text-gray-200">
                    {p.ift_value > 0 ? p.ift_value : (p.dar ? <span className="text-amber-600 font-normal">DAR {p.dar}j</span> : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Vue par produit (tableau pour saisie ComitéChampagne) ───────────────────
function VueProduitTable({ rapports, prestataireFilter, setPrestataireFilter, prestatairesDispo }) {
  // Aplatit : 1 ligne par (rapport, produit)
  const rows = []
  for (const r of rapports) {
    if (prestataireFilter && r.prestataire !== prestataireFilter) continue
    for (const p of r.produits) {
      const surface = (p.dose_ha > 0 && p.quantite > 0)
        ? Math.round(p.quantite / p.dose_ha * 100) / 100
        : null
      const parcelleNoms = r.parcelles.map(pc => pc.parcelle_nom_app || pc.parcelle_nom_source || '?').join(', ')
      rows.push({
        date: r.date,
        prod: p,
        surface,
        parcelle: parcelleNoms,
      })
    }
  }
  // Tri par date desc puis par produit
  rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.prod.nom || '').localeCompare(b.prod.nom || ''))

  return (
    <>
      {/* Filtre prestataire */}
      <div className="card">
        <label className="label">Filtre prestataire</label>
        <div className="relative">
          <select
            value={prestataireFilter || ''}
            onChange={e => setPrestataireFilter(e.target.value || null)}
            className="input text-sm pr-8 appearance-none"
          >
            <option value="">Tous les prestataires</option>
            {prestatairesDispo.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {rows.length} ligne{rows.length > 1 ? 's' : ''} produit
        </p>
      </div>

      {/* Tableau */}
      <div className="card -mx-1 px-1 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 font-semibold">Date</th>
              <th className="text-left py-2 px-1 font-semibold">Produit</th>
              <th className="text-left py-2 px-1 font-semibold">Cible</th>
              <th className="text-right py-2 px-1 font-semibold whitespace-nowrap">Surface tr.</th>
              <th className="text-right py-2 px-2 font-semibold whitespace-nowrap">Dose appl.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-700/50">
                <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300 whitespace-nowrap text-[11px]">
                  {fmtDate(row.date)}
                </td>
                <td className="py-1.5 px-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{row.prod.nom}</span>
                    {row.prod.type && (
                      <span className={`text-[9px] px-1 py-0.5 rounded-full whitespace-nowrap ${TYPE_COLOR[row.prod.type] || TYPE_COLOR.autre}`}>
                        {row.prod.type.slice(0, 4)}
                      </span>
                    )}
                  </div>
                  {row.parcelle && (
                    <div className="text-[10px] text-vigne-600 dark:text-vigne-400 truncate max-w-[160px] mt-0.5">📍 {row.parcelle}</div>
                  )}
                </td>
                <td className="py-1.5 px-1 text-gray-600 dark:text-gray-400 text-[11px] max-w-[100px]">
                  <div className="line-clamp-2">{row.prod.cible || '—'}</div>
                </td>
                <td className="py-1.5 px-1 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
                  {row.surface != null ? `${row.surface} ha` : '—'}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
                  {row.prod.dose_ha != null
                    ? `${row.prod.dose_ha} ${row.prod.unite || ''}/ha`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Vue par parcelle ─────────────────────────────────────────────────────────
function VueParcelleGroup({ nom, entries, allRapports, confirmDelete, setConfirmDelete, onDelete }) {
  const [open, setOpen] = useState(true)

  // Compute surface from linked parcelle or from quantite/dose_ha
  function getSurface(r, p) {
    if (p?.surface_ha) return `${p.surface_ha} ha`
    // Check if any product has dose_ha and quantite to derive surface
    const prod = r.produits.find(pr => pr.dose_ha > 0 && pr.quantite > 0)
    if (prod) return `${Math.round(prod.quantite / prod.dose_ha * 100) / 100} ha`
    return null
  }

  return (
    <div className="card">
      {/* Accordéon header */}
      <button
        className="flex items-center justify-between w-full gap-2 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-vigne-700 dark:text-vigne-400 text-sm truncate">📍 {nom}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {entries.length} traitement{entries.length > 1 ? 's' : ''}
          </p>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {entries.map(({ rapport: r, parcelle: p }, idx) => {
            const deleteKey = `${r.id}-${nom}`
            const surface = getSurface(r, p)

            return (
              <div key={`${r.id}-${idx}`} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                {/* Date + Programme + actions */}
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmtDate(r.date)}</p>
                    {r.notes && <span className="text-[10px] text-gray-400 dark:text-gray-500">{r.notes}</span>}
                    {r.source === 'pdf_carnet' && <span className="text-[9px] bg-vigne-50 dark:bg-vigne-900/20 text-vigne-600 dark:text-vigne-400 px-1 rounded">PDF</span>}
                    {surface && <span className="text-[10px] text-gray-500 dark:text-gray-400">{surface}</span>}
                  </div>
                  {confirmDelete === deleteKey ? (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => onDelete(r.id)} className="px-2 py-0.5 text-[10px] bg-red-600 text-white rounded">Suppr.</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 text-[10px] border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(deleteKey)} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Tableau produits */}
                {r.produits.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left py-1 px-2 font-medium">Produit</th>
                          <th className="text-left py-1 px-1 font-medium">Cible</th>
                          <th className="text-right py-1 px-1 font-medium whitespace-nowrap">Dose app.</th>
                          <th className="text-right py-1 px-1 font-medium whitespace-nowrap">Qté</th>
                          <th className="text-right py-1 px-2 font-medium">IFT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.produits.map((prod, j) => (
                          <tr key={j} className="border-t border-gray-100 dark:border-gray-700/50">
                            <td className="py-1 px-2">
                              <div className="flex items-center gap-1.5">
                                {prod.type && (
                                  <span className={`text-[9px] px-1 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${TYPE_COLOR[prod.type] || TYPE_COLOR.autre}`}>
                                    {prod.type === 'fongicide' ? 'Fong' : prod.type === 'insecticide' ? 'Insect' : prod.type === 'herbicide' ? 'Herb' : prod.type === 'biocontrole' ? 'Bio' : prod.type}
                                  </span>
                                )}
                                <span className="text-gray-800 dark:text-gray-200 font-medium">{prod.nom}</span>
                              </div>
                            </td>
                            <td className="py-1 px-1 text-gray-500 dark:text-gray-400 max-w-[80px] truncate">{prod.cible || '—'}</td>
                            <td className="py-1 px-1 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">{fmtDose(prod)}</td>
                            <td className="py-1 px-1 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {prod.quantite != null ? `${prod.quantite} ${prod.unite || ''}` : '—'}
                            </td>
                            <td className="py-1 px-2 text-right">
                              {prod.ift_value > 0
                                ? <span className="font-semibold text-gray-800 dark:text-gray-200">{prod.ift_value}</span>
                                : prod.dar
                                  ? <span className="text-amber-600 dark:text-amber-400">DAR {prod.dar}j</span>
                                  : <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PhytoPage() {
  const navigate = useNavigate()
  const [allRapports, setAllRapports] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [view, setView] = useState('parcelle') // 'ot' | 'parcelle' | 'produit'
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [prestataireFilter, setPrestataireFilter] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await api.get('/phyto/rapports')
      setAllRapports(data || [])
    } catch {}
    setLoading(false)
  }

  // Années disponibles + filtrage
  const anneesDispo = useMemo(() => {
    const s = new Set()
    for (const r of allRapports) {
      const y = r.date ? new Date(r.date).getFullYear() : null
      if (y) s.add(y)
    }
    return [...s].sort((a, b) => b - a)
  }, [allRapports])

  // Au chargement, sélectionne l'année la plus récente avec des données si l'année courante est vide
  useEffect(() => {
    if (anneesDispo.length > 0 && !anneesDispo.includes(annee)) {
      setAnnee(anneesDispo[0])
    }
  }, [anneesDispo])

  const rapports = useMemo(() => {
    return allRapports.filter(r => {
      const y = r.date ? new Date(r.date).getFullYear() : null
      return y === annee
    })
  }, [allRapports, annee])

  const hasPrev = anneesDispo.includes(annee - 1)
  const hasNext = anneesDispo.includes(annee + 1)

  // Liste des prestataires disponibles pour le filtre
  const prestatairesDispo = useMemo(() => {
    const s = new Set()
    for (const r of rapports) if (r.prestataire) s.add(r.prestataire)
    return [...s].sort()
  }, [rapports])

  async function deleteRapport(idOrIds) {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
    await Promise.all(ids.map(id => api.delete(`/phyto/rapports/${id}`)))
    setAllRapports(prev => prev.filter(r => !ids.includes(r.id)))
    setConfirmDelete(null)
  }

  async function deleteAllForYear() {
    setBulkDeleting(true)
    try {
      const ids = rapports.map(r => r.id)
      await Promise.all(ids.map(id => api.delete(`/phyto/rapports/${id}`)))
      setAllRapports(prev => prev.filter(r => !ids.includes(r.id)))
      setConfirmBulkDelete(false)
    } catch (e) {
      alert('Erreur suppression : ' + e.message)
    }
    setBulkDeleting(false)
  }

  // Groupement par OT (date + numéro OT extrait des notes)
  const byOT = useMemo(() => {
    if (view !== 'ot') return null
    const map = {}
    for (const r of rapports) {
      const otMatch = r.notes?.match(/OT\s+(\d+)/i)
      const otNum = otMatch ? otMatch[1] : 'sans-ot'
      const key = `${r.date}__${otNum}`
      if (!map[key]) map[key] = { date: r.date, ot: otNum, rapports: [] }
      map[key].rapports.push(r)
    }
    return Object.values(map).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [rapports, view])

  // Groupement par parcelle
  const byParcelle = useMemo(() => {
    if (view !== 'parcelle') return null
    const map = {}
    for (const r of rapports) {
      if (r.parcelles.length === 0) {
        const key = '__aucune__'
        if (!map[key]) map[key] = { nom: '(non liée)', entries: [] }
        map[key].entries.push({ rapport: r, parcelle: null })
      } else {
        for (const p of r.parcelles) {
          const key = p.parcelle_id || p.parcelle_nom_source || '?'
          const nom = p.parcelle_nom_app || p.parcelle_nom_source || '?'
          if (!map[key]) map[key] = { nom, entries: [] }
          map[key].entries.push({ rapport: r, parcelle: p })
        }
      }
    }
    return Object.entries(map)
      .sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr'))
      .map(([key, val]) => ({
        key,
        nom: val.nom,
        entries: val.entries.sort((a, b) => (a.rapport.date || '').localeCompare(b.rapport.date || '')),
      }))
  }, [rapports, view])

  return (
    <div>
      <PageHeader title="Registre phytosanitaire" />

      {/* Boutons d'action */}
      <div className="flex gap-2 px-4 pt-4">
        <button
          onClick={() => navigate('/phyto/import')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-vigne-700 text-white text-sm font-semibold active:bg-vigne-800"
        >
          <Upload size={15} /> Email
        </button>
        <button
          onClick={() => navigate('/phyto/carnet/import')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-vigne-600 text-white text-sm font-semibold active:bg-vigne-700"
        >
          <BookOpen size={15} /> Carnet PDF
        </button>
        <button
          onClick={() => navigate('/phyto/new')}
          className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium"
        >
          <Plus size={15} /> Manuel
        </button>
      </div>

      {/* Sélecteur d'année */}
      {!loading && anneesDispo.length > 0 && (
        <div className="flex items-center justify-center gap-3 px-4 pt-3">
          <button
            onClick={() => setAnnee(a => a - 1)}
            disabled={!hasPrev}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30"
          >
            <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 min-w-[60px] text-center">{annee}</span>
          <button
            onClick={() => setAnnee(a => a + 1)}
            disabled={!hasNext}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30"
          >
            <ChevronRight size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
          {rapports.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
              {rapports.length} traitement{rapports.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Toggle vue + bulk delete */}
      {!loading && rapports.length > 0 && (
        <div className="flex items-center gap-1 px-4 pt-3">
          <button
            onClick={() => setView('parcelle')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              view === 'parcelle'
                ? 'bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Layers size={13} /> Par parcelle
          </button>
          <button
            onClick={() => setView('ot')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              view === 'ot'
                ? 'bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <LayoutList size={13} /> Par OT
          </button>
          <button
            onClick={() => setView('produit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              view === 'produit'
                ? 'bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Package size={13} /> Par produit
          </button>
          <div className="flex-1" />
          {confirmBulkDelete ? (
            <div className="flex gap-1">
              <button
                onClick={deleteAllForYear}
                disabled={bulkDeleting}
                className="px-2.5 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {bulkDeleting ? '…' : `Confirmer (${rapports.length})`}
              </button>
              <button
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
                className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={13} /> Tout {annee}
            </button>
          )}
        </div>
      )}

      <div className="px-4 pt-3 space-y-3 pb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-32" />)
        ) : rapports.length === 0 ? (
          <div className="text-center py-16">
            <Leaf size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun traitement enregistré</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Importez un email ou un carnet de traitement PDF
            </p>
            <div className="flex gap-2 justify-center mt-6">
              <button
                onClick={() => navigate('/phyto/import')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-vigne-700 text-white text-sm font-semibold"
              >
                <Upload size={15} /> Email
              </button>
              <button
                onClick={() => navigate('/phyto/carnet/import')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-vigne-600 text-white text-sm font-semibold"
              >
                <BookOpen size={15} /> Carnet PDF
              </button>
            </div>
          </div>
        ) : view === 'parcelle' ? (
          byParcelle.map(group => (
            <VueParcelleGroup
              key={group.key}
              nom={group.nom}
              entries={group.entries}
              allRapports={rapports}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onDelete={deleteRapport}
            />
          ))
        ) : view === 'ot' ? (
          byOT.map(g => (
            <VueOTCard
              key={`${g.date}-${g.ot}`}
              ot={g.ot}
              rapports={g.rapports}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onDelete={deleteRapport}
            />
          ))
        ) : (
          <VueProduitTable
            rapports={rapports}
            prestataireFilter={prestataireFilter}
            setPrestataireFilter={setPrestataireFilter}
            prestatairesDispo={prestatairesDispo}
          />
        )}
      </div>
    </div>
  )
}
