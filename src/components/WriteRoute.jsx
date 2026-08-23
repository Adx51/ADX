import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Enveloppe les routes qui servent à créer/modifier/importer : un compte en
// lecture seule y accédant (lien direct, historique, favori) est renvoyé vers
// une page de consultation au lieu de voir un formulaire inutilisable.
export default function WriteRoute({ redirect = '/' }) {
  const { readOnly } = useAuth()
  if (readOnly) return <Navigate to={redirect} replace />
  return <Outlet />
}
