import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Leaf, Upload, Trash2, FileText } from 'lucide-react'
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

  return (
    <div>
      <PageHeader title="Registre phytosanitaire" />

      {/* Boutons d'action */}
      <div className="flex gap-2 px-4 pt-4">
        <button
          onClick={() => navigate('/phyto/import')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-vigne-700 text-white text-sm font-semibold active:bg-vigne-800"
        >
          <Upload size={16} />
          Importer un email
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

      <div className="px-4 pt-4 space-y-3 pb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-24" />)
        ) : rapports.length === 0 ? (
          <div className="text-center py-16">
            <Leaf size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun rapport</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Importez un email de traitement pour commencer</p>
          </div>
        ) : (
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
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 flex-shrink-0"
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
