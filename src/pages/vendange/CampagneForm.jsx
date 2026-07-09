import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { api } from '../../lib/api'
import PageHeader from '../../components/PageHeader'

export default function CampagneForm() {
  const { annee } = useParams()
  const isEdit = Boolean(annee)
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, setValue } = useForm({
    defaultValues: { annee: new Date().getFullYear() }
  })

  useEffect(() => {
    if (!isEdit) return
    api.get(`/campagnes/${annee}`).then(c => {
      if (!c) return
      setValue('annee', c.annee)
      setValue('date_debut', c.date_debut || '')
      setValue('rendement_attendu_kgha', c.rendement_attendu_kgha || '')
    })
  }, [annee, isEdit, setValue])

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      const payload = {
        date_debut: data.date_debut || null,
        rendement_attendu_kgha: data.rendement_attendu_kgha ? parseInt(data.rendement_attendu_kgha) : null,
      }
      if (isEdit) {
        await api.put(`/campagnes/${annee}`, payload)
        navigate(`/vendange/${annee}`)
      } else {
        const created = await api.post('/campagnes', { ...payload, annee: parseInt(data.annee) })
        navigate(`/vendange/${created.annee}`)
      }
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={isEdit ? `Modifier campagne ${annee}` : 'Nouvelle campagne'} back="/vendange" />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 pt-4 space-y-5 pb-8">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

        <div>
          <label className="label">Année *</label>
          <input type="number" className="input" min="2000" max="2100" disabled={isEdit}
                 {...register('annee', { required: true })} />
        </div>

        <div>
          <label className="label">Date de début</label>
          <input type="date" className="input" {...register('date_debut')} />
        </div>

        <div>
          <label className="label">Rendement attendu (kg/ha)</label>
          <input type="number" className="input" min="0" placeholder="ex : 10000"
                 {...register('rendement_attendu_kgha')} />
          <p className="text-xs text-gray-400 mt-1">Sert à comparer le rendement réel de chaque parcelle.</p>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer la campagne'}
        </button>
      </form>
    </div>
  )
}
