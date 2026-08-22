import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Users, Loader2, Plus, Trash2, Check } from 'lucide-react'
import { api } from '../../lib/api'
import { caToDisplay, rendementKgHa } from '../../lib/surface'
import { todayISO } from '../../lib/saison'

// Relevé des kilos dus aux bailleurs pour une saison, et suivi des livraisons.
// La part leur étant remise en raisin, souvent en plusieurs fois et par cépage,
// le document présente pour chacun : ce qui est dû, ce qui a été livré, et ce
// qui reste à livrer — puis le détail parcelle par parcelle qui justifie le dû.
//
// Le dû se calcule sur la récolte ATTENDUE de chaque parcelle (rendement de la
// campagne × surface), jamais sur les kilos réellement rentrés.
const LIBELLE_TAUX = { quart: 'au quart (1/4)', tiers: 'au tiers (1/3)' }
const TOUS = '__tous__'

// « au tiers (1/3) » → « (1/3) » : la fraction seule suffit en tête de colonne.
const fraction = taux => {
  const m = /\(([^)]+)\)/.exec(LIBELLE_TAUX[taux] || '')
  return m ? ` (${m[1]})` : ''
}

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
  // Bailleur affiché. Le relevé se remet en main propre, un bailleur à la
  // fois : on ouvre donc sur un seul, pas sur la liste de tout le monde.
  const [sel, setSel] = useState(null)

  async function charger() {
    try {
      const d = await api.get(`/bailleurs/releve/${annee}`)
      setData(d)
      setSel(prev => {
        const noms = (d?.bailleurs || []).map(b => b.bailleur)
        if (prev && (prev === TOUS || noms.includes(prev))) return prev
        return noms[0] || null
      })
    }
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

  const affiches = sel && sel !== TOUS
    ? data.bailleurs.filter(b => b.bailleur === sel)
    : data.bailleurs

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
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

        {/* Choix du bailleur : le relevé imprimé ne contient alors que ses
            parcelles, c'est le document qu'on lui remet. */}
        {data.bailleurs.length > 1 && (
          <select value={sel ?? TOUS} onChange={e => setSel(e.target.value)}
                  className="input py-2 text-sm text-center font-medium">
            {data.bailleurs.map(b => (
              <option key={b.bailleur} value={b.bailleur}>{b.bailleur}</option>
            ))}
            <option value={TOUS}>Tous les bailleurs ({data.bailleurs.length})</option>
          </select>
        )}
      </div>

      <div className="light-content px-4 py-6 space-y-8 max-w-2xl mx-auto">
        {/* En-tête du document imprimé — la barre ci-dessus ne s'imprime pas. */}
        {data.bailleurs.length > 0 && (
          <div className="text-center">
            <p className="font-bold text-base text-gray-900 uppercase tracking-wide">
              VENDANGES {annee}
            </p>
            <p className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
              {sel === TOUS ? 'RELEVÉ DES BAILLEURS' : 'RELEVÉ BAILLEUR'}
            </p>
          </div>
        )}

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
            {!data.rendement_attendu_kgha && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                <p className="font-semibold text-amber-900 text-sm">
                  Rendement attendu non renseigné
                </p>
                <p className="text-amber-800 text-sm mt-0.5">
                  Le dû se calcule sur la récolte attendue. Renseignez le rendement
                  de la campagne {annee} pour que ce relevé se remplisse.
                </p>
              </div>
            )}

            {affiches.map(b => (
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

            {affiches.length > 1 && (
              <div className="rounded-xl bg-gray-200 print-total-row px-4 py-3">
                <p className="font-bold text-sm text-gray-900 uppercase mb-1">
                  Total général — {affiches.length} bailleurs
                </p>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Dû {kg(data.total_du)} kg</span>
                  <span>Livré {kg(data.total_livre)} kg</span>
                  <span className="font-bold text-gray-900">Reste {kg(data.total_reste)} kg</span>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 pt-2">
              Part calculée sur la récolte attendue de chaque parcelle
              {data.rendement_attendu_kgha
                ? ` (${kg(data.rendement_attendu_kgha)} kg/ha × surface)`
                : ''}, et non sur les kilos effectivement rentrés. Le quart franc
              champenois et le tiers s'entendent sans participation du bailleur
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

      {/* Rapport complet de chaque parcelle du bailleur : identité, pesées,
          rendement, récolte attendue et part qui en découle. Pas de ventilation
          par cépage — les pesées se font par parcelle. */}
      <div className="space-y-3">
        {b.parcelles.map(p => <RapportParcelle key={p.id} p={p} />)}
      </div>

      {/* Récapitulatif du bailleur */}
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr className="border border-gray-400 bg-amber-50 print-subtotal-row">
            <td className="border border-gray-400 px-2 py-1.5 text-xs font-bold text-gray-600 uppercase">Total (kg)</td>
            <td className="border border-gray-400 px-2 py-1.5 text-center w-20">
              <span className="block text-[10px] uppercase text-gray-500">Dû</span>
              <span className="font-bold text-gray-900">{kg(b.total_du)}</span>
            </td>
            <td className="border border-gray-400 px-2 py-1.5 text-center w-20">
              <span className="block text-[10px] uppercase text-gray-500">Livré</span>
              <span className="font-bold text-gray-900">{kg(b.total_livre)}</span>
            </td>
            <td className="border border-gray-400 px-2 py-1.5 text-center w-20">
              <span className="block text-[10px] uppercase text-gray-500">Reste</span>
              <span className={`font-bold ${couleurSolde}`}>{kg(b.total_reste)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {solde <= 0.05 && b.total_du > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-vigne-700">
          <Check size={13} /> Part intégralement livrée.
        </p>
      )}

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
                         cepages={[...new Set(b.parcelles.map(p => p.cepage).filter(Boolean))]}
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

// Rapport complet d'une parcelle en métayage : son identité, toutes ses pesées,
// son rendement, sa récolte attendue et la part qui en découle. C'est le même
// niveau de détail que le récap par pressoir, restreint aux vignes du bailleur.
function RapportParcelle({ p }) {
  const chargements = p.chargements || []
  const rendement   = rendementKgHa(p.poids_total, p.surface_totale_ca)
  const identite    = [p.commune, p.cepage, LIBELLE_TAUX[p.taux] || p.taux]
    .filter(Boolean).join(' · ')

  return (
    <div className="border border-gray-400 break-inside-avoid">
      <div className="bg-gray-100 px-2 py-1.5 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold uppercase text-gray-900 text-sm leading-tight">{p.nom}</p>
          <p className="text-xs text-gray-500">{identite}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-gray-700">{caToDisplay(p.surface_totale_ca)}</p>
          {p.reference_cadastrale && (
            <p className="text-[10px] text-gray-400">{p.reference_cadastrale.replace(/,/g, ', ')}</p>
          )}
        </div>
      </div>

      {chargements.length === 0 ? (
        <p className="px-2 py-2 text-xs text-gray-400 italic">Aucun chargement sur cette parcelle.</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-t border-gray-300 bg-gray-50">
              <th className="px-2 py-1 text-left font-semibold uppercase text-[10px] text-gray-500">Date</th>
              <th className="px-2 py-1 text-left font-semibold uppercase text-[10px] text-gray-500 w-14">Heure</th>
              <th className="px-2 py-1 text-right font-semibold uppercase text-[10px] text-gray-500 w-16">Caisses</th>
              <th className="px-2 py-1 text-right font-semibold uppercase text-[10px] text-gray-500 w-20">Poids</th>
            </tr>
          </thead>
          <tbody>
            {chargements.map(c => (
              <tr key={c.id} className="border-t border-gray-200">
                <td className="px-2 py-1 tabular-nums text-gray-700">{fmtDate(c.date_chargement)}</td>
                <td className="px-2 py-1 tabular-nums text-gray-400">
                  {c.heure_livraison ? c.heure_livraison.slice(0, 5) : '—'}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-gray-700">{c.nombre_caisses}</td>
                <td className="px-2 py-1 text-right tabular-nums font-medium text-gray-900">{kg(c.poids_kg)} kg</td>
              </tr>
            ))}
            <tr className="border-t border-gray-400 bg-amber-50 print-subtotal-row">
              <td className="px-2 py-1 font-bold uppercase text-[10px] text-gray-600" colSpan={2}>Total récolté</td>
              <td className="px-2 py-1 text-right font-bold text-gray-900">{p.nb_caisses_total}</td>
              <td className="px-2 py-1 text-right font-bold text-gray-900">{kg(p.poids_total)} kg</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="border-t border-gray-400 grid grid-cols-3 text-center">
        <ChiffreParcelle label="Rendement" valeur={rendement ? `${rendement.toLocaleString('fr-FR')} kg/ha` : '—'} />
        <ChiffreParcelle label="Récolte attendue" valeur={`${kg(p.poids_attendu)} kg`} />
        <ChiffreParcelle label={`Part bailleur${fraction(p.taux)}`}
                         valeur={`${kg(p.part_kg)} kg`} fort />
      </div>
    </div>
  )
}

function ChiffreParcelle({ label, valeur, fort = false }) {
  return (
    <div className="px-1 py-1.5 border-r border-gray-200 last:border-r-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 leading-tight">{label}</p>
      <p className={`text-sm ${fort ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{valeur}</p>
    </div>
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
