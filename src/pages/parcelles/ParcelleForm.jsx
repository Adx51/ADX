import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Locate, Loader2, MapPin, Map, Crosshair } from 'lucide-react'
import { api } from '../../lib/api'
import { uploadPhoto } from '../../lib/uploadPhoto'
import { parseToCa } from '../../lib/surface'
import { locateFromCadastre } from '../../lib/cadastre'
import PageHeader from '../../components/PageHeader'
import PhotoInput from '../../components/PhotoInput'

const MapPicker = lazy(() => import('../../components/MapPicker'))

const STATUTS = [
  { value: 'en_production', label: 'En production', color: 'text-green-700' },
  { value: 'replantee', label: 'Replantée (jeune vigne)', color: 'text-amber-700' },
  { value: 'au_repos', label: 'Au repos / arrachée', color: 'text-gray-500' },
]

export default function ParcelleForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [photo, setPhoto] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [cadastreLoading, setCadastreLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cepagesSelected, setCepagesSelected] = useState([])
  const [showMap, setShowMap] = useState(false)
  const [cadastreFeatures, setCadastreFeatures] = useState(null)
  const [communes, setCommunes] = useState([])   // [{valeur, code_insee}]
  const [cepages, setCepages] = useState([])      // [{valeur}]
  const [parcelleData, setParcelleData] = useState(null)

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      ares: '', centiares: '', ares_p: '', centiares_p: '',
      statut: 'en_production', commune: '', commune_pressoir: '', gps_lat: '', gps_lng: '',
      reference_cadastrale: ''
    }
  })

  const gpsLat = watch('gps_lat')
  const gpsLng = watch('gps_lng')
  const statut = watch('statut')
  const communeVal = watch('commune')
  const refCadastrale = watch('reference_cadastrale')

  useEffect(() => {
    api.get('/referentiels/commune').then(data => setCommunes(data || []))
    api.get('/referentiels/cepage').then(data => setCepages(data || []))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api.get(`/parcelles/${id}`).then(data => {
      if (!data) return
      setParcelleData(data)
      setCepagesSelected(Array.isArray(data.cepages) ? data.cepages : [])
      setExistingPhotoUrl(data.photo_url)
    })
  }, [id, isEdit])

  // Applique les valeurs au formulaire seulement quand les référentiels (communes)
  // sont chargés, sinon les <select> n'ont pas encore les <option> et ignorent la valeur.
  useEffect(() => {
    if (!parcelleData || communes.length === 0) return
    const data = parcelleData
    setValue('nom', data.nom)
    setValue('ares',         Math.floor((data.surface_totale_ca || 0) / 100))
    setValue('centiares',    (data.surface_totale_ca || 0) % 100 || '')
    setValue('ares_p',       Math.floor((data.surface_plantee_ca || 0) / 100))
    setValue('centiares_p',  (data.surface_plantee_ca || 0) % 100 || '')
    setValue('nombre_routes', data.nombre_routes || '')
    setValue('commune', data.commune || '')
    setValue('commune_pressoir', data.commune_pressoir || '')
    setValue('statut', data.statut || 'en_production')
    setValue('annee_plantation', data.annee_plantation || '')
    setValue('gps_lat', data.gps_lat || '')
    setValue('gps_lng', data.gps_lng || '')
    setValue('notes', data.notes || '')
    setValue('reference_cadastrale', data.reference_cadastrale || '')
  }, [parcelleData, communes, setValue])

  function toggleCepage(c) {
    setCepagesSelected(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function getGPS() {
    if (!navigator.geolocation) {
      setError('Géolocalisation non disponible. Utilisez la carte ou le cadastre ci-dessous.')
      setShowMap(true)
      return
    }
    setGpsLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setValue('gps_lat', pos.coords.latitude.toFixed(8))
        setValue('gps_lng', pos.coords.longitude.toFixed(8))
        setGpsLoading(false)
      },
      err => {
        const prefix = err.code === 1 ? 'Permission refusée. ' : 'Position non disponible (HTTP). '
        setError(prefix + 'Utilisez la carte ou le cadastre ci-dessous.')
        setShowMap(true)
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function locateByCadastre() {
    setError('')
    if (!refCadastrale?.trim()) {
      setError('Saisissez d\'abord la référence cadastrale (ex : AB 0012)')
      return
    }
    const commune = communes.find(c => c.valeur === communeVal)
    if (!commune?.code_insee) {
      setError('Code INSEE manquant pour cette commune. Configurez-le dans l\'admin → Référentiels.')
      return
    }
    setCadastreLoading(true)
    try {
      const { lat, lng, notFound, features } = await locateFromCadastre(commune.code_insee, refCadastrale)
      setValue('gps_lat', lat)
      setValue('gps_lng', lng)
      setCadastreFeatures(features)
      setShowMap(true)
      if (notFound.length) {
        setError(`Localisation partielle — introuvable(s) : ${notFound.join(', ')}`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setCadastreLoading(false)
    }
  }

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      let photo_url = existingPhotoUrl
      if (photo) photo_url = await uploadPhoto(photo, 'parcelles')

      const payload = {
        nom: data.nom,
        surface_totale_ca:  parseToCa(data.ares, data.centiares),
        surface_plantee_ca: parseToCa(data.ares_p, data.centiares_p) || null,
        nombre_routes: data.nombre_routes ? parseInt(data.nombre_routes) : null,
        commune: data.commune || null,
        commune_pressoir: data.commune_pressoir || null,
        cepages: cepagesSelected,
        statut: data.statut || 'en_production',
        annee_plantation: data.annee_plantation ? parseInt(data.annee_plantation) : null,
        gps_lat: data.gps_lat ? parseFloat(data.gps_lat) : null,
        gps_lng: data.gps_lng ? parseFloat(data.gps_lng) : null,
        photo_url,
        notes: data.notes || null,
        reference_cadastrale: data.reference_cadastrale || null
      }

      if (isEdit) {
        await api.put(`/parcelles/${id}`, payload)
      } else {
        await api.post('/parcelles', payload)
      }
      navigate('/parcelles')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Modifier la parcelle' : 'Nouvelle parcelle'} back="/parcelles" />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 pt-4 space-y-5 pb-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Nom */}
        <div>
          <label className="label">Nom de la parcelle *</label>
          <input className="input" placeholder="ex: LOUTRETS" {...register('nom', { required: true })} />
        </div>

        {/* Commune */}
        <div>
          <label className="label">Commune *</label>
          <select className="input" {...register('commune', { required: true })}>
            <option value="">— Sélectionner —</option>
            {communes.map(c => <option key={c.valeur} value={c.valeur}>{c.valeur}</option>)}
          </select>
        </div>

        {/* Pressoir (pour l'export groupé) */}
        <div>
          <label className="label">Pressoir / Rattachement export</label>
          <select className="input" {...register('commune_pressoir')}>
            <option value="">— Même que la commune —</option>
            {communes.map(c => <option key={c.valeur} value={c.valeur}>{c.valeur}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Si les vendanges sont livrées à un pressoir d'une autre commune (ex : Cramant → Chouilly).
          </p>
        </div>

        {/* Référence cadastrale */}
        <div>
          <label className="label">Référence(s) cadastrale(s)</label>
          <input
            className="input"
            placeholder="ex: AB 0012, AB 0013"
            {...register('reference_cadastrale')}
          />
          <button
            type="button"
            onClick={locateByCadastre}
            disabled={cadastreLoading || !refCadastrale?.trim()}
            className="mt-2 flex items-center gap-1.5 text-vigne-700 font-medium text-sm py-1.5 disabled:opacity-40"
          >
            {cadastreLoading
              ? <Loader2 size={15} className="animate-spin" />
              : <Crosshair size={15} />}
            {cadastreLoading ? 'Localisation cadastrale...' : 'Localiser depuis le cadastre'}
          </button>
          <p className="text-xs text-gray-400 mt-0.5">
            Plusieurs références séparées par , ou ; — ex : AV0259;AV0260 — position GPS calculée via l'IGN.
          </p>
        </div>

        {/* Surface totale */}
        <div>
          <label className="label">Surface totale *</label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input className="input text-center" type="number" min="0" placeholder="0"
                {...register('ares', { required: true, min: 0 })} />
              <p className="text-xs text-center text-gray-400 mt-1">Ares</p>
            </div>
            <span className="text-gray-400 font-bold pb-4">A</span>
            <div className="w-24">
              <input className="input text-center" type="number" min="0" max="99" placeholder="00"
                {...register('centiares')} />
              <p className="text-xs text-center text-gray-400 mt-1">Centiares</p>
            </div>
          </div>
        </div>

        {/* Surface plantée */}
        <div>
          <label className="label">Surface plantée</label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input className="input text-center" type="number" min="0" placeholder="0" {...register('ares_p')} />
              <p className="text-xs text-center text-gray-400 mt-1">Ares</p>
            </div>
            <span className="text-gray-400 font-bold pb-4">A</span>
            <div className="w-24">
              <input className="input text-center" type="number" min="0" max="99" placeholder="00" {...register('centiares_p')} />
              <p className="text-xs text-center text-gray-400 mt-1">Centiares</p>
            </div>
          </div>
        </div>

        {/* Cépages */}
        <div>
          <label className="label">Cépages</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {cepages.map(c => (
              <button
                key={c.valeur}
                type="button"
                onClick={() => toggleCepage(c.valeur)}
                className={`px-3 py-2 rounded-xl border text-sm font-medium text-left transition-colors ${
                  cepagesSelected.includes(c.valeur)
                    ? 'bg-vigne-700 text-white border-vigne-700'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {c.valeur}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre de routes */}
        <div>
          <label className="label">Nombre de routes</label>
          <input className="input" type="number" min="0" placeholder="ex: 21" {...register('nombre_routes')} />
        </div>

        {/* Statut */}
        <div>
          <label className="label">Statut de la parcelle</label>
          <div className="space-y-2 mt-1">
            {STATUTS.map(s => (
              <label key={s.value} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">
                <input type="radio" value={s.value} {...register('statut')} className="accent-vigne-700" />
                <span className={`text-sm font-medium ${s.color}`}>{s.label}</span>
              </label>
            ))}
          </div>
          {(statut === 'replantee' || statut === 'au_repos') && (
            <div className="mt-2">
              <label className="label">Année {statut === 'replantee' ? 'de plantation' : 'd\'arrachage'}</label>
              <input className="input" type="number" min="1980" max="2050" placeholder="ex: 2022"
                {...register('annee_plantation')} />
            </div>
          )}
        </div>

        {/* GPS */}
        <div>
          <label className="label">Position GPS</label>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Latitude" {...register('gps_lat')} />
            <input className="input flex-1" placeholder="Longitude" {...register('gps_lng')} />
          </div>
          <div className="flex gap-4 mt-2">
            <button type="button" onClick={getGPS}
                    className="flex items-center gap-1.5 text-vigne-700 font-medium text-sm py-1.5">
              {gpsLoading ? <Loader2 size={16} className="animate-spin" /> : <Locate size={16} />}
              {gpsLoading ? 'Localisation...' : 'Ma position'}
            </button>
            <button type="button" onClick={() => setShowMap(v => !v)}
                    className="flex items-center gap-1.5 text-vigne-700 font-medium text-sm py-1.5">
              <Map size={16} />
              {showMap ? 'Masquer la carte' : 'Carte'}
            </button>
          </div>
          {showMap && (
            <div className="mt-2">
              <Suspense fallback={<div className="h-56 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Chargement de la carte...</div>}>
                <MapPicker
                  lat={gpsLat}
                  lng={gpsLng}
                  geoFeatures={cadastreFeatures}
                  onChange={(lat, lng) => {
                    setValue('gps_lat', lat)
                    setValue('gps_lng', lng)
                  }}
                />
              </Suspense>
            </div>
          )}
          {(gpsLat || gpsLng) && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-vigne-600" />
              <p className="text-xs text-vigne-600">{gpsLat}, {gpsLng}</p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" placeholder="Informations complémentaires..." {...register('notes')} />
        </div>

        <PhotoInput value={existingPhotoUrl} onChange={setPhoto} />

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Créer la parcelle'}
        </button>
      </form>
    </div>
  )
}
