import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { api } from '../../lib/api'
import PageHeader from '../../components/PageHeader'

export default function VendangeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const preselectedParcelle = searchParams.get('parcelle')
  const navigate = useNavigate()
  const [parcelles, setParcelles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, setValue } = useForm({
    defaultValues: { annee: new Date().getFullYear() }
  })

  useEffect(() => {
    api.get('/parcelles').then(p => setParcelles(p || []))
    if (preselectedParcelle) setValue('parcelle_id', preselectedParcelle)
    if (isEdit) {
      api.get(`/vendanges/${id}`).then(v => {
        if (v) {
          setValue('parcelle_id', v.parcelle_id || v.parcelles?.id)
          setValue('annee', v.annee)
          setValue('notes', v.notes || '')
        }
      })
    }
  }, [id, isEdit, preselectedParcelle, setValue])

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      const payload = {
        parcelle_id: data.parcelle_id,
        annee: parseInt(data.annee),
        notes: data.notes || null,
      }

      if (isEdit) {
        await api.put(`/vendanges/${id}`, payload)
        navigate(`/vendange/${id}`)
      } else {
        const created = await api.post('/vendanges', payload)
        navigate(`/vendange/${created.id}`)
      }
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Modifier la vendange' : 'Nouvelle vendange'} back="/vendange" />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 pt-4 space-y-5 pb-8">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

        <div>
          <label className="label">Parcelle *</label>
          <select className="input" {...register('parcelle_id', { required: true })}>
            <option value="">— Choisir une parcelle —</option>
            {parcelles.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Année *</label>
          <input type="number" className="input" min="2000" max="2100"
                 {...register('annee', { required: true })} />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" placeholder="Observations..." {...register('notes')} />
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer la vendange'}
        </button>
      </form>
    </div>
  )
}
