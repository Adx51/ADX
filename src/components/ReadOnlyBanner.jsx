import { Eye } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Bandeau permanent pour les comptes en lecture seule — l'utilisateur sait
// d'emblée pourquoi aucun bouton de modification n'apparaît.
export default function ReadOnlyBanner() {
  const { readOnly } = useAuth()
  if (!readOnly) return null

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800
                    px-4 py-2 flex items-center gap-2 print:hidden">
      <Eye size={15} className="text-blue-600 dark:text-blue-300 flex-shrink-0" />
      <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
        Mode consultation — vous pouvez tout voir, rien modifier
      </p>
    </div>
  )
}
