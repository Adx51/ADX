import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Trash2, ChevronDown, Search, LayoutTemplate } from 'lucide-react'
import { api } from '../../lib/api'
import { uploadPhoto } from '../../lib/uploadPhoto'
import PageHeader from '../../components/PageHeader'
import PhotoInput from '../../components/PhotoInput'

const COMMUNE_ORDER = ['Chouilly', 'Hautvillers']

function groupParcellesByCommune(parcelles) {
  const groups = {}
  for (const p of parcelles) {
    const key = p.commune || 'Sans commune'
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  const known = COMMUNE_ORDER.filter(c => groups[c])
  const other = Object.keys(groups).filter(c => !COMMUNE_ORDER.includes(c)).sort()
  return [...known, ...other].map(commune => ({ commune, parcelles: groups[commune] }))
}

function ParcellePicker({ parcelles, value, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const selected = parcelles.find(p => p.id === value)

  const filtered = search.trim()
    ? parcelles.filter(p =>
        p.nom.toLowerCase().includes(search.toLowerCase()) ||
        (p.commune || '').toLowerCase().includes(search.toLowerCase()))
    : parcelles

  const groups = groupParcellesByCommune(filtered)
  const multiCommune = groups.length > 1

  function select(id) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <div
        className="input flex items-center justify-between cursor-pointer select-none"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.nom : '— Toutes les parcelles —'}
        </span>
        <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch('') }} />
          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une parcelle…"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-vigne-400"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <button
                type="button"
                onClick={() => select('')}
                className={`w-full px-4 py-2.5 text-left text-sm italic text-gray-400 hover:bg-gray-50 active:bg-gray-100 ${!value ? 'bg-vigne-50' : ''}`}
              >
                — Toutes les parcelles —
              </button>

              {groups.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 italic text-center">Aucun résultat</p>
              ) : groups.map(({ commune, parcelles: list }) => (
                <div key={commune}>
                  {multiCommune && (
                    <div className="px-4 py-1.5 text-xs font-semibold text-vigne-700 uppercase tracking-wide bg-gray-50 border-t border-gray-100">
                      {commune}
                    </div>
                  )}
                  {list.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => select(p.id)}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-vigne-50 active:bg-vigne-100 ${value === p.id ? 'bg-vigne-50 font-semibold text-vigne-700' : 'text-gray-900'}`}
                    >
                      {p.nom}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function TacheForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [photo, setPhoto] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [parcelles, setParcelles] = useState([])
  const [modeles, setModeles] = useState([])
  const [parcelleId, setParcelleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { register, handleSubmit, setValue } = useForm()

  useEffect(() => {
    api.get('/parcelles').then(p => setParcelles(p || []))
    api.get('/referentiels/modele_tache').then(m => setModeles(m || []))

    if (isEdit) {
      api.get(`/taches/${id}`).then(t => {
        if (t) {
          setValue('titre',         t.titre)
          setValue('description',   t.description || '')
          setValue('statut',        t.statut)
          setValue('priorite',      t.priorite)
          setValue('date_echeance', t.date_echeance || '')
          setParcelleId(t.parcelle_id || '')
          setExistingPhotoUrl(t.photo_url)
        }
      })
    }
  }, [id, isEdit, setValue])

  async function onSubmit(data) {
    setSaving(true)
    setError('')
    try {
      let photo_url = existingPhotoUrl
      if (photo) photo_url = await uploadPhoto(photo, 'taches')

      const payload = {
        titre:         data.titre,
        description:   data.description || null,
        parcelle_id:   parcelleId || null,
        statut:        data.statut || 'a_faire',
        priorite:      data.priorite || 'normale',
        date_echeance: data.date_echeance || null,
        photo_url,
      }

      if (isEdit) {
        await api.put(`/taches/${id}`, payload)
      } else {
        await api.post('/taches', payload)
      }
      navigate('/taches')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function deleteTache() {
    await api.delete(`/taches/${id}`)
    navigate('/taches')
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'} back="/taches" />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 pt-4 space-y-5 pb-8">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

        {!isEdit && modeles.length > 0 && (
          <div>
            <label className="label flex items-center gap-1.5">
              <LayoutTemplate size={13} className="text-vigne-600" />
              Type de tâche
            </label>
            <select
              className="input"
              defaultValue=""
              onChange={e => { if (e.target.value) setValue('titre', e.target.value) }}
            >
              <option value="">— Choisir une tâche —</option>
              {modeles.map((m, i) => (
                <option key={i} value={m.valeur}>{m.valeur}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Tâche *</label>
          <input className="input" placeholder="ex: Traitement fongicide" {...register('titre', { required: true })} />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" placeholder="Détails..." {...register('description')} />
        </div>

        <div>
          <label className="label">Parcelle concernée</label>
          <ParcellePicker parcelles={parcelles} value={parcelleId} onChange={setParcelleId} />
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
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary py-2 text-sm">Annuler</button>
                <button type="button" onClick={deleteTache} className="btn-danger py-2 text-sm">Supprimer</button>
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
