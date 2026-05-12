import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Edit2, Trash2, Share2, MapPin, Grape, ChevronRight, MessageSquare, Navigation } from 'lucide-react'
import { api } from '../../lib/api'
import { caToDisplay, rendementKgHa } from '../../lib/surface'
import { locateFromCadastre } from '../../lib/cadastre'
import PageHeader from '../../components/PageHeader'
import MapPicker from '../../components/MapPicker'

export default function ParcelleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [parcelle, setParcelle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [geoFeatures, setGeoFeatures] = useState(null)

  useEffect(() => {
    api.get(`/parcelles/${id}`).then(data => {
      setParcelle(data)
      setLoading(false)
    })
  }, [id])

  // Récupère le polygone cadastral pour l'afficher en vert sur la carte
  useEffect(() => {
    if (!parcelle?.reference_cadastrale || !parcelle?.commune) return
    let cancelled = false
    api.get('/referentiels/commune').then(communes => {
      const commune = communes?.find(c => c.valeur === parcelle.commune)
      if (!commune?.code_insee) return
      locateFromCadastre(commune.code_insee, parcelle.reference_cadastrale)
        .then(({ features }) => { if (!cancelled) setGeoFeatures(features) })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [parcelle?.reference_cadastrale, parcelle?.commune])

  function mapsUrl() {
    return `https://maps.google.com/?q=${parcelle.gps_lat},${parcelle.gps_lng}`
  }

  function navigateToParcel() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${parcelle.gps_lat},${parcelle.gps_lng}`
    window.open(url, '_blank')
  }

  async function shareGPS() {
    if (!parcelle?.gps_lat || !parcelle?.gps_lng) return
    const url = mapsUrl()
    const text = `📍 Parcelle ${parcelle.nom} : ${url}`
    try {
      if (navigator.share) {
        await navigator.share({ title: parcelle.nom, text, url })
        return
      }
    } catch {}
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank')
  }

  function sendSMS() {
    if (!parcelle?.gps_lat || !parcelle?.gps_lng) return
    const text = `📍 Parcelle ${parcelle.nom} : ${mapsUrl()}`
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank')
  }

  async function deleteParcelle() {
    await api.delete(`/parcelles/${id}`)
    navigate('/parcelles')
  }

  if (loading) return (
    <div>
      <PageHeader title="Chargement..." back="/parcelles" />
      <div className="px-4 pt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card skeleton h-16" />)}
      </div>
    </div>
  )

  if (!parcelle) return (
    <div>
      <PageHeader title="Introuvable" back="/parcelles" />
      <p className="text-center py-8 text-gray-500">Cette parcelle n'existe pas.</p>
    </div>
  )

  return (
    <div>
      <PageHeader title={parcelle.nom} back="/parcelles">
        <button onClick={() => navigate(`/parcelles/${id}/edit`)}
                className="p-2 rounded-full active:bg-vigne-600">
          <Edit2 size={18} />
        </button>
      </PageHeader>

      {parcelle.photo_url && (
        <img src={parcelle.photo_url} alt={parcelle.nom} className="w-full h-52 object-cover" />
      )}

      <div className="px-4 pt-4 space-y-4">
        <div className="card space-y-3">
          <InfoRow label="Surface totale"  value={caToDisplay(parcelle.surface_totale_ca)} />
          <InfoRow label="Surface plantée" value={caToDisplay(parcelle.surface_plantee_ca)} />
          <InfoRow label="Nombre de routes" value={parcelle.nombre_routes != null ? `${parcelle.nombre_routes} routes` : null} />
          {parcelle.commune              && <InfoRow label="Commune"           value={parcelle.commune} />}
          {parcelle.reference_cadastrale && <InfoRow label="Réf. cadastrale"  value={parcelle.reference_cadastrale} />}
          {Array.isArray(parcelle.cepages) && parcelle.cepages.length > 0 &&
            <InfoRow label="Cépages" value={parcelle.cepages.join(', ')} />}
          {parcelle.annee_plantation     && <InfoRow label={parcelle.statut === 'replantee' ? 'Année plantation' : 'Année arrachage'} value={parcelle.annee_plantation} />}
          {parcelle.notes                && <InfoRow label="Notes"             value={parcelle.notes} />}
        </div>

        {parcelle.gps_lat && (
          <div className="card space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MapPin size={20} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Position GPS</p>
                <p className="text-xs text-gray-400">
                  {Number(parcelle.gps_lat).toFixed(6)}, {Number(parcelle.gps_lng).toFixed(6)}
                </p>
              </div>
            </div>
            <MapPicker lat={parcelle.gps_lat} lng={parcelle.gps_lng} geoFeatures={geoFeatures} readOnly />
            <div className="grid grid-cols-3 gap-2">
              <button onClick={navigateToParcel}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-medium active:bg-blue-700">
                <Navigation size={16} />
                Y aller
              </button>
              <button onClick={shareGPS}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 active:bg-gray-50">
                <Share2 size={16} />
                Partager
              </button>
              <button onClick={sendSMS}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 active:bg-gray-50">
                <MessageSquare size={16} />
                SMS
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Historique vendanges</h2>
            <Link to={`/vendange/new?parcelle=${id}`} className="text-vigne-700 text-sm font-semibold">
              + Ajouter
            </Link>
          </div>

          {(!parcelle.vendanges || parcelle.vendanges.length === 0) ? (
            <div className="card text-center py-6">
              <Grape size={32} className="mx-auto text-vigne-300 mb-2" />
              <p className="text-gray-500 text-sm">Aucune vendange enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {parcelle.vendanges.map(v => {
                const rendement = rendementKgHa(v.poids_total, parcelle.surface_plantee_ca)
                return (
                  <button key={v.id} onClick={() => navigate(`/vendange/${v.id}`)}
                          className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-amber-700 text-sm">{v.annee}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{Number(v.poids_total || 0).toFixed(0)} kg</p>
                      <p className="text-xs text-gray-500">
                        {v.nb_caisses_total || 0} caisses
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
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary py-2 text-sm">Annuler</button>
              <button onClick={deleteParcelle} className="btn-danger py-2 text-sm">Supprimer</button>
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
