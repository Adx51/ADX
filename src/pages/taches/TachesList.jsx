import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckSquare, Clock, AlertCircle, Check, Layers } from 'lucide-react'
import { api } from '../../lib/api'
import { format, parseISO, isPast, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import PhotoModal from '../../components/PhotoModal'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'
import { getSaisonCourante, tacheSaison } from '../../lib/saison'

const STATUTS = {
  a_faire:  { label: 'À faire',  color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',   icon: Clock },
  en_cours: { label: 'En cours', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: AlertCircle },
  termine:  { label: 'Terminée', color: 'bg-vigne-100 text-vigne-700 dark:bg-vigne-900/30 dark:text-vigne-400', icon: Check },
}

const PRIORITE_DOT = {
  haute:   'bg-red-500',
  normale: null,
  basse:   'bg-gray-300 dark:bg-gray-600',
}

// Étiquette de cible d'une tâche (parcelle unique / commune / plusieurs parcelles)
function cibleLabel(t) {
  const ps = t.parcelles || []
  if (t.commune) return `📍 ${t.commune} · toute la commune`
  if (ps.length === 1) return ps[0].nom
  if (ps.length > 1) return `📍 ${ps.length} parcelles`
  return null
}

function TacheCard({ t, onToggle, onPhoto, navigate }) {
  const statut = STATUTS[t.statut]
  const Icon = statut.icon
  const overdue = t.statut !== 'termine' && t.date_echeance && isPast(parseISO(t.date_echeance)) && !isToday(parseISO(t.date_echeance))
  const dueToday = t.statut !== 'termine' && t.date_echeance && isToday(parseISO(t.date_echeance))
  return (
    <div className="card flex gap-3">
      <button
        onClick={() => onToggle(t)}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${statut.color}`}
      >
        <Icon size={18} />
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/taches/${t.id}/edit`)}>
        <div className="flex items-center gap-1.5">
          {PRIORITE_DOT[t.priorite] && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITE_DOT[t.priorite]}`} />
          )}
          <p className={`font-semibold leading-tight ${t.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {t.titre}
          </p>
        </div>
        {cibleLabel(t) && <p className="text-xs text-vigne-600 dark:text-vigne-400 mt-0.5">{cibleLabel(t)}</p>}
        {t.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>}
        {t.date_echeance && (
          <p className={`text-xs mt-1 ${overdue ? 'text-red-500 font-medium' : dueToday ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
            📅 {format(parseISO(t.date_echeance), 'd MMM yyyy', { locale: fr })}
            {overdue && ' · En retard'}
            {dueToday && ' · Aujourd\'hui'}
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

function VueParParcelle({ taches, toggleStatut, setPhotoUrl, navigate }) {
  const [showTerminees, setShowTerminees] = useState(false)
  const actives = taches.filter(t => t.statut !== 'termine')
  const terminees = taches.filter(t => t.statut === 'termine')

  // Groupe par parcelle — une tâche multi-parcelles apparaît sous chacune
  function grouper(liste) {
    const groups = {}
    for (const t of liste) {
      const ps = t.parcelles || []
      if (ps.length === 0) {
        (groups['— Sans parcelle —'] ||= []).push(t)
      } else {
        for (const p of ps) (groups[p.nom] ||= []).push(t)
      }
    }
    // Trier les tâches de chaque groupe par date_echeance (nulls en dernier)
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (!a.date_echeance && !b.date_echeance) return 0
        if (!a.date_echeance) return 1
        if (!b.date_echeance) return -1
        return a.date_echeance.localeCompare(b.date_echeance)
      })
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }

  const groupesActifs = grouper(actives)

  return (
    <div className="px-4 pt-2 pb-8 space-y-5">
      {actives.length === 0 && terminees.length === 0 && (
        <div className="text-center py-16">
          <CheckSquare size={48} className="mx-auto text-vigne-300 mb-4" />
          <p className="text-gray-500 font-medium">Aucune tâche</p>
        </div>
      )}

      {groupesActifs.map(([nomParcelle, liste]) => (
        <div key={nomParcelle}>
          <p className="text-xs font-semibold text-vigne-700 dark:text-vigne-400 uppercase tracking-wide mb-2 pl-1">
            📍 {nomParcelle}
            <span className="ml-2 text-gray-400 font-normal normal-case">{liste.length} tâche{liste.length > 1 ? 's' : ''}</span>
          </p>
          <div className="space-y-2">
            {liste.map(t => (
              <TacheCard key={t.id} t={t} onToggle={toggleStatut} onPhoto={setPhotoUrl} navigate={navigate} />
            ))}
          </div>
        </div>
      ))}

      {terminees.length > 0 && (
        <div>
          <button
            onClick={() => setShowTerminees(v => !v)}
            className="text-xs text-gray-400 font-medium mb-2 pl-1 flex items-center gap-1.5"
          >
            <span className={`transition-transform ${showTerminees ? 'rotate-90' : ''}`}>▶</span>
            {terminees.length} terminée{terminees.length > 1 ? 's' : ''}
          </button>
          {showTerminees && (
            <div className="space-y-2 opacity-60">
              {grouper(terminees).map(([nomParcelle, liste]) => (
                <div key={nomParcelle}>
                  <p className="text-xs font-medium text-gray-400 mb-1 pl-1">📍 {nomParcelle}</p>
                  <div className="space-y-2">
                    {liste.map(t => (
                      <TacheCard key={t.id} t={t} onToggle={toggleStatut} onPhoto={setPhotoUrl} navigate={navigate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TachesList() {
  const navigate = useNavigate()
  const [taches, setTaches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('a_faire')
  const [vue, setVue] = useState('liste') // 'liste' | 'parcelle'
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
    // Mise à jour optimiste : feedback immédiat, puis on confirme avec le serveur
    setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: next } : t))
    try {
      await api.put(`/taches/${tache.id}`, { ...tache, statut: next })
    } catch (e) {
      // Hors ligne : l'opération est mise en file → on garde l'état optimiste.
      // Vraie erreur serveur : on revient à l'état précédent.
      if (!e?.offline) {
        setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: prevStatut } : t))
      }
    }
  }

  // Available seasons from loaded taches, most recent first
  const saisons = [...new Set(taches.map(tacheSaison).filter(Boolean))].sort((a, b) => b - a)

  // Taches filtered by selected season (null = all)
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
            <button
              key={s}
              onClick={() => setSaison(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                saison === s ? 'bg-vigne-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Saison {s}
            </button>
          ))}
          <button
            onClick={() => setSaison(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              saison === null ? 'bg-vigne-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
            }`}
          >
            Toutes
          </button>
        </div>
      )}

      {/* Onglets vue */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 px-4 pt-2 gap-1">
        <button
          onClick={() => setVue('liste')}
          className={`flex-1 py-2 rounded-t-xl text-sm font-medium transition-colors ${
            vue === 'liste' ? 'bg-vigne-700 text-white' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Liste
        </button>
        <button
          onClick={() => setVue('parcelle')}
          className={`flex-1 py-2 rounded-t-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            vue === 'parcelle' ? 'bg-vigne-700 text-white' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Layers size={14} /> Par parcelle
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
            <button
              key={f.key}
              onClick={() => setFiltre(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filtre === f.key ? 'bg-vigne-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="px-4 pt-2 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-20" />)}
        </div>
      ) : vue === 'parcelle' ? (
        <VueParParcelle taches={tachesSaison} toggleStatut={toggleStatut} setPhotoUrl={setPhotoUrl} navigate={navigate} />
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
