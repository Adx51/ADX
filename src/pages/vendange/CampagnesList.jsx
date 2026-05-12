import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Grape, ChevronRight, Lock } from 'lucide-react'
import { api } from '../../lib/api'

export default function CampagnesList() {
  const navigate = useNavigate()
  const [campagnes, setCampagnes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/campagnes').then(rows => {
      setCampagnes(rows || [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold">🍾 Vendanges</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="card skeleton h-24" />)
        ) : campagnes.length === 0 ? (
          <div className="text-center py-16">
            <Grape size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucune campagne enregistrée</p>
            <button onClick={() => navigate('/vendange/new')} className="mt-4 text-amber-600 font-medium">
              Créer la première campagne
            </button>
          </div>
        ) : (
          campagnes.map(c => (
            <button key={c.id} onClick={() => navigate(`/vendange/${c.annee}`)}
                    className="card w-full text-left active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                  c.statut === 'cloturee' ? 'bg-gray-100' : 'bg-amber-100'
                }`}>
                  <span className={`font-bold text-sm leading-none ${
                    c.statut === 'cloturee' ? 'text-gray-500' : 'text-amber-700'
                  }`}>{c.annee}</span>
                  {c.statut === 'cloturee' && <Lock size={10} className="text-gray-400 mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">
                    Campagne {c.annee}
                    {c.statut === 'cloturee' && <span className="text-xs text-gray-400 ml-2 font-normal">(clôturée)</span>}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {Number(c.poids_total || 0).toFixed(0)} kg · {c.caisses_total || 0} caisses · {c.nb_vendanges || 0} parcelle{c.nb_vendanges > 1 ? 's' : ''}
                  </p>
                  {c.rendement_attendu_kgha && (
                    <p className="text-xs text-vigne-600 mt-0.5">
                      Objectif : {Number(c.rendement_attendu_kgha).toLocaleString('fr-FR')} kg/ha
                    </p>
                  )}
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </div>
            </button>
          ))
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
