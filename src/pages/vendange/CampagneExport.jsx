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
    api.get(`/campagnes/${annee}/export`).then(d => { setData(d); setLoading(false) })
  }, [annee])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500 dark:text-gray-400 dark:bg-gray-900">
      <Loader2 size={28} className="animate-spin text-amber-500" />
      <p className="text-sm">Génération de l'export...</p>
    </div>
  )
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500 dark:text-gray-400 dark:bg-gray-900">
      <p>Export introuvable.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:bg-white">

      {/* ── En-tête ── */}
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
        {/* Ligne 1 : retour + titre */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/vendange/${annee}`)}
                  className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-sm shrink-0">
            <ArrowLeft size={18} /> Retour
          </button>
          <p className="flex-1 text-center font-bold text-gray-900 dark:text-gray-100 text-sm">
            Export Vendange {annee}
          </p>
          {/* Boutons inline sur ≥ md */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button onClick={() => navigate(`/vendange/${annee}/export-journalier`)}
                    className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-xl text-sm font-medium">
              <CalendarDays size={14} /> Journalier
            </button>
            <button onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold">
              <Printer size={14} /> Imprimer
            </button>
          </div>
        </div>
        {/* Ligne 2 : boutons sur mobile */}
        <div className="flex gap-2 md:hidden">
          <button onClick={() => navigate(`/vendange/${annee}/export-journalier`)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm font-medium">
            <CalendarDays size={14} /> Journalier
          </button>
          <button onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Printer size={14} /> Imprimer
          </button>
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="px-4 py-6 space-y-8 max-w-2xl mx-auto print:px-0 print:py-0 print:max-w-none print:space-y-8">
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
  const totalPoids   = parcelles.reduce((s, p) => s + (p.poids_total || 0), 0)
  const totalCaisses = parcelles.reduce((s, p) => s + (p.nb_caisses_total || 0), 0)
  const rendTotal    = rendementKgHa(totalPoids, totalSurface)

  return (
    <div className="print:break-inside-avoid">
      <div className="text-center mb-3">
        <p className="font-bold text-base text-gray-900 dark:text-gray-100 uppercase tracking-wide print:text-gray-900">
          VENDANGES {annee}
        </p>
        <p className="font-semibold text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide print:text-gray-700">
          PARCELLES DE {groupe.pressoir.toUpperCase()}
        </p>
      </div>

      {/* ── Vue mobile : cards ── */}
      <div className="md:hidden print:hidden space-y-2">
        {groupe.parcelles.map(p => <ParcelleMobileCard key={p.parcelle_id} parcelle={p} />)}
        {/* Total groupe */}
        <div className="rounded-xl bg-gray-200 dark:bg-gray-700 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase">Total</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{caToDisplayHa(totalSurface)}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{totalCaisses}c · {totalPoids.toFixed(0)} kg</p>
            {rendTotal && <p className="text-xs text-amber-600 dark:text-amber-400">{rendTotal.toLocaleString('fr-FR')} kg/ha</p>}
          </div>
        </div>
      </div>

      {/* ── Vue desktop + impression : tableau ── */}
      <table className="hidden md:table print:table w-full border-collapse text-sm">
        <thead>
          <tr className="border border-gray-400 dark:border-gray-500 print:border-gray-900">
            <th className="border border-gray-400 dark:border-gray-500 print:border-gray-900 px-3 py-2 text-left font-bold uppercase w-2/5 text-gray-900 dark:text-gray-100 print:text-gray-900">Nom</th>
            <th className="border border-gray-400 dark:border-gray-500 print:border-gray-900 px-3 py-2 text-center font-bold uppercase text-gray-900 dark:text-gray-100 print:text-gray-900">Poids</th>
            <th className="border border-gray-400 dark:border-gray-500 print:border-gray-900 px-3 py-2 text-center font-bold uppercase w-28 text-gray-900 dark:text-gray-100 print:text-gray-900">Moyenne</th>
          </tr>
        </thead>
        <tbody>
          {groupe.parcelles.map(p => <ParcelleTableRows key={p.parcelle_id} parcelle={p} />)}
          <tr className="border border-gray-400 dark:border-gray-500 print:border-gray-900 bg-gray-100 dark:bg-gray-700 print:bg-gray-100">
            <td className="border border-gray-400 dark:border-gray-500 print:border-gray-900 px-3 py-2 font-bold uppercase text-gray-900 dark:text-gray-100 print:text-gray-900">
              TOTAL — {caToDisplayHa(totalSurface)}
            </td>
            <td className="border border-gray-400 dark:border-gray-500 print:border-gray-900 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-100 print:text-gray-900">
              {totalCaisses}c &nbsp; {totalPoids.toFixed(0)} kg
            </td>
            <td className="border border-gray-400 dark:border-gray-500 print:border-gray-900 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-100 print:text-gray-900">
              {rendTotal ? `${rendTotal.toLocaleString('fr-FR')} kg/ha` : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function ParcelleMobileCard({ parcelle }) {
  const hasVendange  = Boolean(parcelle.vendange_id)
  const chargements  = parcelle.chargements || []
  const rendement    = hasVendange ? rendementKgHa(parcelle.poids_total, parcelle.surface_totale_ca) : null

  if (!hasVendange) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 uppercase">{parcelle.nom}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{caToDisplayHa(parcelle.surface_totale_ca)}</p>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Non commencé</p>
      </div>
    )
  }

  const hasMultiple = chargements.length > 1

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* En-tête parcelle */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800">
        <div>
          <p className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase">{parcelle.nom}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{caToDisplayHa(parcelle.surface_totale_ca)}</p>
        </div>
        {rendement && (
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {rendement.toLocaleString('fr-FR')} kg/ha
          </p>
        )}
      </div>
      {/* Chargements */}
      {chargements.length === 0 ? (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-400 italic">Aucun chargement</p>
        </div>
      ) : (
        <>
          {chargements.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-10">
                {c.heure_livraison ? c.heure_livraison.slice(0, 5) : format(parseISO(c.date_chargement), 'dd/MM', { locale: fr })}
              </span>
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {c.nombre_caisses}c · {c.poids_kg} kg
              </span>
            </div>
          ))}
          {hasMultiple && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-600 bg-amber-50 dark:bg-amber-900/20">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</span>
              <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                {chargements.reduce((s, c) => s + (c.nombre_caisses || 0), 0)}c · {parcelle.poids_total?.toFixed(0)} kg
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ParcelleTableRows({ parcelle }) {
  const hasVendange = Boolean(parcelle.vendange_id)
  const rendement   = hasVendange ? rendementKgHa(parcelle.poids_total, parcelle.surface_totale_ca) : null
  const chargements = parcelle.chargements || []

  if (!hasVendange) return (
    <tr className="border border-gray-300 dark:border-gray-600 print:border-gray-300">
      <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-2 text-gray-400 dark:text-gray-500 italic">
        {parcelle.nom} — {caToDisplayHa(parcelle.surface_totale_ca)}
      </td>
      <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-2 text-center text-gray-400 dark:text-gray-500 text-xs italic">Non commencé</td>
      <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300" />
    </tr>
  )

  if (chargements.length === 0) return (
    <tr className="border border-gray-300 dark:border-gray-600 print:border-gray-300">
      <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-2 font-semibold uppercase text-gray-900 dark:text-gray-100 print:text-gray-900">
        {parcelle.nom}<br />
        <span className="font-normal text-xs text-gray-500 dark:text-gray-400">{caToDisplayHa(parcelle.surface_totale_ca)}</span>
      </td>
      <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-2 text-center text-gray-400 dark:text-gray-500 text-xs italic">Aucun chargement</td>
      <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-2 text-center text-gray-900 dark:text-gray-100 print:text-gray-900">—</td>
    </tr>
  )

  const hasMultiple = chargements.length > 1
  const rowSpan = chargements.length + (hasMultiple ? 1 : 0)

  return (
    <>
      {chargements.map((c, idx) => (
        <tr key={c.id} className="border border-gray-300 dark:border-gray-600 print:border-gray-300">
          {idx === 0 && (
            <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-1.5 font-semibold uppercase align-top text-gray-900 dark:text-gray-100 print:text-gray-900" rowSpan={rowSpan}>
              {parcelle.nom}<br />
              <span className="font-normal text-xs text-gray-500 dark:text-gray-400">{caToDisplayHa(parcelle.surface_totale_ca)}</span>
            </td>
          )}
          <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 dark:text-gray-500 text-xs tabular-nums w-10">
                {c.heure_livraison ? c.heure_livraison.slice(0, 5) : format(parseISO(c.date_chargement), 'dd/MM', { locale: fr })}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100 print:text-gray-900">{c.nombre_caisses}c &nbsp;{c.poids_kg} kg</span>
            </div>
          </td>
          {idx === 0 && (
            <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-1.5 text-center font-semibold align-middle text-gray-900 dark:text-gray-100 print:text-gray-900" rowSpan={rowSpan}>
              {rendement ? `${rendement.toLocaleString('fr-FR')} kg/ha` : '—'}
            </td>
          )}
        </tr>
      ))}
      {hasMultiple && (
        <tr className="bg-amber-50 dark:bg-amber-900/20 print:bg-amber-50">
          <td className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-3 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</span>
              <span className="font-bold text-gray-800 dark:text-gray-200 print:text-gray-800">
                {chargements.reduce((s, c) => s + (c.nombre_caisses || 0), 0)}c &nbsp;{parcelle.poids_total?.toFixed(0)} kg
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
