import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Locate, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadPhoto } from '../../lib/uploadPhoto'
import { parseToCa } from '../../lib/surface'
import PageHeader from '../../components/PageHeader'
import PhotoInput from '../../components/PhotoInput'

export default function ParcelleForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [photo, setPhoto] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: { ares: '', centiares: '', ares_p: '', centiares_p: '' }
  })

  useEffect(() => {
    if (!isEdit) return
    async function load() {
      const { data } = await supabase.from('parcelles').select('*').eq('id', id).single()
      if (!data) return
      setValue('nom', data.nom)
      setValue('ares', Math.floor((data.surface_totale_ca || 0) / 100))
      setValue('centiares', (data.surface_totale_ca || 0) % 100 || '')
      setValue('ares_p', Math.floor((data.surface_plantee_ca || 0) / 100))
      setValue('centiares_p', (data.surface_plantee_ca || 0) % 100 || '')
      setValue('nombre_routes', data.nombre_routes || '')
      setValue('cepage', data.cepage || '')
      setValue('gps_lat', data.gps_lat || '')
      setValue('gps_lng', data.gps_lng || '')
      setValue('notes', data.notes || '')
      setExistingPhotoUrl(data.photo_url)
    }
    load()
  }, [id, isEdit, setValue])

  function getGPS() {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setValue('gps_lat', pos.coords.latitude.toFixed(8))
        setValue('gps_lng', pos.coords.longitude.toFixed(8))
        setGpsLoading(false)
      },
      () => {
        setError('Impossible d\'obtenir la position GPS')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      let photo_url = existingPhotoUrl
      if (photo) {
        photo_url = await uploadPhoto(photo, 'parcelles')
      }

      const payload = {
        user_id: user.id,
        nom: data.nom,
        surface_totale_ca:  parseToCa(data.ares,   data.centiares),
        surface_plantee_ca: parseToCa(data.ares_p, data.centiares_p),
        nombre_routes: data.nombre_routes ? parseInt(data.nombre_routes) : null,
        cepage: data.cepage || null,
        gps_lat: data.gps_lat ? parseFloat(data.gps_lat) : null,
        gps_lng: data.gps_lng ? parseFloat(data.gps_lng) : null,
        photo_url,
        notes: data.notes || null
      }

      if (isEdit) {
        await supabase.from('parcelles').update(payload).eq('id', id)
      } else {
        await supabase.from('parcelles').insert(payload)
      }
      navigate('/parcelles')
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'enregistrement')
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

        <div>
          <label className="label">Nom de la parcelle *</label>
          <input className="input" placeholder="ex: LOUTRETS" {...register('nom', { required: true })} />
        </div>

        {/* Surface totale */}
        <div>
          <label className="label">Surface totale</label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input className="input text-center" type="number" min="0" placeholder="0"
                     {...register('ares')} />
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
              <input className="input text-center" type="number" min="0" placeholder="0"
                     {...register('ares_p')} />
              <p className="text-xs text-center text-gray-400 mt-1">Ares</p>
            </div>
            <span className="text-gray-400 font-bold pb-4">A</span>
            <div className="w-24">
              <input className="input text-center" type="number" min="0" max="99" placeholder="00"
                     {...register('centiares_p')} />
              <p className="text-xs text-center text-gray-400 mt-1">Centiares</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nombre de routes</label>
            <input className="input" type="number" min="0" placeholder="ex: 21"
                   {...register('nombre_routes')} />
          </div>
          <div>
            <label className="label">Cépage</label>
            <input className="input" placeholder="ex: Chardonnay" {...register('cepage')} />
          </div>
        </div>

        {/* GPS */}
        <div>
          <label className="label">Position GPS</label>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Latitude" readOnly
                   {...register('gps_lat')} />
            <input className="input flex-1" placeholder="Longitude" readOnly
                   {...register('gps_lng')} />
          </div>
          <button type="button" onClick={getGPS}
                  className="mt-2 flex items-center gap-2 text-vigne-700 font-medium text-sm py-2">
            {gpsLoading ? <Loader2 size={16} className="animate-spin" /> : <Locate size={16} />}
            {gpsLoading ? 'Localisation...' : 'Obtenir ma position'}
          </button>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" placeholder="Informations complémentaires..."
                    {...register('notes')} />
        </div>

        <PhotoInput
          value={existingPhotoUrl}
          onChange={setPhoto}
        />

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Créer la parcelle'}
        </button>
      </form>
    </div>
  )
}
