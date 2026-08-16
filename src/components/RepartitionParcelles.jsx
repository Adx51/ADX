import { useState } from 'react'
import { Split, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'

// Répartition d'une livraison entre plusieurs parcelles.
//
// Le pressoir ne pèse qu'une fois la remorque entière : les kilos sont donc
// répartis au prorata des caisses — exactement le calcul fait à la main
// aujourd'hui, mais sans dérive d'arrondi.
//
// Principe de saisie : la parcelle courante est TOUJOURS la ligne de reste.
// On ne saisit que les caisses des parcelles ajoutées, et la première se réduit
// d'autant. La répartition est donc juste par construction — impossible de
// perdre ou d'inventer une caisse, rien à équilibrer, aucun contrôle à passer.

// Répartit un poids total au prorata des caisses, sans perdre un gramme.
// Le calcul se fait en grammes entiers (pas de dérive flottante) et le reste
// de division revient à la parcelle courante, si bien que la somme des parts
// égale toujours exactement le poids pesé.
export function repartirPoids(totalKg, totalCaisses, caissesAjoutees) {
  const totalG = Math.round(totalKg * 1000)
  const parts = caissesAjoutees.map(c =>
    totalCaisses > 0 ? Math.round(totalG * c / totalCaisses) : 0
  )
  const resteG = totalG - parts.reduce((s, g) => s + g, 0)
  return {
    courante: resteG / 1000,
    ajoutees: parts.map(g => g / 1000),
  }
}

export default function RepartitionParcelles({
  parcelles, lignes, setLignes, totalCaisses, totalKg, nomParcelleCourante,
}) {
  const [ouvert, setOuvert] = useState(false)
  const [choix, setChoix] = useState(false)

  const caissesAjoutees = lignes.map(l => Number(l.caisses) || 0)
  const sommeAjoutee = caissesAjoutees.reduce((s, c) => s + c, 0)
  const caissesCourante = Math.max(0, totalCaisses - sommeAjoutee)
  const poids = repartirPoids(totalKg, totalCaisses, caissesAjoutees)

  const dispo = parcelles.filter(p => !lignes.some(l => l.parcelle_id === p.id))

  function ajouter(p) {
    setLignes([...lignes, { parcelle_id: p.id, nom: p.nom, caisses: '' }])
    setChoix(false)
    setOuvert(true)
  }
  function modifier(i, valeur) {
    // On ne peut pas prendre plus de caisses qu'il n'y en a dans la livraison
    const autres = caissesAjoutees.reduce((s, c, j) => j === i ? s : s + c, 0)
    const max = Math.max(0, totalCaisses - autres)
    const n = Math.min(Math.max(0, parseInt(valeur, 10) || 0), max)
    setLignes(lignes.map((l, j) => j === i ? { ...l, caisses: valeur === '' ? '' : n } : l))
  }
  function retirer(i) {
    const reste = lignes.filter((_, j) => j !== i)
    setLignes(reste)
    if (reste.length === 0) setOuvert(false)
  }

  const fmt = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })

  // Replié : un simple lien, invisible tant qu'on n'en a pas besoin
  if (!ouvert && lignes.length === 0) {
    return (
      <button
        type="button"
        onClick={() => { setOuvert(true); setChoix(true) }}
        className="w-full border-t border-gray-100 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-vigne-700 active:bg-vigne-50"
      >
        <Split size={15} />
        Répartir entre plusieurs parcelles
      </button>
    )
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Split size={14} className="text-vigne-700 flex-shrink-0" />
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">
          Répartition des {fmt(totalCaisses)} caisses
        </p>
        <button type="button" onClick={() => setOuvert(o => !o)} className="p-1 text-gray-400">
          {ouvert ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {ouvert && (
        <>
          {/* Parcelle courante — toujours le reste, jamais saisie */}
          <div className="flex items-center gap-3 bg-vigne-50 rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{nomParcelleCourante}</p>
              <p className="text-xs text-gray-500">reste de la livraison</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">{fmt(caissesCourante)} c</p>
              <p className="text-xs font-semibold text-vigne-700">{fmt(poids.courante)} kg</p>
            </div>
          </div>

          {/* Parcelles ajoutées — seul endroit où l'on saisit */}
          {lignes.map((l, i) => (
            <div key={l.parcelle_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{l.nom}</p>
                <p className="text-xs font-semibold text-amber-700">{fmt(poids.ajoutees[i] || 0)} kg</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={l.caisses}
                onChange={e => modifier(i, e.target.value)}
                placeholder="0"
                className="w-16 text-center text-lg font-bold text-gray-900 border border-gray-200 rounded-lg py-1 outline-none focus:border-vigne-400"
              />
              <span className="text-xs text-gray-400">c</span>
              <button type="button" onClick={() => retirer(i)}
                      className="p-1.5 text-gray-400 active:text-red-600 flex-shrink-0">
                <X size={15} />
              </button>
            </div>
          ))}

          {/* Choix d'une parcelle à ajouter */}
          {choix ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {dispo.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400 text-center">Aucune autre parcelle</p>
              ) : dispo.map(p => (
                <button key={p.id} type="button" onClick={() => ajouter(p)}
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-800 border-b border-gray-100 last:border-0 active:bg-vigne-50">
                  {p.nom}
                  {p.commune && <span className="text-gray-400 text-xs ml-1">· {p.commune}</span>}
                </button>
              ))}
              <button type="button" onClick={() => setChoix(false)}
                      className="w-full px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                Annuler
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setChoix(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-vigne-300 text-vigne-700 text-sm font-medium active:bg-vigne-50">
              <Plus size={15} /> Ajouter une parcelle
            </button>
          )}

          <p className="text-xs text-gray-400 text-center pt-1">
            Les kilos sont répartis au prorata des caisses. Total conservé :
            {' '}{fmt(totalKg)} kg
          </p>
        </>
      )}
    </div>
  )
}
