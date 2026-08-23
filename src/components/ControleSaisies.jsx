import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Loader2, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

// Contrôle de cohérence : liste les pesées dont l'année de la date ne
// correspond pas à la saison de leur vendange. Rien n'est supprimé sans une
// action explicite, une par une — pas de suppression en masse : chaque ligne
// est une pesée réelle et doit être vue avant d'être écartée.
export default function ControleSaisies() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setError('')
    try {
      setRows(await api.get('/admin/chargements-incoherents'))
    } catch (e) {
      setError(e.message)
      setRows([])
    }
  }
  useEffect(() => { load() }, [])

  async function supprimer(r) {
    setBusyId(r.id)
    setError('')
    try {
      await api.delete(`/chargements/${r.id}`)
      setRows(prev => prev.filter(x => x.id !== r.id))
      setConfirmId(null)
    } catch (e) {
      setError(e.message)
    }
    setBusyId(null)
  }

  if (rows === null) return (
    <div className="card flex items-center gap-2 text-gray-500 text-sm">
      <Loader2 size={16} className="animate-spin" /> Analyse des saisies…
    </div>
  )

  return (
    <div className="space-y-3 lg:max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      <div className="card space-y-1">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Pesées datées hors de leur saison</p>
            <p className="text-xs text-gray-500 mt-1">
              Une pesée rattachée à la vendange 2025 mais datée 2026 apparaît dans le
              récap 2025 avec une date 2026. C'est en général une saisie faite sur une
              saison passée alors que la date du jour était pré-remplie.
            </p>
          </div>
          <button onClick={load} className="p-2 text-gray-400 active:bg-gray-100 rounded-xl" title="Réanalyser">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card flex items-center gap-3 text-vigne-700">
          <Check size={18} className="flex-shrink-0" />
          <p className="text-sm font-medium">Aucune incohérence — toutes les pesées sont datées dans leur saison.</p>
        </div>
      ) : (
        <>
          <div className="bg-orange-50 border border-orange-300 text-orange-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              {rows.length} pesée{rows.length > 1 ? 's' : ''} concernée{rows.length > 1 ? 's' : ''}.
              Corrigez la date si la pesée est réelle, supprimez-la seulement si c'est une saisie de test.
            </span>
          </div>

          {rows.map(r => (
            <div key={r.id} className="card space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{r.parcelle_nom}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {r.nombre_caisses} caisses · <span className="font-semibold">{r.poids_kg} kg</span>
                  </p>
                  <p className="text-xs mt-1">
                    <span className="text-gray-500">Saison </span>
                    <span className="font-semibold text-gray-900">{r.saison}</span>
                    <span className="text-gray-500"> · datée </span>
                    <span className="font-semibold text-orange-700">{r.date_chargement}</span>
                    {r.heure_livraison && <span className="text-gray-400"> à {r.heure_livraison.slice(0, 5)}</span>}
                  </p>
                </div>
              </div>

              {confirmId === r.id ? (
                <div className="border border-red-200 bg-red-50 rounded-xl p-3 space-y-2">
                  <p className="text-sm text-red-700 text-center font-medium">
                    Supprimer définitivement cette pesée de {r.poids_kg} kg ?
                  </p>
                  <p className="text-xs text-red-600 text-center">
                    Le total de la vendange {r.saison} sera recalculé.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setConfirmId(null)} className="btn-secondary py-2 text-sm">Annuler</button>
                    <button onClick={() => supprimer(r)} disabled={busyId === r.id}
                            className="btn-danger py-2 text-sm disabled:opacity-60">
                      {busyId === r.id ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/vendange/parcelle/${r.vendange_id}/chargement/${r.id}/edit`)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-vigne-300 text-vigne-700 text-sm font-semibold active:bg-vigne-50"
                  >
                    <Pencil size={14} /> Corriger la date
                  </button>
                  <button
                    onClick={() => setConfirmId(r.id)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium active:bg-red-50"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
