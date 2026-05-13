import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Vérifie une mise à jour toutes les 60s
      if (r) setInterval(() => r.update(), 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between
                    bg-vigne-700 text-white px-4 py-3 shadow-lg"
         style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <p className="text-sm font-medium">Nouvelle version disponible</p>
      <button
        onClick={() => updateServiceWorker(true)}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30
                   text-white text-sm font-semibold px-3 py-1.5 rounded-xl
                   active:scale-95 transition-all"
      >
        <RefreshCw size={14} />
        Mettre à jour
      </button>
    </div>
  )
}
