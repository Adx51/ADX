import { WifiOff, RefreshCw, X } from 'lucide-react'
import { useOffline } from '../contexts/OfflineContext'

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncQueue, discardQueue } = useOffline()

  if (isOnline && pendingCount === 0) return null

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${
      isOnline ? 'bg-amber-500 text-white' : 'bg-gray-800 text-white'
    }`}>
      {isOnline ? (
        <>
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          <span className="flex-1">
            {isSyncing
              ? `Synchronisation de ${pendingCount} opération${pendingCount > 1 ? 's' : ''}...`
              : `${pendingCount} opération${pendingCount > 1 ? 's' : ''} en attente`}
          </span>
          {!isSyncing && (
            <>
              <button onClick={syncQueue} className="underline text-xs opacity-90 hover:opacity-100">
                Réessayer
              </button>
              <button onClick={discardQueue} className="ml-1 opacity-70 hover:opacity-100" title="Effacer la file">
                <X size={14} />
              </button>
            </>
          )}
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
