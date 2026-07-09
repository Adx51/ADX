import { useNavigate } from 'react-router-dom'

// Retour arrière fidèle à l'historique : revient à la page d'où on vient
// (ex: édition d'une tâche ouverte depuis une parcelle → retour à la parcelle).
// Fallback vers une route logique quand il n'y a pas d'historique (deep link,
// rechargement de page, partage d'URL).
export function useBack(fallback) {
  const navigate = useNavigate()
  return () => {
    if (window.history.state?.idx > 0) {
      navigate(-1)
    } else {
      navigate(fallback, { replace: true })
    }
  }
}
