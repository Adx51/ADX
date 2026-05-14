import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const TITLES = {
  '/':          null,          // handled separately (greeting)
  '/parcelles': 'Parcelles',
  '/taches':    'Tâches',
  '/vendange':  'Vendanges',
  '/reglages':  'Réglages',
  '/admin':     'Administration',
  '/phyto':     'Phyto',
}

export default function TopBar() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  const initial  = (user?.prenom?.[0] || user?.email?.[0] || '?').toUpperCase()
  const prenom   = user?.prenom || user?.email?.split('@')[0] || ''
  const segment  = '/' + pathname.split('/')[1]
  const title    = segment === '/' ? `Bonjour ${prenom} 👋` : (TITLES[segment] ?? 'LF-Boyer')

  return (
    <div
      className="md:hidden print:hidden flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-30"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="h-11 flex items-center justify-between px-4">
        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">{title}</span>

        <div className="flex items-center gap-1" ref={ref}>
          <Link
            to="/reglages"
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <Settings size={20} />
          </Link>

          <div className="relative">
            <button
              onClick={() => setOpen(v => !v)}
              className="w-8 h-8 rounded-full bg-vigne-100 dark:bg-vigne-900/30 flex items-center justify-center text-vigne-700 dark:text-vigne-400 font-bold text-sm active:opacity-80"
            >
              {initial}
            </button>

            {open && (
              <div className="absolute right-0 top-10 z-50 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {user?.prenom} {user?.nom}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setOpen(false); signOut() }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 active:bg-red-50 dark:active:bg-red-900/20"
                >
                  <LogOut size={16} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
