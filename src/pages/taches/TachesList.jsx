import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckSquare, Clock, AlertCircle, Check } from 'lucide-react'
import { api } from '../../lib/api'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import PhotoModal from '../../components/PhotoModal'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'

const STATUTS = {
  a_faire:  { label: 'À faire',  color: 'bg-gray-100 text-gray-600',   icon: Clock },
  en_cours: { label: 'En cours', color: 'bg-blue-100 text-blue-700',   icon: AlertCircle },
  termine:  { label: 'Terminée', color: 'bg-vigne-100 text-vigne-700', icon: Check },
}

export default function TachesList() {
  const navigate = useNavigate()
  const [taches, setTaches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('a_faire')
  const [photoUrl, setPhotoUrl] = useState(null)
  const refreshTick = useRefreshTrigger()

  useEffect(() => { load() }, [refreshTick])

  async function load() {
    const data = await api.get('/taches')
    setTaches(data || [])
    setLoading(false)
  }

  async function toggleStatut(tache) {
    const next = tache.statut === 'a_faire' ? 'en_cours'
               : tache.statut === 'en_cours' ? 'termine' : 'a_faire'
    await api.put(`/taches/${tache.id}`, { ...tache, statut: next })
    setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: next } : t))
  }

  const filtered = filtre === 'all' ? taches : taches.filter(t => t.statut === filtre)

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold">Tâches</h1>
      </div>

      <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto">
        {[
          { key: 'a_faire',  label: 'À faire'   },
          { key: 'en_cours', label: 'En cours'  },
          { key: 'termine',  label: 'Terminées' },
          { key: 'all',      label: 'Tout'      },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filtre === f.key ? 'bg-vigne-700 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3 pt-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-20" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <CheckSquare size={48} className="mx-auto text-vigne-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucune tâche</p>
          </div>
        ) : (
          filtered.map(t => {
            const statut = STATUTS[t.statut]
            const Icon = statut.icon
            return (
              <div key={t.id} className="card flex gap-3">
                <button
                  onClick={() => toggleStatut(t)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${statut.color}`}
                >
                  <Icon size={18} />
                </button>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/taches/${t.id}/edit`)}>
                  <p className={`font-semibold ${t.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {t.titre}
                  </p>
                  {t.parcelles && <p className="text-xs text-vigne-600 mt-0.5">{t.parcelles.nom}</p>}
                  {t.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>}
                  {t.date_echeance && (
                    <p className="text-xs text-gray-400 mt-1">
                      📅 {format(parseISO(t.date_echeance), 'd MMM yyyy', { locale: fr })}
                    </p>
                  )}
                </div>

                {t.photo_url && (
                  <img
                    src={t.photo_url}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 cursor-pointer active:opacity-80"
                    onClick={(e) => { e.stopPropagation(); setPhotoUrl(t.photo_url) }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      <button
        onClick={() => navigate('/taches/new')}
        className="fab-offset fixed right-4 bg-vigne-700 text-white w-14 h-14 rounded-full
                   shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={28} />
      </button>

      <PhotoModal url={photoUrl} onClose={() => setPhotoUrl(null)} />
    </div>
  )
}
