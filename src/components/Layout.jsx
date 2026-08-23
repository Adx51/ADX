import { Outlet, useLocation } from 'react-router-dom'
import { useLayoutEffect, useRef } from 'react'
import BottomNav from './BottomNav'
import SideNav from './SideNav'
import TopBar from './TopBar'
import OfflineBanner from './OfflineBanner'
import UpdateBanner from './UpdateBanner'
import ReadOnlyBanner from './ReadOnlyBanner'

export default function Layout() {
  const { pathname } = useLocation()
  const scrollRef = useRef()

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app-shell flex h-screen overflow-hidden" style={{ height: '100dvh' }}>
      <SideNav />
      <div className="flex flex-col flex-1 min-w-0 md:ml-56 lg:ml-64 print:ml-0">
        <TopBar />
        <div ref={scrollRef} className="app-scroll flex-1 overflow-y-auto overflow-x-hidden overscroll-none">
          <UpdateBanner />
          <OfflineBanner />
          <ReadOnlyBanner />
          <main className="page-content">
            <div className="md:max-w-4xl lg:max-w-5xl md:mx-auto lg:mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </div>
  )
}
