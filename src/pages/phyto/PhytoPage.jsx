import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Leaf, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import PageHeader from '../../components/PageHeader'

const TYPE_STYLE = {
  fongicide:   { label: 'Fongicide',   color: 'bg-blue-100 text-blue-700' },
  insecticide: { label: 'Insecticide', color: 'bg-red-100 text-red-700' },
  herbicide:   { label: 'Herbicide',   color: 'bg-orange-100 text-orange-700' },
  biocontrole: { label: 'Biocontrôle', color: 'bg-vigne-100 text-vigne-700' },
  autre:       { label: 'Autre',       color: 'bg-gray-100 text-gray-600' },
}

const FILTRES = [
  { key: 'all',         label: 'Tout' },
  { key: 'fongicide',   label: 'Fongicide' },
  { key: 'insecticide', label: 'Insecticide' },
  { key: 'herbicide',   label: 'Herbicide' },
  { key: 'biocontrole', label: 'Biocontrôle' },
  { key: 'autre',       label: 'Autre' },
]

export default function PhytoPage() {
  const navigate = useNavigate()
  const [traitements, setTraitements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('all')

  useEffect(() => {
    api.get('/traitements')
      .then(data => { setTraitements(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filtre === 'all'
    ? traitements
    : traitements.filter(t => t.type === filtre)

  return (
    <div>
      <PageHeader title="Registre phytosanitaire" />

      {/* Filtres */}
      <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto">
        {FILTRES.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filtre === f.key
                ? 'bg-vigne-700 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="px-4 space-y-3 pt-2 pb-24">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card skeleton h-20" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Leaf size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucun traitement</p>
            <p className="text-sm text-gray-400 mt-1">
              {filtre === 'all' ? 'Commencez par ajouter un traitement.' : 'Aucun traitement de ce type.'}
            </p>
          </div>
        ) : (
          filtered.map(t => {
            const typeInfo = TYPE_STYLE[t.type] || TYPE_STYLE.autre
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/phyto/${t.id}/edit`)}
                className="card w-full text-left active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start gap-3">
                  {/* Icône type */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                    <Leaf size={18} />
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      {t.dar > 0 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          DAR : {t.dar}j
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-gray-900 mt-1 truncate">{t.produit}</p>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">
                        {format(parseISO(t.date), 'd MMM yyyy', { locale: fr })}
                      </span>
                      {t.dose && (
                        <span className="text-xs text-gray-500">{t.dose}</span>
                      )}
                      {t.operateur && (
                        <span className="text-xs text-gray-400">{t.operateur}</span>
                      )}
                    </div>

                    {t.parcelle_nom && (
                      <p className="text-xs text-vigne-600 font-medium mt-0.5">{t.parcelle_nom}</p>
                    )}

                    {t.conditions && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{t.conditions}</p>
                    )}
                  </div>

                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/phyto/new')}
        className="fixed right-4 bg-vigne-700 text-white w-14 h-14 rounded-full
                   shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
