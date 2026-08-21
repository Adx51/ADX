import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Users, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { caToDisplay } from '../../lib/surface'

// Relevé des kilos dus aux bailleurs pour une saison.
// La part leur étant livrée en raisin, ce document sert de justificatif :
// pour chaque bailleur, ses parcelles, ce qui y a été récolté et sa part.
const LIBELLE_TAUX = { quart: 'au quart (1/4)', tiers: 'au tiers (1/3)' }

function kg(n) {
  return Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

export default function ReleveBailleurs() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    api.get(`/bailleurs/releve/${annee}`)
      .then(setData)
      .catch(e => setErreur(e.message))
  }, [annee])

  if (erreur) return (
    <div className="p-8 text-center text-gray-500">{erreur}</div>
  )
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <Loader2 size={28} className="animate-spin text-amber-500" />
      <p className="text-sm">Chargement…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* En-tête, masqué à l'impression */}
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(`/vendange/${annee}`)}
                className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-sm shrink-0">
          <ArrowLeft size={18} /> Retour
        </button>
        <p className="flex-1 text-center font-bold text-gray-900 dark:text-gray-100 text-sm">
          Bailleurs {annee}
        </p>
        <button onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold shrink-0">
          <Printer size={14} /> Imprimer
        </button>
      </div>

      <div className="light-content px-4 py-6 space-y-8 max-w-2xl mx-auto">
        {data.bailleurs.length === 0 ? (
          <div className="text-center py-16">
            <Users size={44} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucune parcelle en métayage</p>
            <p className="text-gray-400 text-sm mt-1">
              Renseignez le bailleur sur une parcelle pour la voir apparaître ici.
            </p>
          </div>
        ) : (
          <>
            {data.bailleurs.map(b => (
              <section key={b.bailleur} className="break-inside-avoid">
                <div className="flex items-baseline gap-3 mb-2">
                  <h2 className="font-bold text-gray-900 text-lg">{b.bailleur}</h2>
                  <div className="flex-1 h-px bg-gray-300" />
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-1.5">
                  {b.parcelles.map(p => (
                    <div key={p.id} className="border border-gray-200 rounded-xl px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 uppercase truncate">{p.nom}</p>
                          <p className="text-xs text-gray-400">
                            {LIBELLE_TAUX[p.taux] || p.taux}
                            {p.surface_totale_ca ? ` · ${caToDisplay(p.surface_totale_ca)}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">{kg(p.poids_total)} kg récoltés</p>
                          <p className="font-bold text-sm text-gray-900">{kg(p.part_kg)} kg dus</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2.5">
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total dû</span>
                    <span className="font-bold text-gray-900">{kg(b.total_part)} kg</span>
                  </div>
                </div>

                {/* Impression et desktop */}
                <table className="hidden md:table print:table w-full border-collapse text-sm">
                  <thead>
                    <tr className="border border-gray-400 bg-gray-100">
                      <th className="border border-gray-400 px-3 py-1.5 text-left font-bold uppercase text-xs text-gray-900">Parcelle</th>
                      <th className="border border-gray-400 px-3 py-1.5 text-left font-bold uppercase text-xs text-gray-900">Bail</th>
                      <th className="border border-gray-400 px-3 py-1.5 text-center font-bold uppercase text-xs w-28 text-gray-900">Récolté</th>
                      <th className="border border-gray-400 px-3 py-1.5 text-center font-bold uppercase text-xs w-28 text-gray-900">Part due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.parcelles.map(p => (
                      <tr key={p.id} className="border border-gray-300">
                        <td className="border border-gray-300 px-3 py-1.5 font-medium uppercase text-gray-900">
                          {p.nom}
                          {p.commune && <span className="font-normal text-gray-400 normal-case text-xs ml-1">({p.commune})</span>}
                        </td>
                        <td className="border border-gray-300 px-3 py-1.5 text-gray-600 text-xs">{LIBELLE_TAUX[p.taux] || p.taux}</td>
                        <td className="border border-gray-300 px-3 py-1.5 text-center text-gray-700">{kg(p.poids_total)} kg</td>
                        <td className="border border-gray-300 px-3 py-1.5 text-center font-semibold text-gray-900">{kg(p.part_kg)} kg</td>
                      </tr>
                    ))}
                    <tr className="border border-gray-400 bg-amber-50 print-subtotal-row">
                      <td className="border border-gray-400 px-3 py-1.5 text-xs font-bold text-gray-600 uppercase" colSpan={3}>
                        Total dû à {b.bailleur}
                      </td>
                      <td className="border border-gray-400 px-3 py-1.5 text-center font-bold text-gray-900">{kg(b.total_part)} kg</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            ))}

            {data.bailleurs.length > 1 && (
              <div className="rounded-xl bg-gray-200 print-total-row px-4 py-3 flex items-center justify-between">
                <p className="font-bold text-sm text-gray-900 uppercase">
                  Total général — {data.bailleurs.length} bailleurs
                </p>
                <p className="font-bold text-gray-900">{kg(data.total_part)} kg</p>
              </div>
            )}

            <p className="text-xs text-gray-400 pt-2">
              Part calculée sur la récolte enregistrée dans l'application pour la
              saison {annee}. Le quart franc champenois et le tiers s'entendent
              sans participation du bailleur aux charges d'exploitation.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
