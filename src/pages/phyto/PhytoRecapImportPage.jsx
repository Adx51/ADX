import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Check, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/PageHeader'

export default function PhytoRecapImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('upload') // upload | confirm
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [prestatairesRef, setPrestatairesRef] = useState([])

  useEffect(() => {
    api.get('/admin/referentiels/prestataire')
      .then(d => setPrestatairesRef(d || []))
      .catch(() => {})
  }, [])

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setParsing(true)
    setError('')
    try {
      const form = new FormData()
      form.append('pdf', file)
      const result = await fetch('/api/phyto/recaps/parse-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('adx_token')}` },
        body: form,
      })
      if (!result.ok) {
        const err = await result.json()
        throw new Error(err.error || 'Erreur serveur')
      }
      const data = await result.json()
      setParsed(data)
      setStep('confirm')
    } catch (e) {
      setError(e.message)
    }
    setParsing(false)
  }

  function updateParcelle(idx, parcelle_id) {
    setParsed(prev => ({
      ...prev,
      parcelles: prev.parcelles.map((p, i) =>
        i === idx ? { ...p, parcelle_id: parcelle_id || null, confidence: parcelle_id ? 1 : 0 } : p
      )
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await api.post('/phyto/recaps', {
        annee: parsed.annee,
        prestataire: parsed.prestataire,
        parcelles: parsed.parcelles,
        traitements: parsed.traitements || [],
      })
      api.invalidate('/phyto/rapports')
      // Si des traitements datés ont été sauvegardés, retour au registre, sinon au récap
      navigate(res.nbTraitements > 0 ? '/phyto' : '/phyto/recaps')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Import récap annuel PDF" back="/phyto/recaps" />
      <div className="px-4 pt-4 pb-8 space-y-4 md:max-w-2xl">

        {step === 'upload' && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <FileUp size={16} className="text-vigne-600" />
              <p className="font-semibold text-gray-900 dark:text-gray-100">Sélectionner le PDF récapitulatif</p>
            </div>
            <p className="text-xs text-gray-400">
              Récap annuel fourni par le prestataire (format Process2wine). Le système extrait automatiquement les IFT par parcelle.
            </p>
            <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-10 cursor-pointer transition-colors ${
              parsing ? 'border-vigne-300 bg-vigne-50/50' : 'border-gray-200 dark:border-gray-700 hover:border-vigne-300'
            }`}>
              {parsing ? (
                <>
                  <Loader2 size={32} className="text-vigne-600 animate-spin" />
                  <p className="text-sm text-vigne-600 font-medium">Lecture du PDF…</p>
                </>
              ) : (
                <>
                  <FileUp size={32} className="text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Appuyer pour choisir un fichier PDF</p>
                </>
              )}
              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFile} disabled={parsing} />
            </label>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && parsed && (
          <>
            {/* Infos générales */}
            <div className="card space-y-3">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Informations générales</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Année</label>
                  <input type="number" className="input" value={parsed.annee || ''} onChange={e => setParsed(p => ({ ...p, annee: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Prestataire</label>
                  <input
                    type="text"
                    className="input"
                    list="prestataires-ref"
                    value={parsed.prestataire || ''}
                    onChange={e => setParsed(p => ({ ...p, prestataire: e.target.value }))}
                    placeholder="Sélectionner ou taper…"
                  />
                  <datalist id="prestataires-ref">
                    {prestatairesRef.map(p => <option key={p.id} value={p.valeur} />)}
                  </datalist>
                  {parsed.prestataire && !prestatairesRef.some(p => p.valeur === parsed.prestataire) && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      Nouveau prestataire — sera ajouté au référentiel à l'enregistrement.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Debug : texte brut si 0 parcelles */}
            {parsed.parcelles.length === 0 && parsed.rawText && (
              <div className="card space-y-2">
                <p className="text-xs font-semibold text-amber-600">Texte extrait du PDF (debug — 0 parcelle détectée)</p>
                <pre className="text-xs text-gray-500 dark:text-gray-400 overflow-auto max-h-96 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-xl p-3">{parsed.rawText}</pre>
              </div>
            )}

            {/* Parcelles */}
            <div className="card space-y-3">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Parcelles ({parsed.parcelles.length}) — IFT extrait
              </p>
              {parsed.parcelles.map((p, i) => (
                <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{p.nomSource}</p>
                    {p.surfaceHa && <span className="text-xs text-gray-400">{p.surfaceHa} ha</span>}
                  </div>

                  {/* IFT values */}
                  {p.ift && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {p.ift.herbicide > 0 && <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">Herb {p.ift.herbicide}</span>}
                      {p.ift.fongicide > 0 && <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Fong {p.ift.fongicide}</span>}
                      {p.ift.insecticide > 0 && <span className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">Insect {p.ift.insecticide}</span>}
                      {p.ift.biocontrole > 0 && <span className="bg-vigne-50 dark:bg-vigne-900/20 text-vigne-700 dark:text-vigne-400 px-2 py-0.5 rounded-full">Bio {p.ift.biocontrole}</span>}
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full font-semibold">Total {p.ift.total}</span>
                      {p.cuivreKgHa != null && <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Cu {p.cuivreKgHa} kg/ha</span>}
                    </div>
                  )}

                  {/* Lien parcelle */}
                  <div className="flex items-center gap-2">
                    {p.confidence >= 0.9
                      ? <Check size={13} className="text-vigne-600 flex-shrink-0" />
                      : <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />}
                    <div className="relative flex-1">
                      <select className="input text-sm py-2 pr-8 appearance-none" value={p.parcelle_id || ''} onChange={e => updateParcelle(i, e.target.value || null)}>
                        <option value="">— Non liée —</option>
                        {parsed.allParcelles.map(ap => <option key={ap.id} value={ap.id}>{ap.nom}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Produits */}
                  {p.produits?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.produits.map((pr, j) => (
                        <span key={j} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                          {pr.nom} {pr.quantite}{pr.unite}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Traitements datés détectés */}
            {parsed.traitements?.length > 0 && (
              <div className="card space-y-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  Traitements datés détectés
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {parsed.traitements.length} traitement(s) avec date seront ajoutés au registre /phyto avec leurs produits, doses et IFT.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm card">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="space-y-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Enregistrement…' : `Enregistrer (récap + ${parsed.traitements?.length || 0} traitements)`}
              </button>
              <button onClick={() => setStep('upload')} className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400">
                ← Recommencer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
