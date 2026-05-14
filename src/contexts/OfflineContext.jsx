import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getPendingCount, getPendingOperations, removeOperation, clearQueue } from '../lib/offlineQueue'
import { rawRequest } from '../lib/api'

const OfflineContext = createContext(null)

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {
      setPendingCount(0)
    }
  }, [])

  const syncQueue = useCallback(async () => {
    const ops = await getPendingOperations()
    if (ops.length === 0) return

    setIsSyncing(true)
    for (const op of ops) {
      try {
        await rawRequest(op.method, op.path, op.body)
        await removeOperation(op.id)
      } catch (err) {
        const status = err?.status
        if (status >= 400 && status < 500) {
          // Client error (bad data, not found, conflict) — will never succeed, discard
          await removeOperation(op.id)
        } else {
          // Network error or 5xx — temporary, stop and retry on next reconnect
          break
        }
      }
    }
    setIsSyncing(false)
    await refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      await syncQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    refreshPendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshPendingCount, syncQueue])

  const discardQueue = useCallback(async () => {
    await clearQueue()
    await refreshPendingCount()
  }, [refreshPendingCount])

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, isSyncing, refreshPendingCount, syncQueue, discardQueue }}>
      {children}
    </OfflineContext.Provider>
  )
}

export const useOffline = () => {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider')
  return ctx
}
