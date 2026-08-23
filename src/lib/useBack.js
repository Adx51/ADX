import { useNavigate } from 'react-router-dom'

// Retour arrière fidèle à l'historique : revient à la page d'où l'on vient
// (ex: édition d'une tâche ouverte depuis une parcelle → retour à la parcelle).
// Fallback vers une route logique quand il n'y a pas d'historique (deep link,
// rechargement de page, partage d'URL).
//
// ⚠ RÈGLE À RESPECTER DANS TOUT FORMULAIRE OU ÉCRAN D'IMPORT :
// après un enregistrement réussi, l'écran ne doit JAMAIS rester dans la pile
// d'historique, sinon le bouton précédent y ramène. Deux cas :
//
//   • on retourne là d'où l'on vient  → goBack()  (dépile le formulaire)
//   • on va ailleurs (voir l'objet
//     qu'on vient de créer)           → navigate(cible, { replace: true })
//
// Ne jamais faire un simple navigate(cible) après une écriture : cela empile
// la cible PAR-DESSUS le formulaire, qui redevient alors la page précédente.
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
