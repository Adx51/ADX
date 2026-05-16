import { useEffect, useState } from 'react'

// Retourne un compteur qui s'incrémente :
// 1. Quand l'app revient au premier plan (BFCache iOS, switch d'app)
// 2. Quand une mutation a eu lieu dans l'app (adx:data-changed)
// Usage : ajouter `refreshTick` aux dépendances du useEffect de chargement.
export function useRefreshTrigger() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    function refresh() {
      if (!document.hidden) setTick(t => t + 1)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('adx:data-changed', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('adx:data-changed', refresh)
    }
  }, [])
  return tick
}
