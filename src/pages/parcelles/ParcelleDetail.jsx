import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Edit2, Trash2, Share2, MapPin, Grape, ChevronRight, MessageSquare, Navigation, Expand, Sprout, CheckSquare, Clock, AlertCircle, Check, ChevronDown } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { caToDisplay, rendementKgHa } from '../../lib/surface'
import { getSaison, getSaisonCourante } from '../../lib/saison'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'
import { locateFromCadastre } from '../../lib/cadastre'
import PageHeader from '../../components/PageHeader'
import MapPicker from '../../components/MapPicker'
import PhotoModal from '../../components/PhotoModal'

export default function ParcelleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canDelete = isAdmin || user?.can_delete?.parcelles === true
  const [parcelle, setParcelle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [geoFeatures, setGeoFeatures] = useState(null)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [comparaison, setComparaison] = useState(null)
  const [activite, setActivite] = useState(null)
  const refreshTick = useRefreshTrigger()

  useEffect(() => {
    api.get(`/parcelles/${id}`).then(data => {
      setParcelle(data)
      setLoading(false)
    })
    api.get(`/parcelles/${id}/comparaison-pressoir`)
      .then(setComparaison)
      .catch(() => setComparaison(null))
    api.get(`/parcelles/${id}/activite`)
      .then(setActivite)
      .catch(() => setActivite(null))
  }, [id, refreshTick])

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
    const lat = parcelle.gps_lat
    const lng = parcelle.gps_lng
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    if (isIOS) {
      window.location.href = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
    }
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
        <div className="relative cursor-pointer md:mx-6 md:mt-4 md:rounded-2xl md:overflow-hidden" onClick={() => setPhotoOpen(true)}>
          <img src={parcelle.photo_url} alt={parcelle.nom} className="w-full h-52 md:h-72 object-cover" />
          <div className="absolute bottom-2 right-2 bg-black/40 text-white rounded-lg p-1.5">
            <Expand size={16} />
          </div>
        </div>
      )}
      <PhotoModal url={photoOpen ? parcelle.photo_url : null} onClose={() => setPhotoOpen(false)} />

      <div className="md:px-6 md:pt-5 md:pb-8 md:grid md:grid-cols-5 md:gap-6 md:items-start">
        <div className="px-4 pt-4 space-y-4 md:px-0 md:pt-0 md:col-span-2">
          <div className="card space-y-3">
            <InfoRow label="Surface totale"  value={caToDisplay(parcelle.surface_totale_ca)} />
            <InfoRow label="Surface plantée" value={caToDisplay(parcelle.surface_plantee_ca)} />
            <InfoRow label="Nombre de routes" value={parcelle.nombre_routes != null ? `${parcelle.nombre_routes} routes` : null} />
            {parcelle.commune              && <InfoRow label="Commune"           value={parcelle.commune} />}
            {parcelle.reference_cadastrale && <InfoRow label="Réf. cadastrale"  value={parcelle.reference_cadastrale.replace(/,/g, ', ')} />}
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

          {canDelete && (!confirmDelete ? (
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
          ))}
        </div>

        <div className="px-4 pt-4 space-y-4 md:px-0 md:pt-0 md:col-span-3">
          {activite && (
            <ActiviteSection activite={activite} navigate={navigate} />
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-900">Historique vendanges</h2>
              <Link to="/vendange" className="text-vigne-700 text-sm font-semibold">
                + Voir
              </Link>
            </div>
            {(parcelle.commune || parcelle.commune_pressoir || (Array.isArray(parcelle.cepages) && parcelle.cepages.length > 0)) && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(parcelle.commune_pressoir || parcelle.commune) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-vigne-100 text-vigne-800 text-xs font-semibold">
                    <MapPin size={10} />
                    {parcelle.commune_pressoir || parcelle.commune}
                  </span>
                )}
                {Array.isArray(parcelle.cepages) && parcelle.cepages.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                    <Grape size={10} />
                    {c}
                  </span>
                ))}
              </div>
            )}

            {(!parcelle.vendanges || parcelle.vendanges.length === 0) ? (
              <div className="card text-center py-6">
                <Grape size={32} className="mx-auto text-vigne-300 mb-2" />
                <p className="text-gray-500 text-sm">Aucune vendange enregistrée</p>
              </div>
            ) : (
              <>
                {parcelle.vendanges.length >= 2 && (
                  <div className="card mb-3 p-3">
                    <VendangeChart vendanges={parcelle.vendanges} surfaceCa={parcelle.surface_totale_ca} />
                    <div className="flex items-center gap-4 mt-2 justify-center">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> kg/ha réalisé
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4,2"/></svg>
                        objectif appellation
                      </span>
                    </div>
                  </div>
                )}

                {comparaison?.pressoir && comparaison.annees?.filter(a => a.kgha_parcelle != null).length >= 1 && (
                  <div className="card mb-3 p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">
                      Rendement vs moyenne pressoir <span className="text-vigne-700">{comparaison.pressoir}</span>
                    </p>
                    <ComparaisonChart data={comparaison.annees} />
                    <div className="flex items-center gap-3 mt-2 justify-center flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Cette parcelle
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="inline-block w-3 h-3 rounded-sm bg-vigne-600" /> Moyenne pressoir
                      </span>
                      {comparaison.annees.some(a => a.rendement_attendu_kgha) && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,2"/></svg>
                          Appellation
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {parcelle.vendanges.map((v, i) => {
                    const rendement = rendementKgHa(v.poids_total, parcelle.surface_totale_ca)
                    const prev = parcelle.vendanges[i + 1]
                    const trendPct = prev && prev.poids_total > 0
                      ? Math.round(((v.poids_total - prev.poids_total) / prev.poids_total) * 100)
                      : null
                    return (
                      <button key={v.id} onClick={() => navigate(`/vendange/parcelle/${v.id}`)}
                              className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-amber-700 text-sm">{v.annee}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{Number(v.poids_total || 0).toFixed(0)} kg</p>
                          <p className="text-xs text-gray-500">
                            {v.nb_caisses_total || 0} caisses
                            {rendement && <span className="text-vigne-600"> · {rendement.toLocaleString('fr-FR')} kg/ha</span>}
                            {trendPct !== null && (
                              <span className={`ml-1 font-medium ${trendPct >= 0 ? 'text-vigne-600' : 'text-orange-500'}`}>
                                {' '}({trendPct >= 0 ? '+' : ''}{trendPct}% N-1)
                              </span>
                            )}
                          </p>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const STATUT_TACHE = {
  a_faire:  { label: 'À faire',  color: 'text-gray-500', bg: 'bg-gray-100', Icon: Clock },
  en_cours: { label: 'En cours', color: 'text-blue-600',  bg: 'bg-blue-100', Icon: AlertCircle },
  termine:  { label: 'Terminée', color: 'text-vigne-600', bg: 'bg-vigne-100', Icon: Check },
}

const TYPE_TRAITEMENT = {
  fongicide:   { label: 'Fongicide',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
  insecticide: { label: 'Insecticide',  color: 'text-orange-700',  bg: 'bg-orange-100' },
  herbicide:   { label: 'Herbicide',    color: 'text-yellow-700',  bg: 'bg-yellow-100' },
  biocontrole: { label: 'Biocontrôle',  color: 'text-teal-700',    bg: 'bg-teal-100' },
  autre:       { label: 'Autre',        color: 'text-gray-600',    bg: 'bg-gray-100' },
}

function ActiviteSection({ activite, navigate }) {
  const { taches, traitements } = activite

  const seasons = [...new Set([
    ...taches.map(t => getSaison(t.date_echeance || t.created_at)),
    ...traitements.map(t => getSaison(t.date))
  ].filter(Boolean))].sort((a, b) => b - a)

  if (seasons.length === 0) return null

  const saisonCourante = getSaisonCourante()
  const defaultSaison = seasons.includes(saisonCourante) ? saisonCourante : seasons[0]
  const [selectedSaison, setSelectedSaison] = useState(defaultSaison)
  const [open, setOpen] = useState(true)

  const tachesSaison = taches.filter(t => getSaison(t.date_echeance || t.created_at) === selectedSaison)
  const traitementsSaison = [...traitements.filter(t => getSaison(t.date) === selectedSaison)]
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const byType = {}
  for (const t of traitementsSaison) {
    const key = t.type || 'autre'
    ;(byType[key] ||= []).push(t)
  }

  const dernierTraitement = traitementsSaison[0]

  function daysAgo(dateStr) {
    const d = new Date(dateStr)
    const diff = Math.floor((new Date() - d) / 86400000)
    if (diff === 0) return "aujourd'hui"
    if (diff === 1) return 'hier'
    return `il y a ${diff} j`
  }

  const hasTaches = tachesSaison.length > 0
  const hasTraitements = traitementsSaison.length > 0

  return (
    <div>
      <button onClick={() => setOpen(v => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="font-bold text-gray-900">Activité</h2>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2">
          {seasons.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {seasons.map(s => (
                <button key={s} onClick={() => setSelectedSaison(s)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selectedSaison === s
                      ? 'bg-vigne-700 text-white border-vigne-700'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 active:bg-gray-50'
                  }`}>
                  Saison {s}
                </button>
              ))}
            </div>
          )}

          {!hasTaches && !hasTraitements && (
            <div className="card text-center py-5">
              <p className="text-sm text-gray-400">Aucune activité pour la saison {selectedSaison}</p>
            </div>
          )}

          {hasTaches && (
            <div className="card space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <CheckSquare size={12} /> Tâches
                <span className="ml-auto normal-case font-normal text-gray-400">{tachesSaison.length}</span>
              </p>
              {tachesSaison.map(t => {
                const s = STATUT_TACHE[t.statut] || STATUT_TACHE.a_faire
                const { Icon } = s
                const done = t.statut === 'termine'
                return (
                  <button key={t.id} onClick={() => navigate(`/taches/${t.id}/edit`)}
                    className={`w-full flex items-center gap-2.5 text-left active:opacity-70 ${done ? 'opacity-50' : ''}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                      <Icon size={12} className={s.color} />
                    </span>
                    <span className={`flex-1 text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.titre}</span>
                    {t.date_echeance && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(t.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {hasTraitements && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Sprout size={12} /> Traitements
                  <span className="ml-1 normal-case font-normal text-gray-400">{traitementsSaison.length}</span>
                </p>
                {dernierTraitement && (
                  <span className="text-xs bg-vigne-50 text-vigne-700 border border-vigne-200 px-2 py-0.5 rounded-full font-medium">
                    Dernier {daysAgo(dernierTraitement.date)}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {Object.entries(byType).map(([type, items]) => {
                  const typ = TYPE_TRAITEMENT[type] || TYPE_TRAITEMENT.autre
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${typ.bg} ${typ.color}`}>
                          {typ.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {items.length} {items.length > 1 ? 'applications' : 'application'}
                        </span>
                      </div>
                      <div className="space-y-2 pl-1">
                        {items.map(t => (
                          <div key={t.id} className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 leading-tight">{t.produit}</p>
                              {t.dose && (
                                <p className="text-xs text-gray-400 mt-0.5">{t.dose}</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                              {new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VendangeChart({ vendanges, surfaceCa }) {
  // Affiche max 6 ans, ordre chronologique (ASC)
  const data = [...vendanges].reverse().slice(-6)
  if (data.length < 2) return null

  const W = 320, H = 140
  const PAD = { top: 20, right: 10, bottom: 24, left: 10 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom

  const kgHaValues = data.map(d =>
    surfaceCa > 0 && d.poids_total ? Math.round(d.poids_total / (surfaceCa / 10000)) : 0
  )
  const attenduValues = data.map(d => d.rendement_attendu_kgha || 0)
  const maxY = Math.max(...kgHaValues, ...attenduValues, 1) * 1.2

  const xStep = CW / data.length
  const xPos  = i => PAD.left + i * xStep + xStep / 2
  const yPos  = v => PAD.top + CH - (v / maxY) * CH

  const barW  = xStep * 0.55

  // Polyline points for kg/ha réalisé
  const linePoints = data
    .map((_, i) => kgHaValues[i] > 0 ? `${xPos(i)},${yPos(kgHaValues[i])}` : null)
    .filter(Boolean)
    .join(' ')

  // Polyline points for rendement attendu (only where defined)
  const attenduSegs = []
  let seg = []
  data.forEach((d, i) => {
    if (d.rendement_attendu_kgha) {
      seg.push(`${xPos(i)},${yPos(d.rendement_attendu_kgha)}`)
    } else if (seg.length) {
      attenduSegs.push(seg.join(' '))
      seg = []
    }
  })
  if (seg.length) attenduSegs.push(seg.join(' '))

  // Y axis labels (2 guides)
  const yGuides = [0.5, 1].map(f => ({ pct: f, val: Math.round(maxY * f) }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
      {/* Grid lines + left labels */}
      {yGuides.map(({ pct, val }) => {
        const y = yPos(maxY * pct)
        return (
          <g key={pct}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD.left + 2} y={y - 2} fontSize="8" fill="#d1d5db" textAnchor="start">
              {val >= 1000 ? `${Math.round(val / 1000)}k` : val}
            </text>
          </g>
        )
      })}

      {/* Bars (kg/ha réalisé) */}
      {data.map((d, i) => {
        const kgha = kgHaValues[i]
        if (!kgha) return null
        const bh = (kgha / maxY) * CH
        return (
          <rect key={d.annee}
            x={xPos(i) - barW / 2} y={yPos(kgha)}
            width={barW} height={bh}
            rx="3" fill="#fbbf24" opacity="0.75"
          />
        )
      })}

      {/* Ligne kg/ha réalisé */}
      {linePoints && (
        <polyline points={linePoints} fill="none"
          stroke="#d97706" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {data.map((d, i) => {
        const kgha = kgHaValues[i]
        if (!kgha) return null
        return <circle key={d.annee} cx={xPos(i)} cy={yPos(kgha)} r="3" fill="#d97706" />
      })}

      {/* Valeur kg/ha au-dessus de chaque barre */}
      {data.map((d, i) => {
        const kgha = kgHaValues[i]
        if (!kgha) return null
        return (
          <text key={d.annee} x={xPos(i)} y={yPos(kgha) - 5}
                textAnchor="middle" fontSize="8.5" fill="#92400e" fontWeight="600">
            {kgha >= 1000 ? `${Math.round(kgha / 100) / 10}k` : kgha}
          </text>
        )
      })}

      {/* Ligne objectif (pointillée) */}
      {attenduSegs.map((pts, si) => (
        <polyline key={si} points={pts} fill="none"
          stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4,3" />
      ))}

      {/* X axis (années) */}
      {data.map((d, i) => (
        <text key={d.annee} x={xPos(i)} y={H - 6}
              textAnchor="middle" fontSize="10" fill="#6b7280">
          {d.annee}
        </text>
      ))}
    </svg>
  )
}

function ComparaisonChart({ data }) {
  // Max 6 années, en chronologique
  const rows = [...data].slice(-6)
  if (rows.length === 0) return null

  const W = 320, H = 160
  const PAD = { top: 22, right: 10, bottom: 26, left: 10 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom

  const allValues = rows.flatMap(r => [r.kgha_parcelle || 0, r.kgha_pressoir || 0, r.rendement_attendu_kgha || 0])
  const maxY = Math.max(...allValues, 1) * 1.2

  const xStep = CW / rows.length
  const xPos = i => PAD.left + i * xStep + xStep / 2
  const yPos = v => PAD.top + CH - (v / maxY) * CH
  const barW = xStep * 0.32

  const yGuides = [0.5, 1].map(f => ({ pct: f, val: Math.round(maxY * f) }))

  // Ligne appellation (segments continus là où défini)
  const appellationSegs = []
  let seg = []
  rows.forEach((r, i) => {
    if (r.rendement_attendu_kgha) {
      seg.push(`${xPos(i)},${yPos(r.rendement_attendu_kgha)}`)
    } else if (seg.length) {
      appellationSegs.push(seg.join(' '))
      seg = []
    }
  })
  if (seg.length) appellationSegs.push(seg.join(' '))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
      {yGuides.map(({ pct, val }) => {
        const y = yPos(maxY * pct)
        return (
          <g key={pct}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD.left + 2} y={y - 2} fontSize="8" fill="#d1d5db">
              {val >= 1000 ? `${Math.round(val / 1000)}k` : val}
            </text>
          </g>
        )
      })}

      {rows.map((r, i) => {
        const cx = xPos(i)
        const vp = r.kgha_parcelle || 0
        const vg = r.kgha_pressoir || 0
        return (
          <g key={r.annee}>
            {vp > 0 && (
              <>
                <rect x={cx - barW - 1} y={yPos(vp)} width={barW} height={CH - (yPos(vp) - PAD.top)}
                      rx="2" fill="#fbbf24" />
                <text x={cx - barW / 2 - 1} y={yPos(vp) - 3} textAnchor="middle"
                      fontSize="8" fill="#92400e" fontWeight="600">
                  {vp >= 1000 ? `${Math.round(vp / 100) / 10}k` : vp}
                </text>
              </>
            )}
            {vg > 0 && (
              <>
                <rect x={cx + 1} y={yPos(vg)} width={barW} height={CH - (yPos(vg) - PAD.top)}
                      rx="2" fill="#15803d" />
                <text x={cx + barW / 2 + 1} y={yPos(vg) - 3} textAnchor="middle"
                      fontSize="8" fill="#14532d" fontWeight="600">
                  {vg >= 1000 ? `${Math.round(vg / 100) / 10}k` : vg}
                </text>
              </>
            )}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#6b7280">
              {r.annee}
            </text>
            {r.n_parcelles > 1 && (
              <text x={cx} y={H - 0} textAnchor="middle" fontSize="7" fill="#9ca3af">
                {r.n_parcelles} parc.
              </text>
            )}
          </g>
        )
      })}

      {/* Ligne objectif appellation */}
      {appellationSegs.map((pts, si) => (
        <polyline key={si} points={pts} fill="none"
          stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
      ))}
      {rows.map((r, i) => r.rendement_attendu_kgha ? (
        <circle key={r.annee} cx={xPos(i)} cy={yPos(r.rendement_attendu_kgha)} r="2.5" fill="#94a3b8" />
      ) : null)}
    </svg>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right min-w-0 break-words">{value || '—'}</span>
    </div>
  )
}
