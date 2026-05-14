import { NavLink } from 'react-router-dom'
import { Home, Map, CheckSquare, Grape, Settings, Shield, Leaf } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { APP_VERSION } from '../lib/version'

export default function SideNav() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const tabs = [
    { to: '/',          icon: Home,        label: 'Accueil',   end: true },
    { to: '/parcelles', icon: Map,         label: 'Parcelles' },
    { to: '/taches',    icon: CheckSquare, label: 'Tâches'    },
    { to: '/vendange',  icon: Grape,       label: 'Vendanges' },
    ...(isAdmin ? [{ to: '/phyto', icon: Leaf, label: 'Phyto' }] : []),
    { to: '/reglages',  icon: Settings,    label: 'Réglages'  },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
  ]

  return (
    <aside className="hidden md:flex print:hidden flex-col w-56 lg:w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 fixed left-0 top-0 bottom-0 z-20">
      <div className="px-5 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🍾</span>
          <div>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">LF-Boyer</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Vignoble</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-vigne-50 dark:bg-vigne-900/20 text-vigne-700 dark:text-vigne-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.prenom || user?.email || ''}</p>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5 hidden lg:block">v{APP_VERSION}</p>
      </div>
    </aside>
  )
}
