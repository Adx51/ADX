import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Map, LogOut, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { caToDisplay } from '../../lib/surface'

export default function ParcellesList() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [parcelles, setParcelles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('parcelles')
        .select('*')
        .order('nom')
      setParcelles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🍇 Mes Parcelles</h1>
          <p className="text-vigne-200 text-xs mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="p-2 rounded-full active:bg-vigne-600"
          title="Déconnexion"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card skeleton h-20" />
          ))
        ) : parcelles.length === 0 ? (
          <div className="text-center py-16">
            <Map size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucune parcelle pour l'instant</p>
            <p className="text-gray-400 text-sm mt-1">Ajoutez votre première parcelle</p>
          </div>
        ) : (
          parcelles.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/parcelles/${p.id}`)}
              className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
            >
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.nom}
                     className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-vigne-100 flex items-center justify-center flex-shrink-0">
                  <Map size={24} className="text-vigne-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.nom}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {caToDisplay(p.surface_plantee_ca)}
                  {p.cepage && <span className="text-vigne-600"> · {p.cepage}</span>}
                </p>
                {p.nombre_routes && (
                  <p className="text-xs text-gray-400">{p.nombre_routes} route{p.nombre_routes > 1 ? 's' : ''}</p>
                )}
              </div>
              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/parcelles/new')}
        className="fixed bottom-24 right-4 bg-vigne-700 text-white w-14 h-14 rounded-full
                   shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
