import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Grape, ChevronRight, Lock, BarChart2 } from 'lucide-react'
import { api } from '../../lib/api'

function CardStats({ c }) {
  const isClosed = c.statut === 'cloturee'

  // Kg récoltés : snapshot si clôturée, live sinon
  const kgRecolt = isClosed && c.poids_total_cloture != null
    ? c.poids_total_cloture
    : (c.poids_total || 0)

  // Kg attendus sur TOUTES les parcelles : snapshot si clôturée, calculé sinon
  const kgAttendu = isClosed && c.kg_attendu_cloture != null
    ? c.kg_attendu_cloture
    : (c.rendement_attendu_kgha && c.surface_all_ca
        ? Math.round(c.rendement_attendu_kgha * c.surface_all_ca / 10000)
        : null)

  // Rendement moyen réel sur les parcelles ayant une vendange
  const kgHaMoyen = c.surface_vendanges_ca > 0
    ? Math.round(kgRecolt / (c.surface_vendanges_ca / 10000))
    : null

  const pct = kgAttendu > 0 ? Math.min(Math.round(kgRecolt / kgAttendu * 100), 100) : null

  return (
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-gray-900">
        Vendanges {c.annee}
        {isClosed && <span className="text-xs text-gray-400 ml-2 font-normal">(clôturée)</span>}
      </p>
      <p className="text-sm text-gray-600 mt-0.5">
        {Number(kgRecolt).toLocaleString('fr-FR')} kg
        {kgHaMoyen ? <> · <span className="text-vigne-700 font-medium">{kgHaMoyen.toLocaleString('fr-FR')} kg/ha</span></> : null}
        {' · '}{c.nb_vendanges || 0} parcelle{c.nb_vendanges > 1 ? 's' : ''}
      </p>

      {kgAttendu > 0 && (
        <div className="mt-1.5 space-y-0.5">
          <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">
            {pct}% · {Number(kgAttendu).toLocaleString('fr-FR')} kg attendus
          </p>
        </div>
      )}
    </div>
  )
}

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
      <div className="page-header flex items-center justify-between">
        <h1 className="text-xl font-bold">🍾 Vendanges</h1>
        <button onClick={() => navigate('/vendange/stats')}
                className="p-2 rounded-full active:bg-vigne-600" title="Statistiques">
          <BarChart2 size={20} />
        </button>
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
                <CardStats c={c} />
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
