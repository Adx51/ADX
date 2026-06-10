import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useBack } from '../../lib/useBack'
import PageHeader from '../../components/PageHeader'

const TYPES = [
  { value: 'fongicide',   label: 'Fongicide' },
  { value: 'insecticide', label: 'Insecticide' },
  { value: 'herbicide',   label: 'Herbicide' },
  { value: 'biocontrole', label: 'Biocontrôle' },
  { value: 'autre',       label: 'Autre' },
]

export default function PhytoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const goBack = useBack('/phyto')

  const [parcelles, setParcelles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  const [form, setForm] = useState({
    date:        '',
    parcelle_id: '',
    type:        'fongicide',
    produit:     '',
    dose:        '',
    operateur:   '',
    dar:         '',
    conditions:  '',
    notes:       '',
  })

  useEffect(() => {
    api.get('/parcelles').then(p => setParcelles(p || []))

    if (isEdit) {
      api.get(`/traitements/${id}`).then(t => {
        if (t) {
          setForm({
            date:        t.date || '',
            parcelle_id: t.parcelle_id != null ? String(t.parcelle_id) : '',
            type:        t.type || 'fongicide',
            produit:     t.produit || '',
            dose:        t.dose || '',
            operateur:   t.operateur || '',
            dar:         t.dar != null ? String(t.dar) : '',
            conditions:  t.conditions || '',
            notes:       t.notes || '',
          })
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [id, isEdit])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        date:        form.date,
        parcelle_id: form.parcelle_id ? Number(form.parcelle_id) : null,
        type:        form.type,
        produit:     form.produit,
        dose:        form.dose || null,
        operateur:   form.operateur || null,
        dar:         form.dar !== '' ? Number(form.dar) : null,
        conditions:  form.conditions || null,
        notes:       form.notes || null,
      }

      if (isEdit) {
        await api.put(`/traitements/${id}`, payload)
      } else {
        await api.post('/traitements', payload)
      }
      goBack()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/traitements/${id}`)
      goBack()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Modifier le traitement" back="/phyto" />
        <div className="px-4 pt-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card skeleton h-12" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Modifier le traitement' : 'Nouveau traitement'} back="/phyto" />

      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-5 pb-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Date */}
        <div>
          <label className="label">Date *</label>
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={e => setField('date', e.target.value)}
            required
          />
        </div>

        {/* Parcelle */}
        <div>
          <label className="label">Parcelle</label>
          <select
            className="input"
            value={form.parcelle_id}
            onChange={e => setField('parcelle_id', e.target.value)}
          >
            <option value="">— Toutes parcelles —</option>
            {parcelles.map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="label">Type *</label>
          <select
            className="input"
            value={form.type}
            onChange={e => setField('type', e.target.value)}
            required
          >
            {TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Produit */}
        <div>
          <label className="label">Produit *</label>
          <input
            type="text"
            className="input"
            placeholder="ex : Bouillie bordelaise, Mancozèbe…"
            value={form.produit}
            onChange={e => setField('produit', e.target.value)}
            required
          />
        </div>

        {/* Dose + Opérateur */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dose</label>
            <input
              type="text"
              className="input"
              placeholder="ex : 2 L/ha"
              value={form.dose}
              onChange={e => setField('dose', e.target.value)}
            />
          </div>
          <div>
            <label className="label">DAR (jours)</label>
            <input
              type="number"
              className="input"
              placeholder="ex : 28"
              min="0"
              value={form.dar}
              onChange={e => setField('dar', e.target.value)}
            />
          </div>
        </div>

        {/* Opérateur */}
        <div>
          <label className="label">Opérateur</label>
          <input
            type="text"
            className="input"
            placeholder="Nom de la personne ayant effectué le traitement"
            value={form.operateur}
            onChange={e => setField('operateur', e.target.value)}
          />
        </div>

        {/* Conditions météo */}
        <div>
          <label className="label">Conditions météo</label>
          <input
            type="text"
            className="input"
            placeholder="ex : Ensoleillé, 18°C, vent faible"
            value={form.conditions}
            onChange={e => setField('conditions', e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Observations, remarques…"
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Créer le traitement'}
        </button>

        {isEdit && (
          confirmDelete ? (
            <div className="card border-red-200 bg-red-50 space-y-3">
              <p className="text-red-700 font-medium text-sm text-center">
                Supprimer ce traitement ?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="btn-secondary py-2 text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn-danger py-2 text-sm"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 text-red-500 py-2 text-sm font-medium"
            >
              <Trash2 size={16} />
              Supprimer ce traitement
            </button>
          )
        )}
      </form>
    </div>
  )
}
