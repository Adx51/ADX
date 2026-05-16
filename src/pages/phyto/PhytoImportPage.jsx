import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Search, Check, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/PageHeader'

export default function PhytoImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('paste') // paste | confirm
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleParse() {
    if (!text.trim()) return
    setParsing(true)
    setError('')
    try {
      const result = await api.post('/phyto/parse', { text })
      setParsed(result)
      setStep('confirm')
    } catch (e) {
      setError(e.message)
    }
    setParsing(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // OT → préfixe des notes : "OT XXXX — <notes>"
      const notesWithOT = parsed.ot
        ? `OT ${parsed.ot}${parsed.notes ? ' — ' + parsed.notes : ''}`
        : (parsed.notes || null)
      await api.post('/phyto/rapports', {
        date:        parsed.date,
        prestataire: parsed.prestataire,
        notes:       notesWithOT,
        parcelles:   parsed.parcelles,
        produits:    parsed.produits,
      })
      navigate('/phyto')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  function updateParcelle(idx, parcelle_id) {
    const match = parsed.allParcelles.find(p => p.id === parcelle_id)
    setParsed(prev => ({
      ...prev,
      parcelles: prev.parcelles.map((p, i) =>
        i === idx ? { ...p, parcelle_id, nom: match?.nom || null, confidence: parcelle_id ? 1 : 0 } : p
      )
    }))
  }

  return (
    <div>
      <PageHeader title="Import depuis email" back="/phyto" />

      <div className="px-4 pt-4 pb-8 space-y-4 md:max-w-2xl">

        {step === 'paste' && (
          <>
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-vigne-600" />
                <p className="font-semibold text-gray-900 dark:text-gray-100">Coller le texte de l'email</p>
              </div>
              <p className="text-xs text-gray-400">
                Ouvre l'email du prestataire → sélectionne tout le texte → colle ici.
              </p>
              <textarea
                className="input text-sm resize-none"
                rows={12}
                placeholder={"Traitement phytosanitaire effectué le 08/05/2026\n\nBAS CAURES BOYER (0,146 ha - 8 mai 2026, 07:32:53)\n..."}
                value={text}
                onChange={e => setText(e.target.value)}
              />
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <button
                onClick={handleParse}
                disabled={!text.trim() || parsing}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {parsing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {parsing ? 'Analyse en cours…' : 'Analyser'}
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && parsed && (
          <>
            {/* Date + prestataire */}
            <div className="card space-y-3">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Informations générales</p>
              <div>
                <label className="label">Date du traitement</label>
                <input
                  type="date"
                  className="input"
                  value={parsed.date || ''}
                  onChange={e => setParsed(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Prestataire</label>
                <input
                  type="text"
                  className="input"
                  value={parsed.prestataire || ''}
                  onChange={e => setParsed(p => ({ ...p, prestataire: e.target.value }))}
                  placeholder="Nom du prestataire"
                />
              </div>
              <div>
                <label className="label">N° OT (optionnel)</label>
                <input
                  type="text"
                  className="input"
                  value={parsed.ot || ''}
                  onChange={e => setParsed(p => ({ ...p, ot: e.target.value }))}
                  placeholder="ex: 8284"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="label">Description (optionnel)</label>
                <input
                  type="text"
                  className="input"
                  value={parsed.notes || ''}
                  onChange={e => setParsed(p => ({ ...p, notes: e.target.value }))}
                  placeholder="ex: T1 Circuit 2 Conv."
                />
              </div>
            </div>

            {/* Parcelles */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  Parcelles ({parsed.parcelles.length})
                </p>
              </div>
              {parsed.parcelles.length === 0 && (
                <p className="text-sm text-gray-400">Aucune parcelle détectée dans le texte.</p>
              )}
              {parsed.parcelles.map((p, i) => (
                <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.nom_source}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {p.surface_ha && <span>{p.surface_ha} ha</span>}
                      {p.heure && <span>{p.heure}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.confidence >= 0.9 ? (
                      <Check size={14} className="text-vigne-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                    )}
                    <div className="relative flex-1">
                      <select
                        className="input text-sm py-2 pr-8 appearance-none"
                        value={p.parcelle_id || ''}
                        onChange={e => updateParcelle(i, e.target.value || null)}
                      >
                        <option value="">— Non liée —</option>
                        {parsed.allParcelles.map(ap => (
                          <option key={ap.id} value={ap.id}>{ap.nom}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  {p.confidence < 0.9 && p.confidence > 0 && (
                    <p className="text-xs text-amber-500">Correspondance approximative — vérifiez</p>
                  )}
                  {p.confidence === 0 && (
                    <p className="text-xs text-gray-400">Non reconnue — sélectionnez manuellement</p>
                  )}
                </div>
              ))}
            </div>

            {/* Produits */}
            <div className="card space-y-3">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Produits ({parsed.produits.length})
              </p>
              {parsed.produits.length === 0 && (
                <p className="text-sm text-gray-400">Aucun produit détecté — le format du tableau n'a pas été reconnu.</p>
              )}
              {parsed.produits.map((p, i) => (
                <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 space-y-1.5">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{p.nom}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    {p.matiere_active && <span>🧪 {p.matiere_active}</span>}
                    {p.cible         && <span>🎯 {p.cible}</span>}
                    {p.dose          && <span>💧 {p.dose}</span>}
                  </div>
                  <div className="flex gap-3 text-xs">
                    {p.znt  && <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">ZNT {p.znt}</span>}
                    {p.dar  && <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">DAR {p.dar}j</span>}
                    {p.dre  && <span className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">DRE {p.dre}</span>}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm card">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="space-y-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Enregistrement…' : 'Enregistrer le rapport'}
              </button>
              <button onClick={() => setStep('paste')} className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400">
                ← Recommencer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
