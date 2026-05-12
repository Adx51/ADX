import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, ArrowLeft, Loader2, CalendarDays } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../lib/api'
import { caToDisplayHa, rendementKgHa } from '../../lib/surface'

export default function CampagneExport() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/campagnes/${annee}/export`).then(d => {
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
        <p className="font-semibold text-gray-900">Export Vendange {annee}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/vendange/${annee}/export-journalier`)}
                  className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium active:bg-gray-50">
            <CalendarDays size={15} />
            Journalier
          </button>
          <button onClick={() => window.print()}
                  className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold active:bg-amber-600">
            <Printer size={16} />
            Imprimer
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-10 max-w-2xl mx-auto print:px-0 print:py-0 print:max-w-none print:space-y-8">
        {data.groupes.map(groupe => (
          <GroupeSection key={groupe.pressoir} groupe={groupe} annee={annee} />
        ))}
      </div>
    </div>
  )
}

function GroupeSection({ groupe, annee }) {
  const parcelles = groupe.parcelles.filter(p => p.vendange_id)
  const totalSurface = groupe.parcelles.reduce((s, p) => s + (p.surface_totale_ca || 0), 0)
  const totalPoids = parcelles.reduce((s, p) => s + (p.poids_total || 0), 0)
  const totalCaisses = parcelles.reduce((s, p) => s + (p.nb_caisses_total || 0), 0)

  return (
    <div className="print:break-inside-avoid">
      <div className="text-center mb-4">
        <p className="font-bold text-lg text-gray-900 uppercase tracking-wide">
          VENDANGES {annee}
        </p>
        <p className="font-bold text-base text-gray-700 uppercase tracking-wide">
          PARCELLES DE {groupe.pressoir.toUpperCase()}
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border border-gray-900">
            <th className="border border-gray-900 px-3 py-2 text-left font-bold uppercase w-2/5">Nom</th>
            <th className="border border-gray-900 px-3 py-2 text-center font-bold uppercase">Poids</th>
            <th className="border border-gray-900 px-3 py-2 text-center font-bold uppercase w-28">Moyenne</th>
          </tr>
        </thead>
        <tbody>
          {groupe.parcelles.map(p => (
            <ParcelleRows key={p.parcelle_id} parcelle={p} />
          ))}
          <tr className="border border-gray-900 bg-gray-50">
            <td className="border border-gray-900 px-3 py-2 font-bold uppercase">
              TOTAL — {caToDisplayHa(totalSurface)}
            </td>
            <td className="border border-gray-900 px-3 py-2 text-center font-bold">
              {totalCaisses}c &nbsp; {totalPoids.toFixed(0)} kg
            </td>
            <td className="border border-gray-900 px-3 py-2 text-center font-bold">
              {rendementKgHa(totalPoids, totalSurface)
                ? `${rendementKgHa(totalPoids, totalSurface).toLocaleString('fr-FR')} kg/ha`
                : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function ParcelleRows({ parcelle }) {
  const hasVendange = Boolean(parcelle.vendange_id)
  const rendement = hasVendange ? rendementKgHa(parcelle.poids_total, parcelle.surface_totale_ca) : null
  const chargements = parcelle.chargements || []

  if (!hasVendange) {
    return (
      <tr className="border border-gray-300">
        <td className="border border-gray-300 px-3 py-2 text-gray-400 italic">
          {parcelle.nom} — {caToDisplayHa(parcelle.surface_totale_ca)}
        </td>
        <td className="border border-gray-300 px-3 py-2 text-center text-gray-400 text-xs italic">
          Non commencé
        </td>
        <td className="border border-gray-300" />
      </tr>
    )
  }

  if (chargements.length === 0) {
    return (
      <tr className="border border-gray-300">
        <td className="border border-gray-300 px-3 py-2 font-semibold uppercase">
          {parcelle.nom}
          <br />
          <span className="font-normal text-xs text-gray-500">{caToDisplayHa(parcelle.surface_totale_ca)}</span>
        </td>
        <td className="border border-gray-300 px-3 py-2 text-center text-gray-400 text-xs italic">
          Aucun chargement
        </td>
        <td className="border border-gray-300 px-3 py-2 text-center">—</td>
      </tr>
    )
  }

  const hasMultiple = chargements.length > 1
  const rowSpan = chargements.length + (hasMultiple ? 1 : 0)

  return (
    <>
      {chargements.map((c, idx) => (
        <tr key={c.id} className="border border-gray-300">
          {idx === 0 && (
            <td className="border border-gray-300 px-3 py-1.5 font-semibold uppercase align-top"
                rowSpan={rowSpan}>
              {parcelle.nom}
              <br />
              <span className="font-normal text-xs text-gray-500">{caToDisplayHa(parcelle.surface_totale_ca)}</span>
            </td>
          )}
          <td className="border border-gray-300 px-3 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs tabular-nums w-10">
                {c.heure_livraison ? c.heure_livraison.slice(0, 5) : format(parseISO(c.date_chargement), 'dd/MM', { locale: fr })}
              </span>
              <span className="font-medium">{c.nombre_caisses}c &nbsp; {c.poids_kg} kg</span>
            </div>
          </td>
          {idx === 0 && (
            <td className="border border-gray-300 px-3 py-1.5 text-center font-semibold align-middle"
                rowSpan={rowSpan}>
              {rendement ? `${rendement.toLocaleString('fr-FR')} kg/ha` : '—'}
            </td>
          )}
        </tr>
      ))}
      {hasMultiple && (
        <tr className="bg-amber-50">
          <td className="border border-gray-300 px-3 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total</span>
              <span className="font-bold text-gray-800">
                {chargements.reduce((s, c) => s + (c.nombre_caisses || 0), 0)}c &nbsp; {parcelle.poids_total?.toFixed(0)} kg
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
