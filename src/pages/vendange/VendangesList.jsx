import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Grape, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { rendementKgHa } from '../../lib/surface'

export default function VendangesList() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [annees, setAnnees] = useState([])
  const [anneeFiltre, setAnneeFiltre] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('vendanges')
        .select('*, parcelles(nom, surface_plantee_ca)')
        .order('annee', { ascending: false })

      if (rows) {
        const uniqueYears = [...new Set(rows.map(r => r.annee))].sort((a, b) => b - a)
        setAnnees(uniqueYears)
        setAnneeFiltre(uniqueYears[0] || null)
        setData(rows)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = anneeFiltre ? data.filter(v => v.annee === anneeFiltre) : data
  const totalPoids = filtered.reduce((s, v) => s + (v.poids_total || 0), 0)
  const totalCaisses = filtered.reduce((s, v) => s + (v.nb_caisses_total || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold">🍾 Vendanges</h1>
      </div>

      {/* Sélecteur d'année */}
      {annees.length > 0 && (
        <div className="flex gap-2 px-4 pt-4 overflow-x-auto pb-2">
          {annees.map(a => (
            <button
              key={a}
              onClick={() => setAnneeFiltre(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                anneeFiltre === a
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Totaux */}
      {anneeFiltre && filtered.length > 0 && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs text-amber-700 font-medium mb-2">Total {anneeFiltre}</p>
          <div className="flex gap-4">
            <div>
              <p className="text-2xl font-bold text-amber-800">{totalPoids.toFixed(0)} kg</p>
              <p className="text-xs text-amber-600">poids total</p>
            </div>
            <div className="w-px bg-amber-200" />
            <div>
              <p className="text-2xl font-bold text-amber-800">{totalCaisses}</p>
              <p className="text-xs text-amber-600">caisses</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 mt-3 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-20" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Grape size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucune vendange enregistrée</p>
            <p className="text-gray-400 text-sm mt-1">Ajoutez votre première vendange</p>
          </div>
        ) : (
          filtered.map(v => {
            const rendement = rendementKgHa(v.poids_total, v.parcelles?.surface_plantee_ca)
            return (
              <button
                key={v.id}
                onClick={() => navigate(`/vendange/${v.id}`)}
                className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-amber-700 text-sm">{v.annee}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{v.parcelles?.nom}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {(v.poids_total || 0).toFixed(0)} kg · {v.nb_caisses_total || 0} caisses
                  </p>
                  {rendement && (
                    <p className="text-xs text-vigne-600 font-medium">
                      {rendement.toLocaleString('fr-FR')} kg/ha
                    </p>
                  )}
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </button>
            )
          })
        )}
      </div>

      <button
        onClick={() => navigate('/vendange/new')}
        className="fixed right-4 bg-amber-500 text-white w-14 h-14 rounded-full
                   shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
