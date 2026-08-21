import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Users, Loader2, Plus, Trash2, Check } from 'lucide-react'
import { api } from '../../lib/api'
import { caToDisplay } from '../../lib/surface'
import { todayISO } from '../../lib/saison'

// Relevé des kilos dus aux bailleurs pour une saison, et suivi des livraisons.
// La part leur étant remise en raisin, souvent en plusieurs fois et par cépage,
// le document présente pour chacun : ce qui est dû, ce qui a été livré, et ce
// qui reste à livrer — puis le détail parcelle par parcelle qui justifie le dû.
const LIBELLE_TAUX = { quart: 'au quart (1/4)', tiers: 'au tiers (1/3)' }

function kg(n) {
  return Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}
function fmtDate(iso) {
  if (!iso) return ''
  const [a, m, j] = String(iso).split('T')[0].split('-')
  return `${j}/${m}/${a}`
}

export default function ReleveBailleurs() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState('')
  const [saisieFor, setSaisieFor] = useState(null)   // bailleur en cours de saisie

  async function charger() {
    try { setData(await api.get(`/bailleurs/releve/${annee}`)) }
    catch (e) { setErreur(e.message) }
  }
  useEffect(() => { charger() }, [annee])

  async function supprimerLivraison(id) {
    await api.delete(`/bailleurs/livraisons/${id}`)
    charger()
  }

  if (erreur) return <div className="p-8 text-center text-gray-500">{erreur}</div>
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <Loader2 size={28} className="animate-spin text-amber-500" />
      <p className="text-sm">Chargement…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(`/vendange/${annee}`)}
                className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-sm shrink-0">
          <ArrowLeft size={18} /> Retour
        </button>
        <p className="flex-1 text-center font-bold text-gray-900 dark:text-gray-100 text-sm">
          Bailleurs {annee}
        </p>
        <button onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold shrink-0">
          <Printer size={14} /> Imprimer
        </button>
      </div>

      <div className="light-content px-4 py-6 space-y-8 max-w-2xl mx-auto">
        {data.bailleurs.length === 0 ? (
          <div className="text-center py-16">
            <Users size={44} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Aucune parcelle en métayage</p>
            <p className="text-gray-400 text-sm mt-1">
              Renseignez le bailleur sur une parcelle pour la voir apparaître ici.
            </p>
          </div>
        ) : (
          <>
            {data.bailleurs.map(b => (
              <BlocBailleur
                key={b.bailleur}
                b={b}
                annee={parseInt(annee, 10)}
                saisieOuverte={saisieFor === b.bailleur}
                onOuvrirSaisie={() => setSaisieFor(saisieFor === b.bailleur ? null : b.bailleur)}
                onEnregistre={() => { setSaisieFor(null); charger() }}
                onSupprimer={supprimerLivraison}
              />
            ))}

            {data.bailleurs.length > 1 && (
              <div className="rounded-xl bg-gray-200 print-total-row px-4 py-3">
                <p className="font-bold text-sm text-gray-900 uppercase mb-1">
                  Total général — {data.bailleurs.length} bailleurs
                </p>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Dû {kg(data.total_du)} kg</span>
                  <span>Livré {kg(data.total_livre)} kg</span>
                  <span className="font-bold text-gray-900">Reste {kg(data.total_reste)} kg</span>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 pt-2">
              Part calculée sur la récolte enregistrée pour la saison {annee}. Le quart
              franc champenois et le tiers s'entendent sans participation du bailleur
              aux charges d'exploitation.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function BlocBailleur({ b, annee, saisieOuverte, onOuvrirSaisie, onEnregistre, onSupprimer }) {
  const solde = b.total_reste
  const couleurSolde = solde <= 0.05 ? 'text-vigne-700' : 'text-amber-700'

  return (
    <section className="break-inside-avoid space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="font-bold text-gray-900 text-lg">{b.bailleur}</h2>
        <div className="flex-1 h-px bg-gray-300" />
      </div>

      {/* Dû / livré / reste, par cépage */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border border-gray-400 bg-gray-100">
            <th className="border border-gray-400 px-2 py-1.5 text-left font-bold uppercase text-xs text-gray-900">Cépage</th>
            <th className="border border-gray-400 px-2 py-1.5 text-center font-bold uppercase text-xs w-20 text-gray-900">Dû</th>
            <th className="border border-gray-400 px-2 py-1.5 text-center font-bold uppercase text-xs w-20 text-gray-900">Livré</th>
            <th className="border border-gray-400 px-2 py-1.5 text-center font-bold uppercase text-xs w-20 text-gray-900">Reste</th>
          </tr>
        </thead>
        <tbody>
          {b.cepages.map(c => (
            <tr key={c.cepage} className="border border-gray-300">
              <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-900">{c.cepage}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">{kg(c.du)}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">{kg(c.livre)}</td>
              <td className={`border border-gray-300 px-2 py-1.5 text-center font-bold ${c.reste <= 0.05 ? 'text-vigne-700' : 'text-gray-900'}`}>
                {kg(c.reste)}
              </td>
            </tr>
          ))}
          <tr className="border border-gray-400 bg-amber-50 print-subtotal-row">
            <td className="border border-gray-400 px-2 py-1.5 text-xs font-bold text-gray-600 uppercase">Total (kg)</td>
            <td className="border border-gray-400 px-2 py-1.5 text-center font-bold text-gray-900">{kg(b.total_du)}</td>
            <td className="border border-gray-400 px-2 py-1.5 text-center font-bold text-gray-900">{kg(b.total_livre)}</td>
            <td className={`border border-gray-400 px-2 py-1.5 text-center font-bold ${couleurSolde}`}>{kg(b.total_reste)}</td>
          </tr>
        </tbody>
      </table>

      {solde <= 0.05 && b.total_du > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-vigne-700">
          <Check size={13} /> Part intégralement livrée.
        </p>
      )}

      {/* Détail des parcelles qui justifient le dû */}
      <details className="print:open" open>
        <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer print:list-none">
          Détail par parcelle
        </summary>
        <table className="w-full border-collapse text-sm mt-2">
          <tbody>
            {b.parcelles.map(p => (
              <tr key={p.id} className="border border-gray-300">
                <td className="border border-gray-300 px-2 py-1.5">
                  <span className="font-medium uppercase text-gray-900">{p.nom}</span>
                  <span className="block text-xs text-gray-400">
                    {p.cepage} · {LIBELLE_TAUX[p.taux] || p.taux}
                    {p.surface_totale_ca ? ` · ${caToDisplay(p.surface_totale_ca)}` : ''}
                  </span>
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right text-xs text-gray-500 whitespace-nowrap">
                  {kg(p.poids_total)} kg récoltés
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                  {kg(p.part_kg)} kg
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {/* Livraisons déjà faites */}
      {b.livraisons.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Livraisons</p>
          <div className="space-y-1">
            {b.livraisons.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="text-gray-500 text-xs w-20 shrink-0">{fmtDate(l.date_livraison)}</span>
                <span className="flex-1 min-w-0 truncate text-gray-700">
                  {l.cepage || 'Cépage non précisé'}
                  {l.notes && <span className="text-gray-400 text-xs"> · {l.notes}</span>}
                </span>
                <span className="font-semibold text-gray-900 shrink-0">{kg(l.poids_kg)} kg</span>
                <button onClick={() => onSupprimer(l.id)}
                        className="print:hidden p-1 text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saisie d'une livraison */}
      <div className="print:hidden">
        {saisieOuverte ? (
          <FormLivraison bailleur={b.bailleur} annee={annee}
                         cepages={b.cepages.map(c => c.cepage)}
                         onAnnuler={onOuvrirSaisie} onEnregistre={onEnregistre} />
        ) : (
          <button onClick={onOuvrirSaisie}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-vigne-300 text-vigne-700 text-sm font-medium active:bg-vigne-50">
            <Plus size={15} /> Enregistrer une livraison
          </button>
        )}
      </div>
    </section>
  )
}

function FormLivraison({ bailleur, annee, cepages, onAnnuler, onEnregistre }) {
  const [date, setDate]     = useState(todayISO())
  const [cepage, setCepage] = useState(cepages[0] || '')
  const [poids, setPoids]   = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function envoyer(e) {
    e.preventDefault()
    // Même tolérance de saisie que les pesées : virgule, espaces, unité
    const kgNum = parseFloat(String(poids).replace(/[\s   ]/g, '').replace(/[^0-9.,-]/g, '').replace(',', '.'))
    if (!Number.isFinite(kgNum) || kgNum <= 0) { setErr('Poids invalide.'); return }
    setSaving(true); setErr('')
    try {
      await api.post('/bailleurs/livraisons', {
        bailleur, annee, date_livraison: date,
        cepage: cepage || null, poids_kg: kgNum, notes: notes || null,
      })
      onEnregistre()
    } catch (e2) {
      if (e2?.offline) { onEnregistre(); return }
      setErr(e2.message); setSaving(false)
    }
  }

  return (
    <form onSubmit={envoyer} className="border border-vigne-200 rounded-xl p-3 space-y-2 bg-vigne-50/40">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        Livraison à {bailleur}
      </p>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Date</label>
          <input type="date" className="input py-2 text-sm" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Poids (kg)</label>
          <input type="text" inputMode="decimal" className="input py-2 text-sm" placeholder="0"
                 value={poids} onChange={e => setPoids(e.target.value)} autoFocus />
        </div>
      </div>
      {cepages.length > 1 && (
        <div>
          <label className="text-xs text-gray-500">Cépage livré</label>
          <select className="input py-2 text-sm" value={cepage} onChange={e => setCepage(e.target.value)}>
            {cepages.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      <input type="text" className="input py-2 text-sm" placeholder="Note (facultatif)"
             value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onAnnuler} className="btn-secondary py-2 text-sm">Annuler</button>
        <button type="submit" disabled={saving} className="btn-primary py-2 text-sm disabled:opacity-60">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
