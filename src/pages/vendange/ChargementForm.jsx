import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { Package, Scale, Clock, CalendarDays, FileText, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'
import { useBack } from '../../lib/useBack'
import PageHeader from '../../components/PageHeader'
import RepartitionParcelles, { repartirPoids } from '../../components/RepartitionParcelles'
import { format } from 'date-fns'

// Interprète une saisie libre en nombre, le plus largement possible : en
// vendange on tape vite, la valeur doit passer sans avoir à la reformater.
// Sont acceptés : « 450,5 », « 450.5 », « 1 250 », « 1 250,5 », « 450 kg »,
// « 1.250,5 », espaces insécables du clavier, etc.
//
// Règles, volontairement simples et prévisibles :
//   • les espaces et le texte (unités) sont ignorés ;
//   • s'il n'y a qu'un séparateur, c'est le séparateur DÉCIMAL — c'est ce que
//     produit le pavé numérique ;
//   • s'il y en a plusieurs, le dernier est le décimal, les précédents sont
//     des séparateurs de milliers.
// La valeur interprétée est affichée à l'écran avant enregistrement, pour que
// l'opérateur voie exactement le poids qui sera enregistré.
function toNumber(v) {
  if (v == null) return null
  let s = String(v)
    .replace(/[\s   ]/g, '')  // espaces, y compris insécables
    .replace(/[^0-9.,-]/g, '')               // unités et autres caractères
  if (!s) return null

  const dec = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'))
  if (dec !== -1) {
    const entier   = s.slice(0, dec).replace(/[.,]/g, '')
    const decimale = s.slice(dec + 1).replace(/[.,]/g, '')
    s = `${entier}.${decimale}`
  }

  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

// Affichage à la française du nombre interprété (450.5 → « 450,5 »)
function fmtFr(n) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
}

export default function ChargementForm() {
  const params = useParams()
  const isEdit = Boolean(params.vendangeId)
  const vendangeId = isEdit ? params.vendangeId : params.id
  const chargementId = isEdit ? params.id : null

  const goBack = useBack(`/vendange/parcelle/${vendangeId}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [vendange, setVendange] = useState(null)
  // Répartition d'une livraison mixte : parcelles AJOUTÉES uniquement.
  // La parcelle courante n'y figure pas, elle porte toujours le reste.
  const [repartition, setRepartition] = useState([])
  const [autresParcelles, setAutresParcelles] = useState([])

  const { register, handleSubmit, setValue, control, formState } = useForm({
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
  const dateSaisie = useWatch({ control, name: 'date_chargement' })

  // Une pesée doit être datée dans la saison de sa vendange. Un écart signale
  // presque toujours une erreur de date : on l'affiche sans bloquer la saisie.
  const anneeDate = dateSaisie ? parseInt(String(dateSaisie).slice(0, 4), 10) : null
  const anneeIncoherente = Boolean(
    vendange?.annee && anneeDate && anneeDate !== vendange.annee
  )
  const nbSaisi   = toNumber(nbCaisses)
  const kgSaisi   = toNumber(poids)
  const moyenne   = nbSaisi > 0 && kgSaisi != null
    ? (kgSaisi / nbSaisi).toFixed(1).replace('.', ',')
    : null

  useEffect(() => {
    // La date et l'heure restent celles de la saisie, toujours : en vendange
    // le rythme est soutenu et une pesée doit s'enregistrer sans réglage.
    // Le contrôle de cohérence se fait par l'avertissement affiché plus bas,
    // qui n'impose aucune manipulation.
    api.get(`/vendanges/${vendangeId}`).then(v => {
      setVendange(v)
      // Parcelles proposables pour une répartition (toutes sauf la courante)
      api.get('/parcelles')
        .then(ps => setAutresParcelles((ps || []).filter(p => p.id !== v?.parcelle_id)))
        .catch(() => {})
    })

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
    // Garde-fou : une saisie illisible ne doit JAMAIS partir au serveur.
    // NaN devient null en JSON et s'enregistrerait en poids 0 — une pesée
    // fausse et silencieuse est pire qu'un message d'erreur.
    const caisses = toNumber(data.nombre_caisses)
    const kg      = toNumber(data.poids_kg)
    // Après interprétation, seule une saisie sans le moindre chiffre peut
    // encore échouer. Le message indique alors ce qui a été compris.
    if (caisses == null || caisses <= 0) {
      setError(`Nombre de caisses illisible : « ${data.nombre_caisses ?? ''} ». Saisissez au moins un chiffre.`)
      return
    }
    if (kg == null || kg < 0) {
      setError(`Poids illisible : « ${data.poids_kg ?? ''} ». Saisissez au moins un chiffre.`)
      return
    }

    // Lignes de répartition réellement renseignées
    const ajoutees = repartition.filter(l => Number(l.caisses) > 0)

    setSaving(true)
    setError('')
    try {
      if (!isEdit && ajoutees.length > 0) {
        // Livraison mixte : UN SEUL appel, traité en transaction côté serveur.
        // Hors ligne cela ne fait qu'une opération en file, et une livraison
        // ne peut jamais être enregistrée à moitié.
        const caissesAjoutees = ajoutees.map(l => Number(l.caisses))
        const part = repartirPoids(kg, Math.round(caisses), caissesAjoutees)
        const resteCaisses = Math.round(caisses) - caissesAjoutees.reduce((s, c) => s + c, 0)

        const lignes = [
          // La parcelle courante porte le reste — omise si tout a été réparti
          ...(resteCaisses > 0
            ? [{ parcelle_id: vendange.parcelles?.id ?? vendange.parcelle_id,
                 nombre_caisses: resteCaisses, poids_kg: part.courante }]
            : []),
          ...ajoutees.map((l, i) => ({
            parcelle_id: l.parcelle_id,
            nombre_caisses: Number(l.caisses),
            poids_kg: part.ajoutees[i],
          })),
        ]

        await api.post('/livraisons', {
          annee:           vendange.annee,
          date_chargement: data.date_chargement,
          heure_livraison: data.heure_livraison || null,
          notes:           data.notes || null,
          lignes,
        })
        api.invalidate(`/vendanges/${vendangeId}`)
        api.invalidate('/campagnes')
        goBack()
        return
      }

      const payload = {
        vendange_id:     vendangeId,
        nombre_caisses:  Math.round(caisses),
        poids_kg:        kg,
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
      // Retour à l'écran d'où l'on vient SANS laisser le formulaire dans
      // l'historique — sinon le bouton précédent y ramènerait.
      goBack()
    } catch (e) {
      // Hors ligne : la saisie est déjà en file dans IndexedDB, elle n'est
      // PAS perdue. On sort comme pour un enregistrement réussi, sinon
      // l'utilisateur croit à un échec, ressaisit, et crée un doublon de pesée.
      // Le bandeau ambré indique le nombre de saisies en attente d'envoi.
      if (e?.offline) { goBack(); return }
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
        dirty={formState.isDirty && !saving}
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

        {/* Date hors de la saison de la vendange — presque toujours une erreur */}
        {anneeIncoherente && (
          <div className="bg-orange-50 border border-orange-300 text-orange-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              La date saisie est en <strong>{anneeDate}</strong> alors que cette
              vendange est celle de <strong>{vendange.annee}</strong>. Vérifiez la
              date : la pesée apparaîtrait dans le récap {vendange.annee} avec une
              date {anneeDate}.
            </span>
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
                <input type="text" inputMode="numeric"
                       autoFocus={!isEdit}
                       className="w-full text-center text-4xl font-bold text-gray-900 outline-none bg-transparent py-1"
                       placeholder="0"
                       {...register('nombre_caisses', { required: true, min: 1, valueAsNumber: false })} />
              </div>
              <div className="p-4 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-3">
                  <Scale size={15} className="text-amber-500" />
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Poids (kg) *</label>
                </div>
                <input type="text" inputMode="decimal"
                       className="w-full text-center text-4xl font-bold text-amber-700 outline-none bg-transparent py-1"
                       placeholder="0"
                       {...register('poids_kg', { required: true, min: 0, valueAsNumber: false })} />
              </div>
            </div>

            {/* Ce qui sera réellement enregistré, tel qu'interprété. Permet de
                vérifier d'un coup d'œil qu'une saisie libre (« 1 250 kg »,
                « 450,5 ») a bien été comprise, sans jamais bloquer la saisie. */}
            {moyenne && (
              <div className="border-t border-gray-100 bg-vigne-50 px-4 py-3 text-center">
                <p className="text-vigne-800 font-semibold text-sm">
                  {fmtFr(kgSaisi)} kg ÷ {fmtFr(nbSaisi)} caisses
                  {' = '}
                  <span className="text-lg font-bold">{moyenne} kg/caisse</span>
                </p>
              </div>
            )}

            {/* Répartition entre parcelles — repliée par défaut, invisible
                quand la livraison ne concerne qu'une parcelle. */}
            {!isEdit && moyenne && (
              <RepartitionParcelles
                parcelles={autresParcelles}
                lignes={repartition}
                setLignes={setRepartition}
                totalCaisses={nbSaisi}
                totalKg={kgSaisi}
                nomParcelleCourante={vendange?.parcelles?.nom || 'Cette parcelle'}
              />
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
