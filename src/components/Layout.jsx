import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import SideNav from './SideNav'
import TopBar from './TopBar'
import OfflineBanner from './OfflineBanner'
import UpdateBanner from './UpdateBanner'

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="flex h-screen overflow-hidden" style={{ height: '100dvh' }}>
      <SideNav />
      <div className="flex flex-col flex-1 min-w-0 md:ml-56 lg:ml-64">
        <TopBar />
        <div className="flex-1 overflow-y-auto overscroll-none">
          <UpdateBanner />
          <OfflineBanner />
          <main className="page-content">
            <div key={pathname} className="md:max-w-4xl lg:max-w-5xl md:mx-auto lg:mx-auto page-fade">
              <Outlet />
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </div>
  )
}
