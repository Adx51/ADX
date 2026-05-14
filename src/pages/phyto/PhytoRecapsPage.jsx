import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Download, Trash2, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/PageHeader'

const CURRENT_YEAR = new Date().getFullYear()

export default function PhytoRecapsPage() {
  const navigate = useNavigate()
  const [annee, setAnnee] = useState(CURRENT_YEAR)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { load() }, [annee])

  async function load() {
    setLoading(true)
    try {
      const d = await api.get(`/phyto/recaps/${annee}`)
      setData(d)
    } catch { setData(null) }
    setLoading(false)
  }

  async function deleteRecap(id) {
    await api.delete(`/phyto/recaps/${id}`)
    setData(prev => ({ ...prev, recaps: prev.recaps.filter(r => r.id !== id) }))
    setConfirmDelete(null)
  }

  function downloadCSV() {
    const token = localStorage.getItem('adx_token')
    const a = document.createElement('a')
    a.href = `/api/phyto/recaps/${annee}/export.csv`
    a.setAttribute('download', `IFT-${annee}.csv`)
    // Add auth header via fetch
    fetch(a.href, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        a.href = url
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
  }

  const hasPrev = data?.annees_disponibles?.includes(annee - 1) || false
  const hasNext = data?.annees_disponibles?.includes(annee + 1) || false

  return (
    <div>
      <PageHeader title="Récaps IFT annuels" back="/phyto" />

      {/* Sélecteur d'année */}
      <div className="flex items-center justify-center gap-4 px-4 pt-4 pb-2">
        <button onClick={() => setAnnee(a => a - 1)} disabled={!hasPrev} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30">
          <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-16 text-center">{annee}</span>
        <button onClick={() => setAnnee(a => a + 1)} disabled={!hasNext} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30">
          <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pt-2 pb-3">
        <button onClick={() => navigate('/phyto/recaps/import')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-vigne-700 text-white text-sm font-semibold active:bg-vigne-800">
          <FileUp size={15} /> Importer un PDF
        </button>
        {data?.recaps?.length > 0 && (
          <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
            <Download size={15} /> Export CSV
          </button>
        )}
      </div>

      <div className="px-4 pb-8 space-y-3">
        {loading ? (
          [1,2].map(i => <div key={i} className="card skeleton h-24" />)
        ) : !data?.recaps?.length ? (
          <div className="text-center py-16">
            <BarChart2 size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun récap pour {annee}</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Importez le PDF récapitulatif du prestataire</p>
            {data?.annees_disponibles?.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {data.annees_disponibles.map(a => (
                  <button key={a} onClick={() => setAnnee(a)} className="px-3 py-1.5 rounded-xl bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400 text-sm font-medium">{a}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          data.recaps.map(r => (
            <div key={r.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{r.prestataire || 'Récap ' + r.annee}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{r.parcelles.length} parcelle{r.parcelles.length > 1 ? 's' : ''}</p>
                </div>
                {confirmDelete === r.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => deleteRecap(r.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg">Suppr.</button>
                    <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400">Annuler</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(r.id)} className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {/* Parcelles table */}
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-300">
                      <th className="text-left py-1 px-1 font-medium">Parcelle</th>
                      <th className="text-right py-1 px-1 font-medium">Herb</th>
                      <th className="text-right py-1 px-1 font-medium">Fong</th>
                      <th className="text-right py-1 px-1 font-medium">Insect</th>
                      <th className="text-right py-1 px-1 font-medium">Bio</th>
                      <th className="text-right py-1 px-1 font-medium font-bold">Total</th>
                      <th className="text-right py-1 px-1 font-medium">Cu kg/ha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.parcelles.map((p, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-1.5 px-1 text-gray-800 dark:text-gray-200 max-w-[120px] truncate">{p.parcelle_nom_app || p.parcelle_nom_source}</td>
                        <td className="py-1.5 px-1 text-right text-gray-600 dark:text-gray-300">{p.ift_herbicide || '—'}</td>
                        <td className="py-1.5 px-1 text-right text-gray-600 dark:text-gray-300">{p.ift_fongicide || '—'}</td>
                        <td className="py-1.5 px-1 text-right text-gray-600 dark:text-gray-300">{p.ift_insecticide || '—'}</td>
                        <td className="py-1.5 px-1 text-right text-gray-600 dark:text-gray-300">{p.ift_biocontrole || '—'}</td>
                        <td className="py-1.5 px-1 text-right font-semibold text-gray-900 dark:text-gray-100">{p.ift_total}</td>
                        <td className="py-1.5 px-1 text-right text-amber-600 dark:text-amber-400">{p.cuivre_kg_ha ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
