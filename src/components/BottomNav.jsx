import { NavLink } from 'react-router-dom'
import { Home, Map, CheckSquare, Grape, Leaf } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function BottomNav() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const tabs = [
    { to: '/',          icon: Home,        label: 'Accueil',  end: true },
    { to: '/parcelles', icon: Map,         label: 'Parcelles' },
    { to: '/taches',    icon: CheckSquare, label: 'Tâches'    },
    { to: '/vendange',  icon: Grape,       label: 'Vendange'  },
    ...(isAdmin ? [{ to: '/phyto', icon: Leaf, label: 'Phyto' }] : []),
  ]

  return (
    <nav className="md:hidden print:hidden flex-shrink-0 bg-white/95 dark:bg-gray-900/97 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 z-20"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-vigne-700' : 'text-gray-400 dark:text-gray-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full transition-all duration-200 ${
                  isActive ? 'bg-vigne-600 opacity-100' : 'opacity-0'
                }`} />
                <Icon size={isAdmin ? 20 : 22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={isActive ? 'font-semibold' : ''}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
