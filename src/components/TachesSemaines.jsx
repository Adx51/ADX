import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckSquare } from 'lucide-react'
import { getWeekInfo, todayISO } from '../lib/saison'
import { STATUT_TACHE, PRIORITE_DOT } from '../lib/taches'

function taskWeekDate(t) {
  return t.date_debut || t.date_echeance || t.created_at
}

function TacheRow({ t, onToggle, onOpen }) {
  const s = STATUT_TACHE[t.statut] || STATUT_TACHE.a_faire
  const { Icon } = s
  const done = t.statut === 'termine'
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => (onToggle ? onToggle(t) : onOpen(t))}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s.badge}`}
      >
        <Icon size={13} />
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(t)}>
        <span className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {PRIORITE_DOT[t.priorite] && (
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITE_DOT[t.priorite]}`} />
          )}
          {t.titre}
        </span>
      </div>
      {(t.date_debut || t.date_fin) && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          {t.date_debut && format(parseISO(t.date_debut), 'd MMM', { locale: fr })}
          {t.date_fin && t.date_debut !== t.date_fin && ` → ${format(parseISO(t.date_fin), 'd MMM', { locale: fr })}`}
        </span>
      )}
    </div>
  )
}

// Vue par semaine — chaque semaine est un rectangle ; tâches groupées par
// parcelle à l'intérieur (groupParcelles=false pour une parcelle unique).
// onToggle (optionnel) : cycle le statut ; onOpen : ouvre l'édition.
export default function TachesSemaines({ taches, onToggle, onOpen, groupParcelles = true }) {
  const currentWeekKey = getWeekInfo(todayISO())?.key

  const byWeek = {}
  const noDate = []
  for (const t of taches) {
    const info = getWeekInfo(taskWeekDate(t))
    if (!info) { noDate.push(t); continue }
    if (!byWeek[info.key]) byWeek[info.key] = { info, tasks: [] }
    byWeek[info.key].tasks.push(t)
  }

  // Ordre : la semaine courante en premier, puis le futur (du plus proche au
  // plus lointain), puis le passé (du plus récent au plus ancien)
  const all = Object.values(byWeek)
  const weeks = [
    ...all.filter(w => w.info.key === currentWeekKey),
    ...all.filter(w => w.info.key > currentWeekKey).sort((a, b) => a.info.key.localeCompare(b.info.key)),
    ...all.filter(w => w.info.key < currentWeekKey).sort((a, b) => b.info.key.localeCompare(a.info.key)),
  ]

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
    <div className="space-y-3">
      {weeks.map(({ info, tasks }) => {
        const isCurrent = info.key === currentWeekKey
        return (
          <div key={info.key} className={`card ${isCurrent ? 'border-vigne-300 dark:border-vigne-700' : ''}`}>
            {/* En-tête semaine */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
              <span className={`text-sm font-bold ${isCurrent ? 'text-vigne-700 dark:text-vigne-400' : 'text-gray-700 dark:text-gray-200'}`}>
                Semaine {info.week}
              </span>
              {isCurrent && (
                <span className="text-xs bg-vigne-100 dark:bg-vigne-900/30 text-vigne-700 dark:text-vigne-400 px-2 py-0.5 rounded-full font-semibold">
                  Cette semaine
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{info.range}</span>
            </div>

            {groupParcelles ? (
              <div className="space-y-3">
                {groupByParcelle(tasks).map(([nomParcelle, liste]) => (
                  <div key={nomParcelle}>
                    <p className="text-xs font-semibold text-vigne-600 dark:text-vigne-400 uppercase tracking-wide mb-1.5">
                      📍 {nomParcelle}
                    </p>
                    <div className="space-y-1.5 pl-1">
                      {liste.map(t => <TacheRow key={t.id} t={t} onToggle={onToggle} onOpen={onOpen} />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {tasks.map(t => <TacheRow key={t.id} t={t} onToggle={onToggle} onOpen={onOpen} />)}
              </div>
            )}
          </div>
        )
      })}

      {noDate.length > 0 && (
        <div className="card opacity-70">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sans date</p>
          <div className="space-y-1.5">
            {noDate.map(t => <TacheRow key={t.id} t={t} onToggle={onToggle} onOpen={onOpen} />)}
          </div>
        </div>
      )}
    </div>
  )
}
