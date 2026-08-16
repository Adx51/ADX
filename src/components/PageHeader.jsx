import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useBack } from '../lib/useBack'

// `dirty` : passer true depuis un écran de saisie non enregistré. Le retour
// demande alors confirmation — évite de perdre une pesée en cours d'un tap
// malheureux, en particulier en vendange.
export default function PageHeader({ title, back, children, dirty = false }) {
  const goBack = useBack(back)

  // Fermeture d'onglet / rechargement pendant une saisie : le navigateur
  // demande confirmation. Complète la garde du bouton retour ci-dessous.
  useEffect(() => {
    if (!dirty) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function handleBack() {
    if (dirty && !window.confirm('Cette saisie n’est pas enregistrée. Quitter et la perdre ?')) return
    goBack()
  }

  return (
    <div className="page-header flex items-center gap-3">
      {back && (
        <button
          onClick={handleBack}
          className="p-1 -ml-1 rounded-full active:bg-vigne-600"
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <h1 className="text-lg font-bold flex-1 leading-tight break-words">{title}</h1>
      {children}
    </div>
  )
}
