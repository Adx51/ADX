import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, ArrowLeft, Loader2, CalendarDays, Download } from 'lucide-react'
import { api } from '../../lib/api'
import GroupeParcelles from '../../components/RapportParcelles'

async function downloadPdf(annee, setDownloading) {
  setDownloading(true)
  try {
    const token = localStorage.getItem('adx_token')
    const res = await fetch(`/api/campagnes/${annee}/pdf-export`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Erreur PDF')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `vendanges-${annee}-parcelles.pdf`
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

export default function CampagneExport() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    api.get(`/campagnes/${annee}/export`).then(d => { setData(d); setLoading(false) })
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
            Export Vendange {annee}
          </p>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button onClick={() => navigate(`/vendange/${annee}/export-journalier`)}
                    className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-xl text-sm font-medium">
              <CalendarDays size={14} /> Journalier
            </button>
            {dlBtn(false)}
          </div>
        </div>
        <div className="flex gap-2 md:hidden">
          <button onClick={() => navigate(`/vendange/${annee}/export-journalier`)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm font-medium">
            <CalendarDays size={14} /> Journalier
          </button>
          {dlBtn(true)}
        </div>
      </div>

      {/* ── Aperçu (toujours en mode clair) ── */}
      <div className="light-content px-4 py-6 space-y-8 max-w-2xl mx-auto">
        {data.groupes.map((groupe) => (
          <GroupeParcelles key={groupe.pressoir} annee={annee}
                           titre={`PARCELLES DE ${groupe.pressoir.toUpperCase()}`}
                           parcelles={groupe.parcelles} />
        ))}
      </div>
    </div>
  )
}
