import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getQueueStats, getPendingOperations, removeOperation, markOperationFailed, clearQueue } from '../lib/offlineQueue'
import { rawRequest } from '../lib/api'

const OfflineContext = createContext(null)

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [failedOps, setFailedOps] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)
  // Empêche deux synchros simultanées (reconnexion + retour au premier plan),
  // qui enverraient deux fois la même opération → doublons de pesées.
  const syncingRef = useRef(false)

  const refreshStats = useCallback(async () => {
    try {
      const { pending, failed, all } = await getQueueStats()
      setPendingCount(pending)
      setFailedCount(failed)
      setFailedOps(all.filter(o => o.failed))
    } catch {
      setPendingCount(0)
      setFailedCount(0)
      setFailedOps([])
    }
  }, [])

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return
    const ops = (await getPendingOperations()).filter(o => !o.failed)
    if (ops.length === 0) { await refreshStats(); return }

    syncingRef.current = true
    setIsSyncing(true)
    for (const op of ops) {
      try {
        await rawRequest(op.method, op.path, op.body)
        // Acceptée par le serveur : là seulement on peut la retirer
        await removeOperation(op.id)
      } catch (err) {
        const status = err?.status
        if (status >= 400 && status < 500) {
          // Refus définitif : on NE SUPPRIME PAS. On marque l'opération pour
          // que l'utilisateur la voie et puisse la ressaisir.
          await markOperationFailed(op.id, err?.message)
        } else {
          // Réseau ou 5xx : temporaire, on garde tout et on réessaiera
          break
        }
      }
    }
    syncingRef.current = false
    setIsSyncing(false)
    await refreshStats()
  }, [refreshStats])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      await syncQueue()
    }
    const handleOffline = () => setIsOnline(false)

    // Reprise au premier plan (PWA rouverte, écran déverrouillé) : l'événement
    // `online` n'est pas rejoué, il faut retenter explicitement — sinon une
    // file remplie hors ligne pouvait n'être jamais envoyée.
    const handleVisible = () => {
      if (!document.hidden && navigator.onLine) syncQueue()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisible)

    // Au démarrage de l'app : vider la file si on est déjà en ligne
    refreshStats()
    if (navigator.onLine) syncQueue()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [refreshStats, syncQueue])

  // Suppression manuelle et explicite d'une opération en échec (après
  // ressaisie). Jamais appelée automatiquement.
  const dropFailedOperation = useCallback(async (id) => {
    await removeOperation(id)
    await refreshStats()
  }, [refreshStats])

  // Vide toute la file — destructif, réservé à une confirmation explicite.
  const discardQueue = useCallback(async () => {
    await clearQueue()
    await refreshStats()
  }, [refreshStats])

  return (
    <OfflineContext.Provider value={{
      isOnline, pendingCount, failedCount, failedOps, isSyncing,
      refreshPendingCount: refreshStats, syncQueue, dropFailedOperation, discardQueue,
    }}>
      {children}
    </OfflineContext.Provider>
  )
}

export const useOffline = () => {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider')
  return ctx
}
