import { useState } from 'react'
import { WifiOff, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useOffline } from '../contexts/OfflineContext'

// Résumé lisible d'une opération en échec, pour permettre la ressaisie.
function describe(op) {
  const b = op.body || {}
  if (op.path === '/chargements' || op.path?.startsWith('/chargements/')) {
    const d = b.date_chargement ? ` du ${b.date_chargement}` : ''
    return `Chargement${d} — ${b.nombre_caisses ?? '?'} caisses, ${b.poids_kg ?? '?'} kg`
  }
  if (op.path?.startsWith('/vendanges')) return `Vendange ${b.annee ?? ''}`
  if (op.path?.startsWith('/taches'))    return `Tâche « ${b.titre ?? '?'} »`
  if (op.path?.startsWith('/parcelles')) return `Parcelle « ${b.nom ?? '?'} »`
  return `${op.method} ${op.path}`
}

export default function OfflineBanner() {
  const { isOnline, pendingCount, failedCount, failedOps, isSyncing, syncQueue, dropFailedOperation } = useOffline()
  const [openFailed, setOpenFailed] = useState(false)

  if (isOnline && pendingCount === 0 && failedCount === 0) return null

  return (
    <div className="print:hidden">
      {/* Hors ligne */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-800 text-white">
          <WifiOff size={14} className="flex-shrink-0" />
          <span>Mode hors ligne — vos saisies sont conservées et envoyées à la reconnexion</span>
        </div>
      )}

      {/* En attente d'envoi */}
      {isOnline && pendingCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 text-white">
          <RefreshCw size={14} className={`flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="flex-1">
            {isSyncing
              ? `Envoi de ${pendingCount} saisie${pendingCount > 1 ? 's' : ''}…`
              : `${pendingCount} saisie${pendingCount > 1 ? 's' : ''} en attente d'envoi`}
          </span>
          {!isSyncing && (
            <button onClick={syncQueue} className="underline text-xs opacity-90 hover:opacity-100">
              Réessayer
            </button>
          )}
        </div>
      )}

      {/* Échecs définitifs — conservés, jamais supprimés automatiquement */}
      {failedCount > 0 && (
        <div className="bg-red-600 text-white text-sm">
          <button onClick={() => setOpenFailed(o => !o)}
                  className="w-full flex items-center gap-2 px-4 py-2 font-medium text-left">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span className="flex-1">
              {failedCount} saisie{failedCount > 1 ? 's' : ''} refusée{failedCount > 1 ? 's' : ''} — à ressaisir
            </span>
            {openFailed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {openFailed && (
            <div className="px-4 pb-3 space-y-2">
              <p className="text-xs text-red-100">
                Ces saisies n'ont pas pu être enregistrées. Notez-les, ressaisissez-les,
                puis retirez-les une par une de cette liste.
              </p>
              {failedOps.map(op => (
                <div key={op.id} className="bg-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{describe(op)}</p>
                    {op.error && <p className="text-xs text-red-100 mt-0.5">{op.error}</p>}
                  </div>
                  <button onClick={() => dropFailedOperation(op.id)}
                          className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 rounded-md px-2 py-1 flex-shrink-0"
                          title="Retirer de la liste (après ressaisie)">
                    <Trash2 size={12} /> Retirer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
