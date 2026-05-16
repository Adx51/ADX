import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ExternalLink, RefreshCw, CloudOff, Newspaper } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'

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

  async function load() {
    setWErr(false)
    setNErr(false)
    setNLoading(true)
    const [w, n] = await Promise.allSettled([
      api.get('/dashboard/weather'),
      api.get('/dashboard/news'),
    ])
    if (w.status === 'fulfilled' && !w.value?.error) setWeather(w.value)
    else setWErr(true)
    if (n.status === 'fulfilled' && Array.isArray(n.value)) {
      if (n.value.length > 0) {
        setNews(n.value)
        setNLoading(false)
      } else {
        // Cache vide côté serveur (fetch en arrière-plan) — retry dans 5s
        setTimeout(async () => {
          try {
            const fresh = await api.get('/dashboard/news')
            if (Array.isArray(fresh) && fresh.length > 0) setNews(fresh)
            else setNErr(true)
          } catch { setNErr(true) }
          setNLoading(false)
        }, 5000)
      }
    } else {
      setNErr(true)
      setNLoading(false)
    }
  }

  const refreshTick = useRefreshTrigger()
  useEffect(() => { load() }, [refreshTick])

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

      <div className="px-4 pt-3 pb-6 lg:px-6 lg:pt-4">
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
