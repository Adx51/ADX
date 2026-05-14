import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import SideNav from './SideNav'
import OfflineBanner from './OfflineBanner'
import UpdateBanner from './UpdateBanner'

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen">
      <SideNav />
      <div className="flex flex-col flex-1 min-w-0 md:ml-56 lg:ml-64">
        <UpdateBanner />
        <OfflineBanner />
        <main className="flex-1 page-content">
          <div key={pathname} className="md:max-w-4xl lg:max-w-5xl md:mx-auto lg:mx-auto page-fade">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
