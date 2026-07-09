import { useEffect, useState } from 'react'
import { invalidateAll } from './api'

// Retourne un compteur qui s'incrémente :
// 1. Quand l'app revient au premier plan (BFCache iOS, switch d'app)
// 2. Quand une mutation a eu lieu dans l'app (adx:data-changed)
// 3. Toutes les 30s en arrière-plan (données d'autres utilisateurs)
// Usage : ajouter `refreshTick` aux dépendances du useEffect de chargement.
export function useRefreshTrigger() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    function refresh() {
      if (!document.hidden) setTick(t => t + 1)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('adx:data-changed', refresh)
    // Polling 30s : vide le cache et dispatche adx:data-changed → les composants refetchent
    const interval = setInterval(() => {
      if (!document.hidden) invalidateAll()
    }, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('adx:data-changed', refresh)
      clearInterval(interval)
    }
  }, [])
  return tick
}
