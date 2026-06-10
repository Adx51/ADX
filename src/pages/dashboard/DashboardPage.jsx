import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ExternalLink, RefreshCw, CloudOff, Newspaper, CalendarDays, AlertTriangle, Sprout, Grape, CheckCircle2, Plus } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'
import { getISOWeek, todayISO } from '../../lib/saison'
import { STATUT_TACHE, PRIORITE_DOT } from '../../lib/taches'

const TAG_STYLE = {
  Champagne:   'bg-amber-100 text-amber-700',
  CIVC:        'bg-vigne-100 text-vigne-700',
  Chouilly:    'bg-blue-100 text-blue-700',
  Hautvillers: 'bg-purple-100 text-purple-700',
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1)  return 'à l\'instant'
  if (h < 24) return `il y a ${h}h`
  if (d === 1) return 'hier'
  if (d < 7)  return `il y a ${d} jours`
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const DAY_SHORT = ['dim','lun','mar','mer','jeu','ven','sam']

export default function DashboardPage() {
  const { user } = useAuth()
  const [weather, setWeather] = useState(null)
  const [news, setNews]       = useState(null)
  const [wErr, setWErr]       = useState(false)
  const [nErr, setNErr]       = useState(false)
  const [nLoading, setNLoading] = useState(true)

  // Suivi du montage + id du timer de retry, pour éviter les setState après démontage
  const mountedRef = useRef(true)
  const retryRef = useRef(null)

  async function load() {
    setWErr(false)
    setNErr(false)
    setNLoading(true)
    const [w, n] = await Promise.allSettled([
      api.get('/dashboard/weather'),
      api.get('/dashboard/news'),
    ])
    if (!mountedRef.current) return
    if (w.status === 'fulfilled' && !w.value?.error) setWeather(w.value)
    else setWErr(true)
    if (n.status === 'fulfilled' && Array.isArray(n.value)) {
      if (n.value.length > 0) {
        setNews(n.value)
        setNLoading(false)
      } else {
        // Cache vide côté serveur (fetch en arrière-plan) — retry dans 5s
        retryRef.current = setTimeout(async () => {
          try {
            const fresh = await api.get('/dashboard/news')
            if (!mountedRef.current) return
            if (Array.isArray(fresh) && fresh.length > 0) setNews(fresh)
            else setNErr(true)
          } catch { if (mountedRef.current) setNErr(true) }
          if (mountedRef.current) setNLoading(false)
        }, 5000)
      }
    } else {
      setNErr(true)
      setNLoading(false)
    }
  }

  const refreshTick = useRefreshTrigger()
  useEffect(() => {
    mountedRef.current = true
    load()
    return () => {
      mountedRef.current = false
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [refreshTick])

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr })
  const prenom = user?.prenom || user?.email?.split('@')[0] || ''

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold capitalize">Bonjour {prenom} 👋</h1>
          <p className="text-gray-500 md:text-vigne-600 text-xs mt-0.5 capitalize">{today}</p>
        </div>
        <button onClick={load} className="p-2 rounded-full active:bg-vigne-600" title="Actualiser">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="px-4 pt-3 pb-6 lg:px-6 lg:pt-4 space-y-5">
        {/* Ma semaine : à faire + fait récemment */}
        <SemaineBlock refreshTick={refreshTick} />

        <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start space-y-5 lg:space-y-0">

          {/* Left: Météo (2/5) */}
          <div className="lg:col-span-2">
            <WeatherCard weather={weather} error={wErr} />
          </div>

          {/* Right: Actualités (3/5) */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper size={16} className="text-vigne-600" />
              <h2 className="font-bold text-gray-900">Actualités viticoles</h2>
            </div>

            {nLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="card skeleton h-16" />)}
              </div>
            ) : nErr || !news?.length ? (
              <div className="card flex items-center gap-3 text-gray-400">
                <CloudOff size={20} />
                <p className="text-sm">Actualités indisponibles — vérifiez la connexion internet du Pi.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {news.map((item, i) => (
                  <NewsCard key={i} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Bornes lundi–dimanche de la semaine courante + fenêtre du récap (7 jours)
function semaineBounds() {
  const now = new Date()
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const depuis = new Date(now); depuis.setDate(now.getDate() - 7)
  return { debut: iso(mon), fin: iso(sun), depuis: iso(depuis) }
}

function fmtJour(d) {
  return format(parseISO(d), 'd MMM', { locale: fr })
}

function SemaineBlock({ refreshTick }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    const { debut, fin, depuis } = semaineBounds()
    api.get(`/dashboard/semaine?debut=${debut}&fin=${fin}&depuis=${depuis}`)
      .then(setData)
      .catch(() => setData(null))
  }, [refreshTick])

  if (!data) return <div className="card skeleton h-24" />

  const { taches_semaine, taches_retard, recap } = data
  const week = getISOWeek(todayISO())
  const recapVide = !recap.taches.length && !recap.traitements.length && !recap.chargements.length

  async function toggleStatut(tache) {
    const next = tache.statut === 'a_faire' ? 'en_cours'
               : tache.statut === 'en_cours' ? 'termine' : 'a_faire'
    const prevStatut = tache.statut
    const patch = statut => prev => prev && ({
      ...prev,
      taches_semaine: prev.taches_semaine.map(t => t.id === tache.id ? { ...t, statut } : t),
      taches_retard:  prev.taches_retard.map(t => t.id === tache.id ? { ...t, statut } : t),
    })
    setData(patch(next))
    try {
      await api.put(`/taches/${tache.id}/statut`, { statut: next })
    } catch (e) {
      if (!e?.offline) setData(patch(prevStatut))
    }
  }

  function TacheRow({ t, retard }) {
    const s = STATUT_TACHE[t.statut] || STATUT_TACHE.a_faire
    const { Icon } = s
    const hasRange = t.date_debut && t.date_fin && t.date_debut !== t.date_fin
    const refDate = t.date_debut || t.date_fin
    return (
      <div className="flex items-center gap-2.5">
        <button onClick={() => toggleStatut(t)}
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.badge}`}>
          <Icon size={14} />
        </button>
        <button onClick={() => navigate(`/taches/${t.id}/edit`)} className="flex-1 min-w-0 text-left active:opacity-70">
          <span className="text-sm text-gray-900 dark:text-gray-100 leading-tight">
            {PRIORITE_DOT[t.priorite] && (
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITE_DOT[t.priorite]}`} />
            )}
            {t.titre}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {refDate && (
              <span className={`text-xs ${retard ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {hasRange ? `${fmtJour(t.date_debut)} → ${fmtJour(t.date_fin)}` : fmtJour(refDate)}
                {retard && ' · En retard'}
              </span>
            )}
            {(t.parcelles || []).slice(0, 3).map(p => (
              <span key={p.id} className="text-xs bg-vigne-50 dark:bg-vigne-900/20 text-vigne-700 dark:text-vigne-400 px-1.5 py-0.5 rounded font-medium">
                {p.nom}
              </span>
            ))}
            {(t.parcelles || []).length > 3 && (
              <span className="text-xs text-gray-400">+{t.parcelles.length - 3}</span>
            )}
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      {/* En-tête */}
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-vigne-600" />
        <h2 className="font-bold text-gray-900 dark:text-gray-100">Ma semaine</h2>
        <span className="text-xs font-bold text-vigne-600 dark:text-vigne-400 bg-vigne-50 dark:bg-vigne-900/20 px-2 py-0.5 rounded-full">
          S.{week}
        </span>
        <button onClick={() => navigate('/taches/new')}
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-vigne-700 dark:text-vigne-400 px-2 py-1.5 -my-1 rounded-lg active:bg-vigne-50">
          <Plus size={14} /> Tâche
        </button>
      </div>

      {/* En retard */}
      {taches_retard.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle size={12} /> En retard <span className="font-normal normal-case">{taches_retard.length}</span>
          </p>
          {taches_retard.map(t => <TacheRow key={t.id} t={t} retard />)}
        </div>
      )}

      {/* Tâches de la semaine */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">À faire cette semaine</p>
        {taches_semaine.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune tâche prévue cette semaine</p>
        ) : (
          taches_semaine.map(t => <TacheRow key={t.id} t={t} />)
        )}
      </div>

      {/* Récap : fait ces 7 derniers jours */}
      <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fait ces 7 derniers jours</p>
        {recapVide ? (
          <p className="text-sm text-gray-400">Rien d'enregistré sur la période</p>
        ) : (
          <div className="space-y-1.5">
            {recap.taches.map(t => (
              <button key={t.id} onClick={() => navigate(`/taches/${t.id}/edit`)}
                className="w-full flex items-center gap-2 text-left active:opacity-70">
                <CheckCircle2 size={15} className="text-vigne-600 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">{t.titre}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {(t.parcelles || []).map(p => p.nom).join(', ') || ''}
                </span>
              </button>
            ))}
            {recap.traitements.map(t => (
              <button key={t.id} onClick={() => navigate('/phyto')}
                className="w-full flex items-center gap-2 text-left active:opacity-70">
                <Sprout size={15} className="text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                  {t.produits.slice(0, 2).join(' + ')}{t.produits.length > 2 ? '…' : ''}
                  {t.nb_parcelles > 0 && <span className="text-gray-400"> · {t.nb_parcelles} parcelle{t.nb_parcelles > 1 ? 's' : ''}</span>}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">{fmtJour(t.date)}</span>
              </button>
            ))}
            {recap.chargements.map(c => (
              <button key={c.id} onClick={() => navigate(`/vendange/parcelle/${c.vendange_id}`)}
                className="w-full flex items-center gap-2 text-left active:opacity-70">
                <Grape size={15} className="text-amber-600 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                  {Number(c.poids_kg).toLocaleString('fr-FR')} kg
                  {c.parcelle_nom && <span className="text-gray-400"> · {c.parcelle_nom}</span>}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">{fmtJour(c.date_chargement)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WeatherCard({ weather, error }) {
  if (error) return (
    <div className="card flex items-center gap-3 text-gray-400">
      <CloudOff size={20} />
      <p className="text-sm">Météo indisponible</p>
    </div>
  )

  if (!weather) return (
    <div className="card skeleton h-32" />
  )

  const c = weather.current

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-100 border border-sky-200 rounded-2xl p-4">
      {/* Localisation */}
      <p className="text-xs font-medium text-sky-600 mb-3">📍 Chouilly · Champagne</p>

      {/* Actuel */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-5xl">{c.emoji}</span>
          <div>
            <p className="text-4xl font-bold text-sky-900">{c.temp}°</p>
            <p className="text-sm text-sky-700">{c.desc}</p>
          </div>
        </div>
        <div className="text-right space-y-1 text-xs text-sky-700">
          <p>💨 {c.wind} km/h</p>
          <p>💧 {c.humidity}%</p>
          {c.precip > 0 && <p>🌧 {c.precip} mm</p>}
        </div>
      </div>

      {/* Prévisions 5 jours */}
      <div className="grid grid-cols-5 gap-1">
        {weather.forecast.map(day => {
          const d = new Date(day.date)
          return (
            <div key={day.date} className="bg-white/60 rounded-xl py-2 px-1 text-center">
              <p className="text-xs text-sky-600 font-medium capitalize">
                {DAY_SHORT[d.getDay()]}
              </p>
              <p className="text-lg my-1">{day.emoji}</p>
              <p className="text-xs font-bold text-sky-900">{day.tmax}°</p>
              <p className="text-xs text-sky-500">{day.tmin}°</p>
              {day.precip > 0 && (
                <p className="text-xs text-blue-500 mt-0.5">{day.precip.toFixed(0)}mm</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NewsCard({ item }) {
  const tagCls = TAG_STYLE[item.tag] || 'bg-gray-100 text-gray-600'

  function handleClick() {
    if (item.link) window.open(item.link, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={handleClick}
      className="card w-full text-left active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tagCls}`}>
              {item.tag}
            </span>
            <span className="text-xs text-gray-400 truncate">{item.source}</span>
          </div>
          <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
            {item.title}
          </p>
          {item.pubDate > 0 && (
            <p className="text-xs text-gray-400 mt-1">{timeAgo(item.pubDate)}</p>
          )}
        </div>
        <ExternalLink size={14} className="text-gray-300 flex-shrink-0 mt-1" />
      </div>
    </button>
  )
}
