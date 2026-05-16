import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Map, LogOut, ChevronRight, ChevronDown, Search, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { caToDisplay, caToDisplayHa } from '../../lib/surface'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'

const STATUT_BADGE = {
  en_production: null,
  replantee: { label: 'Replantée', cls: 'bg-amber-100 text-amber-700' },
  au_repos:  { label: 'Au repos',  cls: 'bg-gray-100 text-gray-500'  },
}

const COMMUNE_ORDER = ['Chouilly', 'Hautvillers']

function groupByCommune(parcelles) {
  const groups = {}
  for (const p of parcelles) {
    const key = p.commune || 'Autre'
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  const known = COMMUNE_ORDER.filter(c => groups[c])
  const other = Object.keys(groups).filter(c => !COMMUNE_ORDER.includes(c)).sort()
  return [...known, ...other].map(commune => ({ commune, parcelles: groups[commune] }))
}

function filterParcelles(parcelles, search) {
  if (!search.trim()) return parcelles
  const q = search.toLowerCase()
  return parcelles.filter(p =>
    p.nom.toLowerCase().includes(q) ||
    (p.commune || '').toLowerCase().includes(q) ||
    (p.reference_cadastrale || '').toLowerCase().includes(q) ||
    (Array.isArray(p.cepages) && p.cepages.some(c => c.toLowerCase().includes(q)))
  )
}

export default function ParcellesList() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [parcelles, setParcelles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(new Set())
  const refreshTick = useRefreshTrigger()

  useEffect(() => {
    api.get('/parcelles').then(data => {
      setParcelles(data || [])
      setLoading(false)
    })
  }, [refreshTick])

  function toggleCollapse(commune) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(commune) ? next.delete(commune) : next.add(commune)
      return next
    })
  }

  const filtered = filterParcelles(parcelles, search)
  const groups   = groupByCommune(filtered)
  const isSearch = search.trim().length > 0

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🍇 LF-Boyer</h1>
          <p className="text-vigne-200 text-xs mt-0.5">
            {user?.prenom ? `${user.prenom} ${user.nom}` : user?.email}
          </p>
        </div>
        <button onClick={signOut} className="p-2 rounded-full active:bg-vigne-600" title="Déconnexion">
          <LogOut size={20} />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative lg:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une parcelle…"
            className="input pl-9 pr-9 py-2.5 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-20" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Map size={48} className="mx-auto text-vigne-300 mb-4" />
            {parcelles.length === 0
              ? <><p className="text-gray-500 font-medium">Aucune parcelle pour l'instant</p>
                  <p className="text-gray-400 text-sm mt-1">Ajoutez votre première parcelle</p></>
              : <p className="text-gray-500 font-medium">Aucun résultat pour « {search} »</p>
            }
          </div>
        ) : (
          groups.map(({ commune, parcelles: list }) => {
            const isOpen = isSearch || !collapsed.has(commune)
            const totalSurface = list.reduce((s, p) => s + (p.surface_totale_ca || 0), 0)
            return (
              <div key={commune}>
                {/* Commune header — clickable to collapse */}
                <button
                  onClick={() => toggleCollapse(commune)}
                  className="w-full flex items-center justify-between px-1 mb-2 group"
                >
                  <h2 className="text-xs font-semibold text-vigne-700 uppercase tracking-wider">
                    {commune}
                    <span className="text-gray-400 font-normal normal-case ml-1.5">
                      ({list.length} parcelle{list.length > 1 ? 's' : ''} · {caToDisplayHa(totalSurface)})
                    </span>
                  </h2>
                  <ChevronDown
                    size={15}
                    className={`text-vigne-500 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                  />
                </button>

                {isOpen && (
                  <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                    {list.map(p => {
                      const badge = STATUT_BADGE[p.statut]
                      const cepagesDisplay = Array.isArray(p.cepages) && p.cepages.length > 0
                        ? p.cepages.join(' · ')
                        : null
                      return (
                        <button
                          key={p.id}
                          onClick={() => navigate(`/parcelles/${p.id}`)}
                          className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
                        >
                          {p.photo_url ? (
                            <img src={p.photo_url} alt={p.nom} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-vigne-100 flex items-center justify-center flex-shrink-0">
                              <Map size={24} className="text-vigne-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 leading-tight break-words">{p.nom}</p>
                              {badge && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5 font-medium">
                              {caToDisplay(p.surface_totale_ca)}
                            </p>
                            {cepagesDisplay && (
                              <p className="text-xs text-vigne-600 mt-0.5">{cepagesDisplay}</p>
                            )}
                            {p.reference_cadastrale && (
                              <p className="text-xs text-gray-400 mt-0.5">{p.reference_cadastrale}</p>
                            )}
                          </div>
                          <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <button
        onClick={() => navigate('/parcelles/new')}
        className="fab-offset fixed right-4 bg-vigne-700 text-white w-14 h-14 rounded-full
                   shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
