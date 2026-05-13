import { RefreshCw, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import PageHeader from '../../components/PageHeader'
import { APP_VERSION } from '../../lib/version'

export default function ReglagesPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function forceUpdate() {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    window.location.reload()
  }

  return (
    <div className="pb-10">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-xl font-bold">⚙️ Réglages</h1>
      </div>

      <div className="px-4 pt-4 space-y-4 md:max-w-lg">

        {/* Compte */}
        <div className="card space-y-3">
          <p className="font-semibold text-gray-900">Mon compte</p>
          <div className="text-sm text-gray-700">
            <p>{user?.prenom} {user?.nom}</p>
            <p className="text-gray-400 text-xs mt-0.5">{user?.email}</p>
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

        {/* Application */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">Application</p>
            <span className="font-mono text-xs text-vigne-700 bg-vigne-50 px-2 py-0.5 rounded-full">v{APP_VERSION}</span>
          </div>
          <p className="text-xs text-gray-400">LF-Boyer Vignoble</p>
          <button
            onClick={forceUpdate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium active:bg-gray-50"
          >
            <RefreshCw size={16} />
            Forcer la mise à jour
          </button>
          <p className="text-xs text-gray-400">
            Si l'appli semble bloquée sur une ancienne version, ce bouton efface le cache et recharge.
          </p>
        </div>

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
              <p className="font-semibold text-gray-900 text-sm">Administration</p>
              <p className="text-xs text-gray-400 mt-0.5">Utilisateurs, référentiels, sauvegarde</p>
            </div>
          </button>
        )}

      </div>
    </div>
  )
}
