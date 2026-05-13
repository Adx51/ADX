import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import OfflineBanner from './OfflineBanner'
import UpdateBanner from './UpdateBanner'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <UpdateBanner />
      <OfflineBanner />
      <main className="flex-1 page-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
