import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Edit2, Trash2, Share2, MapPin, Grape, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { caToDisplay, rendementKgHa } from '../../lib/surface'
import PageHeader from '../../components/PageHeader'

export default function ParcelleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [parcelle, setParcelle] = useState(null)
  const [vendanges, setVendanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: v }] = await Promise.all([
        supabase.from('parcelles').select('*').eq('id', id).single(),
        supabase.from('vendanges').select('*').eq('parcelle_id', id).order('annee', { ascending: false })
      ])
      setParcelle(p)
      setVendanges(v || [])
      setLoading(false)
    }
    load()
  }, [id])

  function shareGPS() {
    if (!parcelle?.gps_lat || !parcelle?.gps_lng) return
    const url = `https://maps.google.com/?q=${parcelle.gps_lat},${parcelle.gps_lng}`
    if (navigator.share) {
      navigator.share({ title: parcelle.nom, url })
    } else {
      navigator.clipboard.writeText(url)
      alert('Lien GPS copié dans le presse-papier')
    }
  }

  async function deleteParcelle() {
    await supabase.from('parcelles').delete().eq('id', id)
    navigate('/parcelles')
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Chargement..." back="/parcelles" />
        <div className="px-4 pt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card skeleton h-16" />)}
        </div>
      </div>
    )
  }

  if (!parcelle) {
    return (
      <div>
        <PageHeader title="Parcelle introuvable" back="/parcelles" />
        <p className="text-center py-8 text-gray-500">Cette parcelle n'existe pas.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={parcelle.nom} back="/parcelles">
        <button onClick={() => navigate(`/parcelles/${id}/edit`)}
                className="p-2 rounded-full active:bg-vigne-600">
          <Edit2 size={18} />
        </button>
      </PageHeader>

      {/* Photo */}
      {parcelle.photo_url && (
        <img src={parcelle.photo_url} alt={parcelle.nom}
             className="w-full h-52 object-cover" />
      )}

      <div className="px-4 pt-4 space-y-4">
        {/* Infos principales */}
        <div className="card space-y-3">
          <InfoRow label="Surface totale" value={caToDisplay(parcelle.surface_totale_ca)} />
          <InfoRow label="Surface plantée" value={caToDisplay(parcelle.surface_plantee_ca)} />
          {parcelle.nombre_routes && (
            <InfoRow label="Nombre de routes" value={`${parcelle.nombre_routes} routes`} />
          )}
          {parcelle.cepage && (
            <InfoRow label="Cépage" value={parcelle.cepage} />
          )}
          {parcelle.notes && (
            <InfoRow label="Notes" value={parcelle.notes} />
          )}
        </div>

        {/* GPS */}
        {parcelle.gps_lat && (
          <button onClick={shareGPS}
                  className="card w-full flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Position GPS</p>
              <p className="text-xs text-gray-400">{parcelle.gps_lat?.toFixed(6)}, {parcelle.gps_lng?.toFixed(6)}</p>
            </div>
            <Share2 size={18} className="text-gray-400" />
          </button>
        )}

        {/* Historique vendanges */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Historique vendanges</h2>
            <Link to={`/vendange/new?parcelle=${id}`}
                  className="text-vigne-700 text-sm font-semibold">
              + Ajouter
            </Link>
          </div>

          {vendanges.length === 0 ? (
            <div className="card text-center py-6">
              <Grape size={32} className="mx-auto text-vigne-300 mb-2" />
              <p className="text-gray-500 text-sm">Aucune vendange enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vendanges.map(v => {
                const rendement = rendementKgHa(v.poids_total, parcelle.surface_plantee_ca)
                return (
                  <button key={v.id} onClick={() => navigate(`/vendange/${v.id}`)}
                          className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-amber-700 text-sm">{v.annee}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{v.poids_total?.toFixed(0)} kg</p>
                      <p className="text-xs text-gray-500">
                        {v.nb_caisses_total} caisses
                        {rendement && <span className="text-vigne-600"> · {rendement.toLocaleString('fr-FR')} kg/ha</span>}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Supprimer */}
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-2 text-red-500 py-3 text-sm font-medium">
            <Trash2 size={16} />
            Supprimer cette parcelle
          </button>
        ) : (
          <div className="card border-red-200 bg-red-50 space-y-3">
            <p className="text-red-700 font-medium text-sm text-center">
              Supprimer définitivement {parcelle.nom} ?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary py-2 text-sm">
                Annuler
              </button>
              <button onClick={deleteParcelle} className="btn-danger py-2 text-sm">
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || '—'}</span>
    </div>
  )
}
