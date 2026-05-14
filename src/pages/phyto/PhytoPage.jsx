import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Leaf, Upload, Trash2, FileText, BookOpen, LayoutList, Layers } from 'lucide-react'
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

export default function PhytoPage() {
  const navigate = useNavigate()
  const [rapports, setRapports] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [view, setView] = useState('date') // 'date' | 'parcelle'

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await api.get('/phyto/rapports')
      setRapports(data || [])
    } catch {}
    setLoading(false)
  }

  async function deleteRapport(id) {
    await api.delete(`/phyto/rapports/${id}`)
    setRapports(prev => prev.filter(r => r.id !== id))
    setConfirmDelete(null)
  }

  // ── Vue "par parcelle" : regrouper les rapports par parcelle ──────────────
  const byParcelle = useMemo(() => {
    if (view !== 'parcelle') return null
    const map = {} // key → { nom, entries: [{rapport, parcelle}] }
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
    // Sort entries by date within each parcelle
    return Object.entries(map)
      .sort((a, b) => a[1].nom.localeCompare(b[1].nom))
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
      <div className="flex gap-2 px-4 pt-4 flex-wrap">
        <button
          onClick={() => navigate('/phyto/import')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-vigne-700 text-white text-sm font-semibold active:bg-vigne-800"
        >
          <Upload size={16} />
          Email
        </button>
        <button
          onClick={() => navigate('/phyto/carnet/import')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-vigne-600 text-white text-sm font-semibold active:bg-vigne-700"
        >
          <BookOpen size={16} />
          Carnet PDF
        </button>
        <button
          onClick={() => navigate('/phyto/new')}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium active:bg-gray-50 dark:active:bg-gray-800"
        >
          <Plus size={16} />
          Manuel
        </button>
        <button
          onClick={() => navigate('/phyto/recaps')}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium active:bg-gray-50 dark:active:bg-gray-800"
        >
          <FileText size={16} />
          IFT
        </button>
      </div>

      {/* Toggle vue */}
      {!loading && rapports.length > 0 && (
        <div className="flex gap-1 px-4 pt-3">
          <button
            onClick={() => setView('date')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              view === 'date'
                ? 'bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <LayoutList size={13} /> Par date
          </button>
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
        </div>
      )}

      <div className="px-4 pt-3 space-y-3 pb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-24" />)
        ) : rapports.length === 0 ? (
          <div className="text-center py-16">
            <Leaf size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun rapport</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Importez un email ou un carnet PDF pour commencer</p>
          </div>
        ) : view === 'parcelle' ? (
          /* ── Vue par parcelle ─────────────────────────────────────────────── */
          byParcelle.map(group => (
            <div key={group.key} className="card space-y-3">
              <p className="font-semibold text-sm text-vigne-700 dark:text-vigne-400">📍 {group.nom}</p>
              <div className="space-y-2">
                {group.entries.map(({ rapport: r, parcelle: p }, idx) => {
                  const dateStr = r.date
                    ? format(parseISO(r.date), 'd MMM yyyy', { locale: fr })
                    : '—'
                  return (
                    <div key={`${r.id}-${idx}`} className="border border-gray-100 dark:border-gray-700 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{dateStr}</p>
                        <div className="flex items-center gap-2">
                          {r.source === 'pdf_carnet' && (
                            <span className="text-[10px] bg-vigne-50 dark:bg-vigne-900/20 text-vigne-600 dark:text-vigne-400 px-1.5 py-0.5 rounded-full">PDF</span>
                          )}
                          {r.prestataire && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[80px]">{r.prestataire}</span>
                          )}
                          {confirmDelete === `${r.id}-${idx}` ? (
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => deleteRapport(r.id)}
                                className="px-2 py-0.5 text-[10px] bg-red-600 text-white rounded-lg"
                              >Suppr.</button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-2 py-0.5 text-[10px] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400"
                              >Annuler</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(`${r.id}-${idx}`)}
                              className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 flex-shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      {r.produits.length > 0 && (
                        <table className="w-full text-[11px]">
                          <tbody>
                            {r.produits.map((prod, j) => (
                              <tr key={j} className={j > 0 ? 'border-t border-gray-100 dark:border-gray-700/50' : ''}>
                                <td className="py-0.5 pr-1 text-gray-700 dark:text-gray-300 max-w-[110px] truncate">{prod.nom}</td>
                                <td className="py-0.5 pr-1">
                                  {prod.type && (
                                    <span className={`px-1 py-0.5 rounded-full text-[9px] ${TYPE_COLOR[prod.type] || TYPE_COLOR.autre}`}>
                                      {prod.type}
                                    </span>
                                  )}
                                </td>
                                <td className="py-0.5 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  {prod.quantite ? `${prod.quantite} ${prod.unite || ''}` : prod.dose || ''}
                                </td>
                                <td className="py-0.5 text-right text-gray-600 dark:text-gray-300 font-medium pl-1">
                                  {prod.ift_value > 0 ? prod.ift_value : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          /* ── Vue par date (défaut) ────────────────────────────────────────── */
          rapports.map(r => {
            const dateStr = r.date
              ? format(parseISO(r.date), 'd MMMM yyyy', { locale: fr })
              : '—'
            const parcelleNames = r.parcelles
              .map(p => p.parcelle_nom_app || p.parcelle_nom_source || '?')
              .join(', ')
            const produitNames = r.produits.map(p => p.nom).join(', ')

            return (
              <div key={r.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{dateStr}</p>
                      {r.source === 'pdf_carnet' && (
                        <span className="text-[10px] bg-vigne-50 dark:bg-vigne-900/20 text-vigne-600 dark:text-vigne-400 px-1.5 py-0.5 rounded-full flex-shrink-0">PDF</span>
                      )}
                      {r.prestataire && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.prestataire}</span>
                      )}
                    </div>
                    {parcelleNames && (
                      <p className="text-xs text-vigne-600 dark:text-vigne-400 font-medium truncate">
                        📍 {parcelleNames}
                      </p>
                    )}
                    {produitNames && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        🧪 {produitNames}
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {r.produits.map((p, i) => p.dar && (
                        <span key={i} className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          {p.nom} DAR {p.dar}j
                        </span>
                      ))}
                    </div>
                  </div>

                  {confirmDelete === r.id ? (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => deleteRapport(r.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg"
                      >Suppr.</button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400"
                      >Annuler</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(r.id)}
                      className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
