import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckSquare, Clock, AlertCircle, Check, CalendarDays } from 'lucide-react'
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

// Calcule le numéro de semaine ISO et les infos de la semaine
function getWeekInfo(dateStr) {
  if (!dateStr) return null
  const d = new Date(typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr)
  if (isNaN(d)) return null
  const tmp = new Date(d.valueOf())
  tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7)
  const jan4 = new Date(tmp.getFullYear(), 0, 4)
  const week = 1 + Math.round(((tmp - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
  const year = tmp.getFullYear()
  const dow = (d.getDay() + 6) % 7
  const mon = new Date(d); mon.setDate(d.getDate() - dow)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = dd => dd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return {
    key:   `${year}-W${String(week).padStart(2, '0')}`,
    year, week,
    range: `${fmt(mon)} – ${fmt(sun)}`,
  }
}

function taskWeekDate(t) {
  return t.date_debut || t.date_echeance || t.created_at
}

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
  const statut = STATUTS[t.statut]
  const Icon = statut.icon
  const refDate = t.date_debut || t.date_echeance
  const overdue = t.statut !== 'termine' && t.date_echeance && isPast(parseISO(t.date_echeance)) && !isToday(parseISO(t.date_echeance))
  const dueToday = t.statut !== 'termine' && t.date_echeance && isToday(parseISO(t.date_echeance))
  const week = getWeekInfo(refDate)?.week
  const hasRange = t.date_debut && t.date_fin && t.date_debut !== t.date_fin

  return (
    <div className="card flex gap-3">
      <button
        onClick={() => onToggle(t)}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${statut.color}`}
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
            <span className="text-[10px] font-bold text-vigne-600 dark:text-vigne-400 bg-vigne-50 dark:bg-vigne-900/20 px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">
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

// Vue par semaine — chaque semaine est un rectangle, tâches groupées par parcelle à l'intérieur
function VueParSemaine({ taches, toggleStatut, navigate }) {
  const currentWeekKey = getWeekInfo(new Date().toISOString())?.key

  // Trier toutes les tâches par semaine (date_debut > date_echeance > created_at)
  const byWeek = {}
  const noDate = []
  for (const t of taches) {
    const info = getWeekInfo(taskWeekDate(t))
    if (!info) { noDate.push(t); continue }
    if (!byWeek[info.key]) byWeek[info.key] = { info, tasks: [] }
    byWeek[info.key].tasks.push(t)
  }

  // Semaines du plus récent au plus ancien
  const weeks = Object.values(byWeek).sort((a, b) => b.info.key.localeCompare(a.info.key))

  function groupByParcelle(tasks) {
    const groups = {}
    for (const t of tasks) {
      const ps = t.parcelles || []
      if (ps.length === 0) {
        (groups['Général'] ||= []).push(t)
      } else {
        for (const p of ps) (groups[p.nom] ||= []).push(t)
      }
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }

  if (weeks.length === 0 && noDate.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <CheckSquare size={48} className="mx-auto text-vigne-300 mb-4" />
        <p className="text-gray-500 font-medium">Aucune tâche</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-8 space-y-3">
      {weeks.map(({ info, tasks }) => {
        const isCurrent = info.key === currentWeekKey
        const groupes = groupByParcelle(tasks)
        return (
          <div key={info.key} className={`card ${isCurrent ? 'border-vigne-300 dark:border-vigne-700' : ''}`}>
            {/* En-tête semaine */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
              <span className={`text-sm font-bold ${isCurrent ? 'text-vigne-700 dark:text-vigne-400' : 'text-gray-700 dark:text-gray-200'}`}>
                Semaine {info.week}
              </span>
              {isCurrent && (
                <span className="text-[10px] bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400 px-2 py-0.5 rounded-full font-semibold">
                  Cette semaine
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{info.range}</span>
            </div>

            {/* Tâches groupées par parcelle */}
            <div className="space-y-3">
              {groupes.map(([nomParcelle, liste]) => (
                <div key={nomParcelle}>
                  <p className="text-[11px] font-semibold text-vigne-600 dark:text-vigne-400 uppercase tracking-wide mb-1.5">
                    📍 {nomParcelle}
                  </p>
                  <div className="space-y-1.5 pl-1">
                    {liste.map(t => {
                      const s = STATUTS[t.statut] || STATUTS.a_faire
                      const Icon = s.icon
                      const done = t.statut === 'termine'
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <button onClick={() => toggleStatut(t)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s.color}`}>
                            <Icon size={13} />
                          </button>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/taches/${t.id}/edit`)}>
                            <span className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                              {PRIORITE_DOT[t.priorite] && (
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITE_DOT[t.priorite]}`} />
                              )}
                              {t.titre}
                            </span>
                          </div>
                          {(t.date_debut || t.date_fin) && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {t.date_debut && format(parseISO(t.date_debut), 'd MMM', { locale: fr })}
                              {t.date_fin && t.date_debut !== t.date_fin && ` → ${format(parseISO(t.date_fin), 'd MMM', { locale: fr })}`}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {noDate.length > 0 && (
        <div className="card opacity-70">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sans date</p>
          <div className="space-y-1.5">
            {noDate.map(t => {
              const s = STATUTS[t.statut] || STATUTS.a_faire
              const Icon = s.icon
              return (
                <div key={t.id} className="flex items-center gap-2">
                  <button onClick={() => toggleStatut(t)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s.color}`}>
                    <Icon size={13} />
                  </button>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                        onClick={() => navigate(`/taches/${t.id}/edit`)}>
                    {t.titre}
                  </span>
                </div>
              )
            })}
          </div>
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
      await api.put(`/taches/${tache.id}`, { ...tache, statut: next })
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
        <VueParSemaine taches={tachesSaison} toggleStatut={toggleStatut} navigate={navigate} />
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
