import { useEffect, useState } from 'react'
import { RefreshCw, Shield, Moon, Sun, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import PageHeader from '../../components/PageHeader'
import { APP_VERSION } from '../../lib/version'
import { toggleDarkMode, getDarkMode } from '../../lib/darkMode'
import { api } from '../../lib/api'

export default function ReglagesPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useState(getDarkMode)
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/settings').then(s => setSettings(s)).catch(() => {})
    }
  }, [user])

  async function forceUpdate() {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    window.location.reload()
  }

  function handleDarkToggle() {
    const isDark = toggleDarkMode()
    setDark(isDark)
  }

  async function saveSettings() {
    if (!settings) return
    setSavingSettings(true)
    try {
      const updated = await api.put('/settings', {
        weather_lat:   settings.weather_lat,
        weather_lng:   settings.weather_lng,
        weather_label: settings.weather_label,
      })
      setSettings(updated)
    } catch {}
    setSavingSettings(false)
  }

  return (
    <div className="pb-10">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-xl font-bold">⚙️ Réglages</h1>
      </div>

      <div className="px-4 pt-4 space-y-4 md:max-w-lg">

        {/* Compte */}
        <div className="card space-y-3">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Mon compte</p>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p>{user?.prenom} {user?.nom}</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">{user?.email}</p>
            <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
              user?.role === 'admin' ? 'bg-vigne-100 text-vigne-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {user?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
            </span>
          </div>
          <button
            onClick={signOut}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium active:bg-red-50"
          >
            Se déconnecter
          </button>
        </div>

        {/* Apparence */}
        <div className="card space-y-3">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Apparence</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {dark ? <Moon size={18} className="text-gray-400" /> : <Sun size={18} className="text-amber-500" />}
              <span className="text-sm text-gray-700 dark:text-gray-300">Mode sombre</span>
            </div>
            <button
              onClick={handleDarkToggle}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                dark ? 'bg-vigne-700' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                dark ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Application */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Application</p>
            <span className="font-mono text-xs text-vigne-700 bg-vigne-50 px-2 py-0.5 rounded-full">v{APP_VERSION}</span>
          </div>
          <p className="text-xs text-gray-400">LF-Boyer Vignoble</p>
          <button
            onClick={forceUpdate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium active:bg-gray-50 dark:active:bg-gray-700"
          >
            <RefreshCw size={16} />
            Forcer la mise à jour
          </button>
          <p className="text-xs text-gray-400">
            Si l'appli semble bloquée sur une ancienne version, ce bouton efface le cache et recharge.
          </p>
        </div>

        {/* Météo (admin) */}
        {user?.role === 'admin' && settings && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-sky-500" />
              <p className="font-semibold text-gray-900 dark:text-gray-100">Localisation météo</p>
            </div>
            <div className="space-y-2">
              <div>
                <label className="label">Nom affiché</label>
                <input
                  className="input text-sm"
                  value={settings.weather_label || ''}
                  onChange={e => setSettings(s => ({ ...s, weather_label: e.target.value }))}
                  placeholder="ex: Chouilly · Champagne"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Latitude</label>
                  <input
                    className="input text-sm"
                    value={settings.weather_lat || ''}
                    onChange={e => setSettings(s => ({ ...s, weather_lat: e.target.value }))}
                    placeholder="48.98"
                  />
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input
                    className="input text-sm"
                    value={settings.weather_lng || ''}
                    onChange={e => setSettings(s => ({ ...s, weather_lng: e.target.value }))}
                    placeholder="4.06"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-medium active:bg-sky-600 disabled:opacity-50"
            >
              {savingSettings ? <RefreshCw size={14} className="animate-spin" /> : null}
              Enregistrer la localisation
            </button>
          </div>
        )}

        {/* Admin */}
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-vigne-100 flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-vigne-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Administration</p>
              <p className="text-xs text-gray-400 mt-0.5">Utilisateurs, référentiels, sauvegarde</p>
            </div>
          </button>
        )}

      </div>
    </div>
  )
}
