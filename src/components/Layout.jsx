import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import OfflineBanner from './OfflineBanner'
import { APP_VERSION } from '../lib/version'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <OfflineBanner />
      <main className="flex-1 page-content">
        <Outlet />
      </main>
      <p className="text-center text-gray-300 text-[10px] pb-1 select-none">v{APP_VERSION}</p>
      <BottomNav />
    </div>
  )
}
