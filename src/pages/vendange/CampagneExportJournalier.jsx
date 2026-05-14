import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, List, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../lib/api'

async function downloadPdf(annee, setDownloading) {
  setDownloading(true)
  try {
    const token = localStorage.getItem('adx_token')
    const res = await fetch(`/api/campagnes/${annee}/pdf-journalier`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Erreur PDF')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `vendanges-${annee}-journalier.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Impossible de générer le PDF : ' + e.message)
  } finally {
    setDownloading(false)
  }
}

export default function CampagneExportJournalier() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    api.get(`/campagnes/${annee}/export-journalier`).then(d => { setData(d); setLoading(false) })
  }, [annee])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <Loader2 size={28} className="animate-spin text-amber-500" />
      <p className="text-sm">Chargement...</p>
    </div>
  )
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <p>Export introuvable.</p>
    </div>
  )

  const dlBtn = (full) => (
    <button
      onClick={() => downloadPdf(annee, setDownloading)}
      disabled={downloading}
      className={`flex items-center gap-1.5 bg-amber-500 text-white px-3 ${full ? 'py-2 flex-1 justify-center' : 'py-1.5'} rounded-xl text-sm font-semibold disabled:opacity-60`}
    >
      {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {downloading ? 'Génération…' : 'Télécharger PDF'}
    </button>
  )

  return (
    <div className="min-h-screen bg-white">

      {/* ── En-tête ── */}
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/vendange/${annee}`)}
                  className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-sm shrink-0">
            <ArrowLeft size={18} /> Retour
          </button>
          <p className="flex-1 text-center font-bold text-gray-900 dark:text-gray-100 text-sm">
            Journalier {annee}
          </p>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button onClick={() => navigate(`/vendange/${annee}/export`)}
                    className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-xl text-sm font-medium">
              <List size={14} /> Par parcelle
            </button>
            {dlBtn(false)}
          </div>
        </div>
        <div className="flex gap-2 md:hidden">
          <button onClick={() => navigate(`/vendange/${annee}/export`)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm font-medium">
            <List size={14} /> Par parcelle
          </button>
          {dlBtn(true)}
        </div>
      </div>

      <div className="light-content px-4 py-6 space-y-6 max-w-2xl mx-auto">

        {data.jours.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Aucun chargement enregistré.</p>
        ) : (
          data.jours.map(jour => <JourSection key={jour.date} jour={jour} />)
        )}

        {data.jours.length > 1 && (
          <div>
            {/* Mobile */}
            <div className="md:hidden rounded-xl bg-gray-200 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-gray-900 uppercase">Total général</p>
                <p className="text-xs text-gray-500">{data.jours.length} jours</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-gray-900">{data.total_caisses}c</p>
                <p className="font-bold text-sm text-gray-900">{Number(data.total_poids).toFixed(0)} kg</p>
              </div>
            </div>
            {/* Desktop */}
            <table className="hidden md:table w-full border-collapse text-sm">
              <tbody>
                <tr className="border border-gray-400 bg-gray-200">
                  <td className="border border-gray-400 px-3 py-2 font-bold uppercase text-gray-900">
                    TOTAL GÉNÉRAL — {data.jours.length} jour{data.jours.length > 1 ? 's' : ''}
                  </td>
                  <td className="border border-gray-400 px-3 py-2 text-center font-bold text-gray-900">{data.total_caisses}c</td>
                  <td className="border border-gray-400 px-3 py-2 text-center font-bold text-gray-900">{Number(data.total_poids).toFixed(0)} kg</td>
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
    <div>
      <div className="flex items-center gap-3 mb-2">
        <p className="font-bold text-gray-900 capitalize">{dateLabel}</p>
        <div className="flex-1 h-px bg-gray-300" />
        <p className="text-sm font-semibold text-gray-500 md:hidden">
          {jour.total_caisses}c · {Number(jour.total_poids).toFixed(0)} kg
        </p>
      </div>

      {/* Mobile : cards */}
      <div className="md:hidden space-y-1.5">
        {jour.chargements.map(c => (
          <div key={c.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 tabular-nums w-10 shrink-0">
                {c.heure_livraison ? c.heure_livraison.slice(0, 5) : '—'}
              </span>
              <span className="font-medium text-sm text-gray-900 uppercase">
                {c.parcelle_nom || '—'}
                {c.commune && <span className="font-normal text-gray-400 normal-case text-xs ml-1">({c.commune})</span>}
              </span>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-xs text-gray-500">{c.nombre_caisses}c</p>
              <p className="font-semibold text-sm text-gray-900">{c.poids_kg} kg</p>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-2.5">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total du jour</span>
          <span className="font-bold text-sm text-gray-900">
            {jour.total_caisses}c · {Number(jour.total_poids).toFixed(0)} kg
          </span>
        </div>
      </div>

      {/* Desktop : tableau */}
      <table className="hidden md:table w-full border-collapse text-sm">
        <thead>
          <tr className="border border-gray-400 bg-gray-100">
            <th className="border border-gray-400 px-3 py-1.5 text-left font-bold uppercase text-xs w-16 text-gray-900">Heure</th>
            <th className="border border-gray-400 px-3 py-1.5 text-left font-bold uppercase text-xs text-gray-900">Parcelle</th>
            <th className="border border-gray-400 px-3 py-1.5 text-center font-bold uppercase text-xs w-16 text-gray-900">Caisses</th>
            <th className="border border-gray-400 px-3 py-1.5 text-center font-bold uppercase text-xs w-20 text-gray-900">Poids</th>
          </tr>
        </thead>
        <tbody>
          {jour.chargements.map(c => (
            <tr key={c.id} className="border border-gray-300">
              <td className="border border-gray-300 px-3 py-1.5 text-gray-500 tabular-nums text-xs">
                {c.heure_livraison ? c.heure_livraison.slice(0, 5) : '—'}
              </td>
              <td className="border border-gray-300 px-3 py-1.5 font-medium uppercase text-gray-900">
                {c.parcelle_nom || '—'}
                {c.commune && <span className="font-normal text-gray-400 normal-case text-xs ml-1">({c.commune})</span>}
              </td>
              <td className="border border-gray-300 px-3 py-1.5 text-center font-semibold text-gray-900">{c.nombre_caisses}</td>
              <td className="border border-gray-300 px-3 py-1.5 text-center font-semibold text-gray-900">{c.poids_kg} kg</td>
            </tr>
          ))}
          <tr className="border border-gray-400 bg-amber-50">
            <td className="border border-gray-400 px-3 py-1.5 text-xs font-bold text-gray-600 uppercase" colSpan={2}>Total du jour</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center font-bold text-gray-900">{jour.total_caisses}</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center font-bold text-gray-900">{Number(jour.total_poids).toFixed(0)} kg</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
