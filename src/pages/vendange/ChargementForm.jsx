import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { format } from 'date-fns'

// Routes:
//   new:  /vendange/:id/chargement/new        → params: { id }
//   edit: /vendange/:vendangeId/chargement/:id/edit → params: { vendangeId, id }
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
      heure_livraison: '',
      notes: ''
    }
  })

  const nbCaisses = useWatch({ control, name: 'nombre_caisses' })
  const poids = useWatch({ control, name: 'poids_kg' })
  const moyenneParCaisse = nbCaisses && poids && Number(nbCaisses) > 0
    ? (Number(poids) / Number(nbCaisses)).toFixed(1)
    : null

  useEffect(() => {
    async function load() {
      const { data: v } = await supabase
        .from('vendanges')
        .select('*, parcelles(nom)')
        .eq('id', vendangeId)
        .single()
      setVendange(v)

      if (isEdit && chargementId) {
        const { data: c } = await supabase.from('chargements').select('*').eq('id', chargementId).single()
        if (c) {
          setValue('date_chargement', c.date_chargement)
          setValue('nombre_caisses', c.nombre_caisses)
          setValue('poids_kg', c.poids_kg)
          setValue('heure_livraison', c.heure_livraison?.slice(0, 5) || '')
          setValue('notes', c.notes || '')
        }
      }
    }
    load()
  }, [vendangeId, chargementId, isEdit, setValue])

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      const payload = {
        vendange_id: vendangeId,
        nombre_caisses: parseInt(data.nombre_caisses),
        poids_kg: parseFloat(data.poids_kg),
        date_chargement: data.date_chargement,
        heure_livraison: data.heure_livraison || null,
        notes: data.notes || null,
      }

      if (isEdit && chargementId) {
        await supabase.from('chargements').update(payload).eq('id', chargementId)
      } else {
        await supabase.from('chargements').insert(payload)
      }
      navigate(`/vendange/${vendangeId}`)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Modifier le chargement' : 'Nouveau chargement'}
        back={`/vendange/${vendangeId}`}
      />

      <div className="px-4 pt-3">
        {vendange && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4">
            <p className="text-sm font-semibold text-amber-800">
              {vendange.parcelles?.nom} — {vendange.annee}
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 space-y-5 pb-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" {...register('date_chargement', { required: true })} />
          </div>
          <div>
            <label className="label">Heure arrivée</label>
            <input type="time" className="input" {...register('heure_livraison')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nombre de caisses *</label>
            <input
              type="number"
              inputMode="numeric"
              className="input text-center text-3xl font-bold h-16"
              min="0"
              placeholder="24"
              {...register('nombre_caisses', { required: true, min: 1 })}
            />
          </div>
          <div>
            <label className="label">Poids (kg) *</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className="input text-center text-3xl font-bold h-16"
              min="0"
              placeholder="1014"
              {...register('poids_kg', { required: true, min: 0 })}
            />
          </div>
        </div>

        {/* Poids moyen par caisse */}
        {moyenneParCaisse && (
          <div className="bg-vigne-50 border border-vigne-200 rounded-xl px-4 py-3 text-center">
            <p className="text-vigne-700 font-semibold">
              Moyenne : <span className="text-vigne-800 text-lg">{moyenneParCaisse} kg/caisse</span>
            </p>
          </div>
        )}

        <div>
          <label className="label">Notes</label>
          <input className="input" placeholder="Remarques sur ce chargement..." {...register('notes')} />
        </div>

        <button
          type="submit"
          className="w-full bg-amber-500 text-white px-4 py-3 rounded-xl font-semibold
                     active:scale-95 transition-transform disabled:opacity-50"
          disabled={saving}
        >
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Ajouter ce chargement'}
        </button>
      </form>
    </div>
  )
}
