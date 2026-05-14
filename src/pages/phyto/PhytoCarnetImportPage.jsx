import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Check, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/PageHeader'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const TYPE_COLOR = {
  fongicide:   'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  insecticide: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  herbicide:   'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  biocontrole: 'bg-vigne-50 dark:bg-vigne-900/20 text-vigne-700 dark:text-vigne-400',
  autre:       'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

export default function PhytoCarnetImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('upload')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setParsing(true)
    setError('')
    try {
      const form = new FormData()
      form.append('pdf', file)
      const result = await fetch('/api/phyto/carnet/parse-pdf', {
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

  // When user picks a parcelle for a given nom_source, update all traitements with that nom_source
  function updateParcelleForSource(nomSource, parcelle_id) {
    const ap = parsed.allParcelles.find(x => x.id === parcelle_id)
    setParsed(prev => ({
      ...prev,
      traitements: prev.traitements.map(t =>
        t.parcelle_nom_source === nomSource
          ? { ...t, parcelle_id: parcelle_id || null, nom_app: ap?.nom || null, confidence: parcelle_id ? 1 : 0 }
          : t
      ),
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.post('/phyto/carnet', {
        prestataire: parsed.prestataire,
        traitements: parsed.traitements,
      })
      api.invalidate('/phyto/rapports')
      navigate('/phyto')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  // Group traitements by parcelle_nom_source for the confirmation display
  const grouped = parsed?.traitements
    ? Object.entries(
        parsed.traitements.reduce((acc, t) => {
          const key = t.parcelle_nom_source || '(non identifiée)'
          if (!acc[key]) {
            acc[key] = {
              parcelle_id: t.parcelle_id,
              nom_app: t.nom_app,
              confidence: t.confidence,
              traitements: [],
            }
          }
          // Keep the most confident assignment for dropdown
          if (t.confidence > acc[key].confidence) {
            acc[key].parcelle_id = t.parcelle_id
            acc[key].nom_app = t.nom_app
            acc[key].confidence = t.confidence
          }
          acc[key].traitements.push(t)
          return acc
        }, {})
      )
    : []

  const totalCount = parsed?.traitements?.length ?? 0

  return (
    <div>
      <PageHeader title="Import carnet de traitement PDF" back="/phyto" />
      <div className="px-4 pt-4 pb-8 space-y-4 md:max-w-2xl">

        {step === 'upload' && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <FileUp size={16} className="text-vigne-600" />
              <p className="font-semibold text-gray-900 dark:text-gray-100">Sélectionner le PDF carnet de traitement</p>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Carnet annuel fourni par le prestataire (format Process2wine). Le système extrait les traitements par parcelle avec dates, produits, doses et IFT.
            </p>
            <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-10 cursor-pointer transition-colors ${
              parsing
                ? 'border-vigne-300 bg-vigne-50/50 dark:bg-vigne-900/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-vigne-300'
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
            {/* Résumé */}
            <div className="card">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {parsed.prestataire || 'Carnet'} — {parsed.annee}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {totalCount} traitement{totalCount > 1 ? 's' : ''} détecté{totalCount > 1 ? 's' : ''}
                {grouped.length > 0 && ` · ${grouped.length} parcelle${grouped.length > 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Debug si 0 traitements */}
            {totalCount === 0 && parsed.rawText && (
              <div className="card space-y-2">
                <p className="text-xs font-semibold text-amber-600">Texte extrait du PDF (debug — 0 traitement détecté)</p>
                <pre className="text-xs text-gray-500 dark:text-gray-400 overflow-auto max-h-96 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  {parsed.rawText}
                </pre>
              </div>
            )}

            {/* Parcelles groupées */}
            {grouped.map(([nomSource, group]) => (
              <div key={nomSource} className="card space-y-3">
                {/* En-tête parcelle */}
                <div className="flex items-center gap-2">
                  {group.confidence >= 0.9
                    ? <Check size={13} className="text-vigne-600 flex-shrink-0" />
                    : <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />}
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm flex-1 truncate">
                    📍 {nomSource}
                  </p>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {group.traitements.length} trait.
                  </span>
                </div>

                {/* Lien parcelle app */}
                <div className="relative">
                  <select
                    className="input text-sm py-2 pr-8 appearance-none"
                    value={group.parcelle_id || ''}
                    onChange={e => updateParcelleForSource(nomSource, e.target.value || null)}
                  >
                    <option value="">— Non liée —</option>
                    {parsed.allParcelles.map(ap => (
                      <option key={ap.id} value={ap.id}>{ap.nom}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {/* Liste des traitements pour cette parcelle */}
                <div className="space-y-2">
                  {group.traitements
                    .slice()
                    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                    .map((t, i) => (
                      <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {t.date ? format(parseISO(t.date), 'd MMMM yyyy', { locale: fr }) : '—'}
                          </p>
                          {t.ot_num && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">OT {t.ot_num}</span>
                          )}
                        </div>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-gray-400 dark:text-gray-500">
                              <th className="text-left font-medium pb-0.5">Produit</th>
                              <th className="text-left font-medium pb-0.5">Type</th>
                              <th className="text-right font-medium pb-0.5">Qté</th>
                              <th className="text-right font-medium pb-0.5">IFT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.produits.map((p, j) => (
                              <tr key={j} className="border-t border-gray-100 dark:border-gray-700/50">
                                <td className="py-0.5 pr-1 text-gray-700 dark:text-gray-300 max-w-[100px] truncate">{p.nom}</td>
                                <td className="py-0.5 pr-1">
                                  <span className={`px-1 py-0.5 rounded-full text-[9px] ${TYPE_COLOR[p.type] || TYPE_COLOR.autre}`}>
                                    {p.type}
                                  </span>
                                </td>
                                <td className="py-0.5 text-right text-gray-500 dark:text-gray-400">
                                  {p.quantite} {p.unite}
                                </td>
                                <td className="py-0.5 text-right text-gray-600 dark:text-gray-300 font-medium">
                                  {p.ift > 0 ? p.ift : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm card">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handleSave}
                disabled={saving || totalCount === 0}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving
                  ? 'Enregistrement…'
                  : `Enregistrer ${totalCount} traitement${totalCount > 1 ? 's' : ''}`}
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
