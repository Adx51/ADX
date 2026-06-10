import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckSquare, CalendarDays } from 'lucide-react'
import { api } from '../../lib/api'
import { format, parseISO, isPast, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import PhotoModal from '../../components/PhotoModal'
import TachesSemaines from '../../components/TachesSemaines'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'
import { getSaisonCourante, tacheSaison, getISOWeek } from '../../lib/saison'
import { STATUT_TACHE, PRIORITE_DOT } from '../../lib/taches'

// Pastilles parcelles inline dans une tâche
function ParcellePills({ t }) {
  const ps = t.parcelles || []
  if (t.commune && ps.length === 0) {
    return (
      <span className="inline-flex items-center text-xs bg-vigne-50 dark:bg-vigne-900/20 text-vigne-700 dark:text-vigne-400 px-1.5 py-0.5 rounded font-medium">
        📍 {t.commune} · commune
      </span>
    )
  }
  if (ps.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {ps.map(p => (
        <span key={p.id}
          className="text-xs bg-vigne-50 dark:bg-vigne-900/20 text-vigne-700 dark:text-vigne-400 px-1.5 py-0.5 rounded font-medium">
          {p.nom}
        </span>
      ))}
    </div>
  )
}

function TacheCard({ t, onToggle, onPhoto, navigate }) {
  const statut = STATUT_TACHE[t.statut] || STATUT_TACHE.a_faire
  const Icon = statut.Icon
  const refDate = t.date_debut || t.date_fin
  const finDate = t.date_fin || t.date_echeance
  const overdue = t.statut !== 'termine' && finDate && isPast(parseISO(finDate)) && !isToday(parseISO(finDate))
  const dueToday = t.statut !== 'termine' && finDate && isToday(parseISO(finDate))
  const week = getISOWeek(refDate)
  const hasRange = t.date_debut && t.date_fin && t.date_debut !== t.date_fin

  return (
    <div className="card flex gap-3">
      <button
        onClick={() => onToggle(t)}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${statut.badge}`}
      >
        <Icon size={18} />
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/taches/${t.id}/edit`)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {PRIORITE_DOT[t.priorite] && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITE_DOT[t.priorite]}`} />
            )}
            <p className={`font-semibold leading-tight ${t.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {t.titre}
            </p>
          </div>
          {week && (
            <span className="text-xs font-bold text-vigne-600 dark:text-vigne-400 bg-vigne-50 dark:bg-vigne-900/20 px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">
              S.{week}
            </span>
          )}
        </div>
        <ParcellePills t={t} />
        {t.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>}
        {refDate && (
          <p className={`text-xs mt-1 ${overdue ? 'text-red-500 font-medium' : dueToday ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
            {hasRange
              ? `${format(parseISO(t.date_debut), 'd MMM', { locale: fr })} → ${format(parseISO(t.date_fin), 'd MMM', { locale: fr })}`
              : format(parseISO(refDate), 'd MMM yyyy', { locale: fr })
            }
            {overdue && ' · En retard'}
            {dueToday && " · Aujourd'hui"}
          </p>
        )}
      </div>
      {t.photo_url && (
        <img
          src={t.photo_url}
          alt=""
          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 cursor-pointer active:opacity-80"
          onClick={e => { e.stopPropagation(); onPhoto(t.photo_url) }}
        />
      )}
    </div>
  )
}

export default function TachesList() {
  const navigate = useNavigate()
  const [taches, setTaches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('a_faire')
  const [vue, setVue] = useState('liste') // 'liste' | 'semaine'
  const [photoUrl, setPhotoUrl] = useState(null)
  const [saison, setSaison] = useState(() => getSaisonCourante())
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
    const prevStatut = tache.statut
    setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: next } : t))
    try {
      await api.put(`/taches/${tache.id}/statut`, { statut: next })
    } catch (e) {
      if (!e?.offline) {
        setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: prevStatut } : t))
      }
    }
  }

  const saisons = [...new Set(taches.map(tacheSaison).filter(Boolean))].sort((a, b) => b - a)
  const tachesSaison = saison !== null ? taches.filter(t => tacheSaison(t) === saison) : taches
  const filtered = filtre === 'all' ? tachesSaison : tachesSaison.filter(t => t.statut === filtre)

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold">Tâches</h1>
      </div>

      {/* Sélecteur de saison */}
      {!loading && saisons.length > 0 && (
        <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {saisons.map(s => (
            <button key={s} onClick={() => setSaison(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                saison === s ? 'bg-vigne-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}>
              Saison {s}
            </button>
          ))}
          <button onClick={() => setSaison(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              saison === null ? 'bg-vigne-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
            }`}>
            Toutes
          </button>
        </div>
      )}

      {/* Toggle de vue */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 px-4 pt-2 gap-1">
        <button onClick={() => setVue('liste')}
          className={`flex-1 py-2 rounded-t-xl text-sm font-medium transition-colors ${
            vue === 'liste' ? 'bg-vigne-700 text-white' : 'text-gray-500 dark:text-gray-400'
          }`}>
          Liste
        </button>
        <button onClick={() => setVue('semaine')}
          className={`flex-1 py-2 rounded-t-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            vue === 'semaine' ? 'bg-vigne-700 text-white' : 'text-gray-500 dark:text-gray-400'
          }`}>
          <CalendarDays size={14} /> Par semaine
        </button>
      </div>

      {/* Filtres statut (vue liste seulement) */}
      {vue === 'liste' && (
        <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { key: 'a_faire',  label: 'À faire'   },
            { key: 'en_cours', label: 'En cours'  },
            { key: 'termine',  label: 'Terminées' },
            { key: 'all',      label: 'Tout'      },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltre(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filtre === f.key ? 'bg-vigne-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="px-4 pt-2 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-20" />)}
        </div>
      ) : vue === 'semaine' ? (
        <div className="px-4 pt-2 pb-8">
          <TachesSemaines
            taches={tachesSaison}
            onToggle={toggleStatut}
            onOpen={t => navigate(`/taches/${t.id}/edit`)}
          />
        </div>
      ) : (
        <div className="px-4 space-y-3 pt-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare size={48} className="mx-auto text-vigne-300 mb-4" />
              <p className="text-gray-500 font-medium">Aucune tâche</p>
              {filtre === 'a_faire' && saison === getSaisonCourante() && (
                <button onClick={() => navigate('/taches/new')} className="mt-4 text-vigne-600 font-medium text-sm">
                  + Créer une tâche
                </button>
              )}
            </div>
          ) : (
            filtered.map(t => (
              <TacheCard key={t.id} t={t} onToggle={toggleStatut} onPhoto={setPhotoUrl} navigate={navigate} />
            ))
          )}
        </div>
      )}

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
