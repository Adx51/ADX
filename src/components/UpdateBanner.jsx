import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Check for new version every 30s
      if (r) setInterval(() => r.update(), 30 * 1000)
    },
  })

  useEffect(() => {
    if (!needRefresh) return

    function isTyping() {
      const el = document.activeElement
      return el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
    }

    function tryUpdate() {
      if (isTyping()) return
      updateServiceWorker(true)
    }

    tryUpdate()

    function onVisible() {
      if (!document.hidden) tryUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(tryUpdate, 5000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(id)
    }
  }, [needRefresh, updateServiceWorker])

  return null
}
