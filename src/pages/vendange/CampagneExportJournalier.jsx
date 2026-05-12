import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, ArrowLeft, Loader2, List } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../lib/api'

export default function CampagneExportJournalier() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/campagnes/${annee}/export-journalier`).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [annee])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <Loader2 size={28} className="animate-spin text-amber-500" />
      <p className="text-sm">Génération de l'export...</p>
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <p>Export introuvable.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <button onClick={() => navigate(`/vendange/${annee}`)}
                className="flex items-center gap-2 text-gray-600 font-medium text-sm">
          <ArrowLeft size={18} />
          Retour
        </button>
        <p className="font-semibold text-gray-900">Journalier {annee}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/vendange/${annee}/export`)}
                  className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium active:bg-gray-50">
            <List size={15} />
            Par parcelle
          </button>
          <button onClick={() => window.print()}
                  className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold active:bg-amber-600">
            <Printer size={16} />
            Imprimer
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8 max-w-2xl mx-auto print:px-0 print:py-0 print:max-w-none print:space-y-6">

        {/* En-tête imprimé */}
        <div className="text-center print:block hidden">
          <p className="font-bold text-lg uppercase tracking-wide">VENDANGES {annee}</p>
          <p className="font-bold text-base uppercase tracking-wide text-gray-600">BILAN JOURNALIER</p>
        </div>

        {data.jours.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Aucun chargement enregistré.</p>
        ) : (
          data.jours.map(jour => (
            <JourSection key={jour.date} jour={jour} />
          ))
        )}

        {/* Récap général */}
        {data.jours.length > 1 && (
          <div className="print:break-inside-avoid">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border border-gray-900 bg-gray-100">
                  <td className="border border-gray-900 px-3 py-2 font-bold uppercase">
                    TOTAL GÉNÉRAL — {data.jours.length} jour{data.jours.length > 1 ? 's' : ''}
                  </td>
                  <td className="border border-gray-900 px-3 py-2 text-center font-bold">
                    {data.total_caisses}c
                  </td>
                  <td className="border border-gray-900 px-3 py-2 text-center font-bold">
                    {Number(data.total_poids).toFixed(0)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function JourSection({ jour }) {
  const dateLabel = format(parseISO(jour.date), 'EEEE d MMMM yyyy', { locale: fr })

  return (
    <div className="print:break-inside-avoid">
      <div className="flex items-center gap-3 mb-2 print:mb-1">
        <p className="font-bold text-gray-900 capitalize">{dateLabel}</p>
        <div className="flex-1 h-px bg-gray-300" />
        <p className="text-sm font-semibold text-gray-600 print:hidden">
          {jour.total_caisses}c · {Number(jour.total_poids).toFixed(0)} kg
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border border-gray-800 bg-gray-50">
            <th className="border border-gray-800 px-3 py-1.5 text-left font-bold uppercase text-xs w-16">Heure</th>
            <th className="border border-gray-800 px-3 py-1.5 text-left font-bold uppercase text-xs">Parcelle</th>
            <th className="border border-gray-800 px-3 py-1.5 text-center font-bold uppercase text-xs w-16">Caisses</th>
            <th className="border border-gray-800 px-3 py-1.5 text-center font-bold uppercase text-xs w-20">Poids</th>
          </tr>
        </thead>
        <tbody>
          {jour.chargements.map(c => (
            <tr key={c.id} className="border border-gray-300">
              <td className="border border-gray-300 px-3 py-1.5 text-gray-500 tabular-nums text-xs">
                {c.heure_livraison ? c.heure_livraison.slice(0, 5) : '—'}
              </td>
              <td className="border border-gray-300 px-3 py-1.5 font-medium uppercase">
                {c.parcelle_nom || '—'}
                {c.commune && <span className="font-normal text-gray-400 normal-case text-xs ml-1">({c.commune})</span>}
              </td>
              <td className="border border-gray-300 px-3 py-1.5 text-center font-semibold">
                {c.nombre_caisses}
              </td>
              <td className="border border-gray-300 px-3 py-1.5 text-center font-semibold">
                {c.poids_kg} kg
              </td>
            </tr>
          ))}
          <tr className="border border-gray-800 bg-amber-50">
            <td className="border border-gray-800 px-3 py-1.5 text-xs font-bold text-gray-600 uppercase" colSpan={2}>
              Total du jour
            </td>
            <td className="border border-gray-800 px-3 py-1.5 text-center font-bold">
              {jour.total_caisses}
            </td>
            <td className="border border-gray-800 px-3 py-1.5 text-center font-bold">
              {Number(jour.total_poids).toFixed(0)} kg
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
