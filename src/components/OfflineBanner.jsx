import { WifiOff, RefreshCw } from 'lucide-react'
import { useOffline } from '../contexts/OfflineContext'

export default function OfflineBanner() {
  const { isOnline, pendingCount } = useOffline()

  if (isOnline && pendingCount === 0) return null

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${
      isOnline ? 'bg-amber-500 text-white' : 'bg-gray-800 text-white'
    }`}>
      {isOnline ? (
        <>
          <RefreshCw size={14} className="animate-spin" />
          <span>Synchronisation de {pendingCount} opération{pendingCount > 1 ? 's' : ''}...</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Mode hors ligne — les données seront synchronisées à la reconnexion</span>
        </>
      )}
    </div>
  )
}
