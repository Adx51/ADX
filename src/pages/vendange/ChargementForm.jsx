import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { Package, Scale, Clock, CalendarDays, FileText } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/PageHeader'
import { format } from 'date-fns'

export default function ChargementForm() {
  const params = useParams()
  const isEdit = Boolean(params.vendangeId)
  const vendangeId = isEdit ? params.vendangeId : params.id
  const chargementId = isEdit ? params.id : null

  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [vendange, setVendange] = useState(null)

  const { register, handleSubmit, setValue, control } = useForm({
    defaultValues: {
      date_chargement: format(new Date(), 'yyyy-MM-dd'),
      nombre_caisses: '',
      poids_kg: '',
      heure_livraison: format(new Date(), 'HH:mm'),
      notes: ''
    }
  })

  const nbCaisses = useWatch({ control, name: 'nombre_caisses' })
  const poids     = useWatch({ control, name: 'poids_kg' })
  const moyenne   = nbCaisses && poids && Number(nbCaisses) > 0
    ? (Number(poids) / Number(nbCaisses)).toFixed(1) : null

  useEffect(() => {
    api.get(`/vendanges/${vendangeId}`).then(v => setVendange(v))

    if (isEdit && chargementId) {
      api.get(`/chargements/${chargementId}`).then(c => {
        if (c) {
          setValue('date_chargement',  c.date_chargement)
          setValue('nombre_caisses',   c.nombre_caisses)
          setValue('poids_kg',         c.poids_kg)
          setValue('heure_livraison',  c.heure_livraison?.slice(0, 5) || '')
          setValue('notes',            c.notes || '')
        }
      })
    }
  }, [vendangeId, chargementId, isEdit, setValue])

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      const payload = {
        vendange_id:     vendangeId,
        nombre_caisses:  parseInt(data.nombre_caisses),
        poids_kg:        parseFloat(data.poids_kg),
        date_chargement: data.date_chargement,
        heure_livraison: data.heure_livraison || null,
        notes:           data.notes || null,
      }
      if (isEdit && chargementId) {
        await api.put(`/chargements/${chargementId}`, payload)
      } else {
        await api.post('/chargements', payload)
      }
      api.invalidate(`/vendanges/${vendangeId}`)
      api.invalidate('/campagnes')
      navigate(`/vendange/parcelle/${vendangeId}`)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const backUrl = `/vendange/parcelle/${vendangeId}`

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={isEdit ? 'Modifier le chargement' : 'Nouveau chargement'}
        back={backUrl}
      />

      <div className="px-4 pt-3 pb-8 space-y-4">
        {/* Contexte vendange */}
        {vendange && (
          <div className="bg-amber-500 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-base leading-tight">{vendange.parcelles?.nom}</p>
              <p className="text-amber-100 text-sm">Vendange {vendange.annee}</p>
            </div>
            {(vendange.nb_caisses_total > 0 || vendange.poids_total > 0) && (
              <div className="text-right">
                <p className="text-white font-bold">{Number(vendange.poids_total || 0).toFixed(0)} kg</p>
                <p className="text-amber-100 text-xs">{vendange.nb_caisses_total || 0} caisses au total</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Date et heure */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays size={15} className="text-amber-500" />
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date *</label>
                </div>
                <input type="date" className="w-full text-base font-medium text-gray-900 outline-none bg-transparent"
                       {...register('date_chargement', { required: true })} />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={15} className="text-amber-500" />
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Heure</label>
                </div>
                <input type="time" className="w-full text-base font-medium text-gray-900 outline-none bg-transparent"
                       {...register('heure_livraison')} />
              </div>
            </div>
          </div>

          {/* Caisses et poids */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-4 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-3">
                  <Package size={15} className="text-amber-500" />
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Caisses *</label>
                </div>
                <input type="number" inputMode="numeric"
                       autoFocus={!isEdit}
                       className="w-full text-center text-4xl font-bold text-gray-900 outline-none bg-transparent py-1"
                       min="1" placeholder="0"
                       {...register('nombre_caisses', { required: true, min: 1 })} />
              </div>
              <div className="p-4 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-3">
                  <Scale size={15} className="text-amber-500" />
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Poids (kg) *</label>
                </div>
                <input type="number" inputMode="decimal" step="0.1"
                       className="w-full text-center text-4xl font-bold text-amber-700 outline-none bg-transparent py-1"
                       min="0" placeholder="0"
                       {...register('poids_kg', { required: true, min: 0 })} />
              </div>
            </div>

            {moyenne && (
              <div className="border-t border-gray-100 bg-vigne-50 px-4 py-3 text-center">
                <p className="text-vigne-700 font-semibold text-sm">
                  Moyenne : <span className="text-vigne-800 text-lg font-bold">{moyenne} kg/caisse</span>
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={15} className="text-amber-500" />
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
            </div>
            <input className="w-full text-base text-gray-900 outline-none bg-transparent placeholder-gray-300"
                   placeholder="Remarques..." {...register('notes')} />
          </div>

          <button type="submit"
                  className="w-full bg-amber-500 text-white py-4 rounded-2xl font-bold text-base
                             active:scale-[0.98] transition-transform disabled:opacity-50 shadow-sm"
                  disabled={saving}>
            {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Ajouter ce chargement'}
          </button>
        </form>
      </div>
    </div>
  )
}
