import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadPhoto } from '../../lib/uploadPhoto'
import PageHeader from '../../components/PageHeader'
import PhotoInput from '../../components/PhotoInput'

export default function TacheForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [photo, setPhoto] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [parcelles, setParcelles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { register, handleSubmit, setValue } = useForm()

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('parcelles').select('id, nom').order('nom')
      setParcelles(p || [])

      if (isEdit) {
        const { data: t } = await supabase.from('taches').select('*').eq('id', id).single()
        if (t) {
          setValue('titre', t.titre)
          setValue('description', t.description || '')
          setValue('parcelle_id', t.parcelle_id || '')
          setValue('statut', t.statut)
          setValue('priorite', t.priorite)
          setValue('date_echeance', t.date_echeance || '')
          setExistingPhotoUrl(t.photo_url)
        }
      }
    }
    load()
  }, [id, isEdit, setValue])

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      let photo_url = existingPhotoUrl
      if (photo) photo_url = await uploadPhoto(photo, 'taches')

      const payload = {
        user_id: user.id,
        titre: data.titre,
        description: data.description || null,
        parcelle_id: data.parcelle_id || null,
        statut: data.statut || 'a_faire',
        priorite: data.priorite || 'normale',
        date_echeance: data.date_echeance || null,
        photo_url,
      }

      if (isEdit) {
        await supabase.from('taches').update(payload).eq('id', id)
      } else {
        await supabase.from('taches').insert(payload)
      }
      navigate('/taches')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function deleteTache() {
    await supabase.from('taches').delete().eq('id', id)
    navigate('/taches')
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'} back="/taches" />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 pt-4 space-y-5 pb-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <div>
          <label className="label">Tâche *</label>
          <input className="input" placeholder="ex: Traitement fongicide" {...register('titre', { required: true })} />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" placeholder="Détails..."
                    {...register('description')} />
        </div>

        <div>
          <label className="label">Parcelle concernée</label>
          <select className="input" {...register('parcelle_id')}>
            <option value="">— Toutes les parcelles —</option>
            {parcelles.map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Statut</label>
            <select className="input" {...register('statut')}>
              <option value="a_faire">À faire</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminée</option>
            </select>
          </div>
          <div>
            <label className="label">Priorité</label>
            <select className="input" {...register('priorite')}>
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Date d'échéance</label>
          <input type="date" className="input" {...register('date_echeance')} />
        </div>

        <PhotoInput value={existingPhotoUrl} onChange={setPhoto} />

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer la tâche'}
        </button>

        {isEdit && (
          confirmDelete ? (
            <div className="card border-red-200 bg-red-50 space-y-3">
              <p className="text-red-700 font-medium text-sm text-center">Supprimer cette tâche ?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary py-2 text-sm">
                  Annuler
                </button>
                <button type="button" onClick={deleteTache} className="btn-danger py-2 text-sm">
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 text-red-500 py-2 text-sm font-medium">
              <Trash2 size={16} />
              Supprimer cette tâche
            </button>
          )
        )}
      </form>
    </div>
  )
}
