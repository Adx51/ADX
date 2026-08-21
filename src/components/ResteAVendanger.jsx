import { MapPin, CheckCircle2 } from 'lucide-react'
import { caToDisplay } from '../lib/surface'

// Ce qu'il reste à vendanger, PRESSOIR par pressoir — c'est ce qui pilote la
// logistique en campagne : combien il reste encore à livrer à chacun.
//
// Le pressoir de référence d'une parcelle est sa commune de pressoir, et à
// défaut sa commune — même règle que partout ailleurs dans l'application
// (comparaison de rendement, exports).
//
// Une parcelle compte comme restante tant que sa vendange n'est pas clôturée.
// Sa surface est donc comptée en entier même si elle est déjà entamée : on ne
// peut pas savoir quelle fraction d'une parcelle a été cueillie. Le nombre de
// parcelles affiché à côté lève l'ambiguïté.
//
// Les kilos restants, eux, tiennent compte de ce qui est déjà rentré :
// pour chaque parcelle non terminée, objectif − déjà rentré (jamais négatif).
export default function ResteAVendanger({ parcelles, attendu }) {
  const restantes = (parcelles || []).filter(p => p.vendange_statut !== 'cloturee')

  if (restantes.length === 0) {
    return (
      <div className="card flex items-center gap-3">
        <CheckCircle2 size={18} className="text-vigne-600 flex-shrink-0" />
        <p className="text-sm font-medium text-vigne-700">
          Toutes les parcelles sont clôturées.
        </p>
      </div>
    )
  }

  // Regroupement par pressoir de référence
  const parCommune = new Map()
  for (const p of restantes) {
    const cle = (p.commune_pressoir || '').trim() || (p.commune || '').trim() || 'Pressoir non défini'
    if (!parCommune.has(cle)) {
      parCommune.set(cle, { commune: cle, nb: 0, enCours: 0, surface: 0, kg: 0 })
    }
    const c = parCommune.get(cle)
    c.nb += 1
    if (p.vendange_id) c.enCours += 1
    c.surface += p.surface_totale_ca || 0
    if (attendu) {
      const objectif = attendu * (p.surface_totale_ca || 0) / 10000
      c.kg += Math.max(0, objectif - (p.poids_total || 0))
    }
  }

  const communes = [...parCommune.values()].sort((a, b) => a.commune.localeCompare(b.commune, 'fr'))
  const total = communes.reduce((s, c) => ({
    nb: s.nb + c.nb, surface: s.surface + c.surface, kg: s.kg + c.kg,
  }), { nb: 0, surface: 0, kg: 0 })

  const fmtKg = n => Math.round(n).toLocaleString('fr-FR')
  const ligne = (nb, enCours) =>
    `${nb} parcelle${nb > 1 ? 's' : ''}${enCours > 0 ? ` · ${enCours} entamée${enCours > 1 ? 's' : ''}` : ''}`

  return (
    <div className="card space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Reste à vendanger <span className="normal-case font-normal text-gray-400">· par pressoir</span>
      </p>

      {communes.map(c => (
        <div key={c.commune} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
          <MapPin size={13} className="text-vigne-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{c.commune}</p>
            <p className="text-xs text-gray-400">{ligne(c.nb, c.enCours)}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold text-gray-900">{caToDisplay(c.surface)}</p>
            {attendu > 0 && (
              <p className="text-xs font-semibold text-amber-700">~{fmtKg(c.kg)} kg</p>
            )}
          </div>
        </div>
      ))}

      {communes.length > 1 && (
        <div className="flex items-center gap-3 pt-2 mt-1 border-t border-gray-200">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total</p>
            <p className="text-xs text-gray-400">{ligne(total.nb, 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{caToDisplay(total.surface)}</p>
            {attendu > 0 && (
              <p className="text-xs font-bold text-amber-700">~{fmtKg(total.kg)} kg</p>
            )}
          </div>
        </div>
      )}

      {attendu > 0 && (
        <p className="text-xs text-gray-400 pt-1">
          Kilos estimés d'après l'objectif de {Number(attendu).toLocaleString('fr-FR')} kg/ha,
          déduction faite de ce qui est déjà rentré.
        </p>
      )}
    </div>
  )
}
