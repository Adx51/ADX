import { NavLink } from 'react-router-dom'
import { Home, Map, CheckSquare, Grape, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function SideNav() {
  const { user } = useAuth()
  const tabs = [
    { to: '/',          icon: Home,        label: 'Accueil',   end: true },
    { to: '/parcelles', icon: Map,         label: 'Parcelles' },
    { to: '/taches',    icon: CheckSquare, label: 'Tâches'    },
    { to: '/vendange',  icon: Grape,       label: 'Vendanges' },
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: Settings, label: 'Admin' }] : []),
  ]

  return (
    <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 fixed left-0 top-0 bottom-0 z-20">
      <div className="px-5 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🍾</span>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">LF-Boyer</p>
            <p className="text-xs text-gray-400">Vignoble</p>
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
                  ? 'bg-vigne-50 text-vigne-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
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
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 truncate">{user?.prenom || user?.email || ''}</p>
      </div>
    </aside>
  )
}
