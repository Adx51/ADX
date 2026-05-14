import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays, Leaf, FlaskConical, BarChart2 } from 'lucide-react'
import { api } from '../../lib/api'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import PageHeader from '../../components/PageHeader'

const CURRENT_YEAR = new Date().getFullYear()

const TYPE_COLOR = {
  fongicide:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  insecticide: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  herbicide:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  biocontrole: 'bg-vigne-100 text-vigne-700 dark:bg-vigne-900/30 dark:text-vigne-400',
  autre:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

export default function PhytoSaisonPage() {
  const navigate = useNavigate()
  const { annee: anneeParam } = useParams()
  const [annee, setAnnee] = useState(parseInt(anneeParam) || CURRENT_YEAR)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('chrono') // chrono | produits | parcelles

  useEffect(() => {
    setLoading(true)
    setData(null)
    api.get(`/phyto/saison/${annee}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [annee])

  const prevYear = () => setAnnee(a => a - 1)
  const nextYear = () => setAnnee(a => a + 1)
  const hasNext = data?.annees_disponibles?.includes(annee + 1) || false
  const hasPrev = data?.annees_disponibles?.includes(annee - 1) || false

  return (
    <div>
      <PageHeader title="Récap saison" back="/phyto" />

      {/* Sélecteur d'année */}
      <div className="flex items-center justify-center gap-4 px-4 pt-4 pb-2">
        <button
          onClick={prevYear}
          disabled={!hasPrev && !loading}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30"
        >
          <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-16 text-center">{annee}</span>
        <button
          onClick={nextYear}
          disabled={!hasNext && !loading}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30"
        >
          <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {loading ? (
        <div className="px-4 space-y-3 pt-2">
          {[1,2,3].map(i => <div key={i} className="card skeleton h-20" />)}
        </div>
      ) : !data || data.rapports.length === 0 ? (
        <div className="text-center py-16 px-4">
          <CalendarDays size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun rapport pour {annee}</p>
          {data?.annees_disponibles?.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {data.annees_disponibles.map(a => (
                <button
                  key={a}
                  onClick={() => setAnnee(a)}
                  className="px-3 py-1.5 rounded-xl bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400 text-sm font-medium"
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 px-4 pt-2 pb-3">
            <div className="card text-center py-3 space-y-0.5">
              <p className="text-2xl font-bold text-vigne-700 dark:text-vigne-400">{data.rapports.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">traitement{data.rapports.length > 1 ? 's' : ''}</p>
            </div>
            <div className="card text-center py-3 space-y-0.5">
              <p className="text-2xl font-bold text-vigne-700 dark:text-vigne-400">{data.parcelles_saison.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">parcelle{data.parcelles_saison.length > 1 ? 's' : ''}</p>
            </div>
            <div className="card text-center py-3 space-y-0.5">
              <p className="text-2xl font-bold text-vigne-700 dark:text-vigne-400">{data.produits_saison.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">produit{data.produits_saison.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 mb-3">
            {[
              { key: 'chrono', label: 'Chronologie', icon: CalendarDays },
              { key: 'produits', label: 'Produits', icon: FlaskConical },
              { key: 'parcelles', label: 'Parcelles', icon: Leaf },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                  tab === key
                    ? 'bg-vigne-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          <div className="px-4 pb-8 space-y-3">

            {/* TAB: Chronologie */}
            {tab === 'chrono' && data.rapports.map(r => {
              const dateStr = r.date
                ? format(parseISO(r.date), 'd MMMM yyyy', { locale: fr })
                : '—'
              const parcelleNames = r.parcelles
                .map(p => p.parcelle_nom_app || p.parcelle_nom_source || '?')
                .join(', ')
              return (
                <div key={r.id} className="card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{dateStr}</p>
                    {r.prestataire && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.prestataire}</span>
                    )}
                  </div>
                  {parcelleNames && (
                    <p className="text-xs text-vigne-600 dark:text-vigne-400 font-medium">📍 {parcelleNames}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {r.produits.map((p, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full"
                      >
                        {p.nom}
                        {p.dar ? <span className="ml-1 text-amber-600 dark:text-amber-400">DAR {p.dar}j</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* TAB: Produits */}
            {tab === 'produits' && data.produits_saison.map((p, i) => (
              <div key={i} className="card flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-vigne-50 dark:bg-vigne-900/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-vigne-700 dark:text-vigne-400">{p.occurrences}×</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{p.nom}</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {p.cible && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{p.cible}</span>
                    )}
                    {p.dar && (
                      <span className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                        DAR {p.dar}j
                      </span>
                    )}
                    {p.znt && (
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                        ZNT {p.znt}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* TAB: Parcelles */}
            {tab === 'parcelles' && data.parcelles_saison.map((nom, i) => {
              const traitements = data.rapports.filter(r =>
                r.parcelles.some(p => (p.parcelle_nom_app || p.parcelle_nom_source || '?') === nom)
              )
              return (
                <div key={i} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">📍 {nom}</p>
                    <span className="text-xs bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400 px-2 py-0.5 rounded-full">
                      {traitements.length} traitement{traitements.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {traitements.map(r => (
                      <span
                        key={r.id}
                        className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full"
                      >
                        {r.date ? format(parseISO(r.date), 'd MMM', { locale: fr }) : '—'}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}

          </div>
        </>
      )}
    </div>
  )
}
