import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../lib/api'
import { caToDisplayHa } from '../../lib/surface'

// Bilan de fin de campagne : les chiffres de l'année, la comparaison entre
// pressoirs, le classement des parcelles et — le vrai enseignement — l'écart
// de chaque parcelle à sa propre moyenne des années passées. Une parcelle à
// 6 900 kg/ha n'est pas un problème si elle fait ça tous les ans ; une parcelle
// 34 % sous sa moyenne, si.

const fmt  = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })
const fmt1 = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

function jourCourt(iso) {
  if (!iso) return '—'
  return format(parseISO(iso), 'd MMM', { locale: fr })
}

// Un écart n'a de sens qu'au-delà du bruit : sous 5 % on n'alerte pas.
function couleurEcart(pct) {
  if (pct == null) return 'text-gray-400'
  if (pct <= -20) return 'text-red-600'
  if (pct <= -5)  return 'text-amber-700'
  if (pct >= 5)   return 'text-vigne-700'
  return 'text-gray-500'
}
const signe = pct => (pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct} %`)

export default function CampagneBilan() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    api.get(`/campagnes/${annee}/bilan`)
      .then(setData)
      .catch(e => setErreur(e.message))
  }, [annee])

  if (erreur) return <div className="p-8 text-center text-gray-500">{erreur}</div>
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-500">
      <Loader2 size={28} className="animate-spin text-amber-500" />
      <p className="text-sm">Chargement…</p>
    </div>
  )

  const { campagne, totaux, pressoirs, communes, cepages, parcelles, rythme, jour_max } = data
  const rien = totaux.nb_parcelles_vendangees === 0

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(`/vendange/${annee}`)}
                className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-sm shrink-0">
          <ArrowLeft size={18} /> Retour
        </button>
        <p className="flex-1 text-center font-bold text-gray-900 dark:text-gray-100 text-sm">
          Bilan {annee}
        </p>
        <button onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold shrink-0">
          <Printer size={14} /> Imprimer
        </button>
      </div>

      <div className="light-content px-4 py-6 space-y-7 max-w-2xl mx-auto">
        <div className="text-center">
          <p className="font-bold text-base text-gray-900 uppercase tracking-wide">VENDANGES {annee}</p>
          <p className="font-semibold text-sm text-gray-600 uppercase tracking-wide">BILAN DE CAMPAGNE</p>
          <p className="text-xs text-gray-400 mt-1">
            {totaux.nb_jours > 0
              ? `Du ${jourCourt(totaux.premier_jour)} au ${jourCourt(totaux.dernier_jour)} — ${totaux.nb_jours} jour${totaux.nb_jours > 1 ? 's' : ''} de vendange`
              : 'Aucun chargement enregistré'}
            {campagne.date_cloture && ` · clôturée le ${jourCourt(campagne.date_cloture)}`}
          </p>
        </div>

        {rien ? (
          <p className="text-center text-gray-400 py-12">
            Rien n'a encore été rentré sur cette campagne.
          </p>
        ) : (
          <>
            {/* ── Chiffres clés ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi valeur={`${fmt(totaux.poids)} kg`} label="récoltés" fort />
              <Kpi valeur={fmt(totaux.caisses)} label="caisses" />
              <Kpi valeur={totaux.rendement_kgha ? `${fmt(totaux.rendement_kgha)}` : '—'} label="kg/ha moyen" fort />
              <Kpi valeur={totaux.pct_objectif != null ? `${totaux.pct_objectif} %` : '—'}
                   label={totaux.kg_attendu ? `de ${fmt(totaux.kg_attendu)} kg attendus` : 'objectif non défini'} />
            </div>

            <table className="w-full border-collapse text-sm">
              <tbody>
                <Ligne label="Surface vendangée"
                       valeur={`${caToDisplayHa(totaux.surface_vendangee_ca)} sur ${caToDisplayHa(totaux.surface_totale_ca)}`} />
                <Ligne label="Parcelles rentrées"
                       valeur={`${totaux.nb_parcelles_vendangees} sur ${totaux.nb_parcelles}`} />
                <Ligne label="Chargements" valeur={`${totaux.nb_chargements} sur ${totaux.nb_jours} jours`} />
                <Ligne label="Poids moyen par caisse"
                       valeur={totaux.poids_moyen_caisse ? `${fmt1(totaux.poids_moyen_caisse)} kg` : '—'} />
                {jour_max && (
                  <Ligne label="Plus grosse journée"
                         valeur={`${jourCourt(jour_max.date)} — ${fmt(jour_max.kg)} kg`} />
                )}
              </tbody>
            </table>

            {/* ── Par pressoir ── */}
            <Repartition titre="Par pressoir" groupes={pressoirs} avecSurface />

            {/* ── Classement des parcelles ── */}
            <section>
              <TitreSection>Parcelles — du meilleur au moins bon rendement</TitreSection>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border border-gray-400 bg-gray-100">
                    <th className="border border-gray-400 px-2 py-1.5 text-left font-bold uppercase text-[10px] text-gray-900">Parcelle</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-right font-bold uppercase text-[10px] text-gray-900 w-20">kg/ha</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-right font-bold uppercase text-[10px] text-gray-900 w-16">/ domaine</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-right font-bold uppercase text-[10px] text-gray-900 w-20">/ sa moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelles.map(p => (
                    <tr key={p.id} className="border border-gray-300">
                      <td className="border border-gray-300 px-2 py-1.5">
                        <span className="font-medium uppercase text-gray-900 text-xs">{p.nom}</span>
                        <span className="block text-[10px] text-gray-400">
                          {p.pressoir} · {fmt(p.poids)} kg · {caToDisplayHa(p.surface_totale_ca)}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-900 tabular-nums">
                        {fmt(p.rendement_kgha)}
                      </td>
                      <td className={`border border-gray-300 px-2 py-1.5 text-right tabular-nums text-xs ${couleurEcart(p.ecart_domaine_pct)}`}>
                        {signe(p.ecart_domaine_pct)}
                      </td>
                      <td className={`border border-gray-300 px-2 py-1.5 text-right tabular-nums font-semibold text-xs ${couleurEcart(p.ecart_historique_pct)}`}>
                        {p.nb_annees_historique === 0
                          ? <span className="text-gray-300 font-normal">1<sup>re</sup> année</span>
                          : <>
                              {signe(p.ecart_historique_pct)}
                              <span className="block text-[9px] text-gray-400 font-normal">
                                moy. {fmt(p.moyenne_historique_kgha)}
                              </span>
                            </>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-gray-400 mt-1">
                « / domaine » : écart au rendement moyen de l'exploitation cette année.
                « / sa moyenne » : écart à la moyenne de la parcelle sur les campagnes
                précédentes — c'est cette colonne qui signale un décrochage, indépendamment
                du millésime. Calculée sur la surface actuelle de la parcelle.
              </p>
            </section>

            {/* ── Rythme de la vendange ── */}
            {rythme.length > 1 && (
              <section>
                <TitreSection>Rythme de la vendange</TitreSection>
                <div className="space-y-1">
                  {rythme.map(j => {
                    const pct = jour_max?.kg ? Math.round(j.kg / jour_max.kg * 100) : 0
                    return (
                      <div key={j.date} className="flex items-center gap-2 text-xs">
                        <span className="w-14 shrink-0 text-gray-500">{jourCourt(j.date)}</span>
                        <div className="print-bar-track flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                          <div className="print-bar h-full bg-amber-500 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-20 text-right tabular-nums font-medium text-gray-900">{fmt(j.kg)} kg</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Répartitions secondaires ── */}
            <Repartition titre="Par commune" groupes={communes} avecSurface />
            <Repartition titre="Par cépage" groupes={cepages}
                         note="Une parcelle plantée en plusieurs cépages n'est pas ventilée : les pesées se font par parcelle." />

            {campagne.note_bilan && (
              <section>
                <TitreSection>Note de bilan</TitreSection>
                <p className="text-sm text-gray-700 whitespace-pre-wrap border border-gray-300 px-3 py-2">
                  {campagne.note_bilan}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TitreSection({ children }) {
  return (
    <div className="flex items-baseline gap-3 mb-2">
      <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wide">{children}</h2>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  )
}

function Kpi({ valeur, label, fort = false }) {
  return (
    <div className={`border border-gray-300 px-2 py-2 text-center ${fort ? 'bg-amber-50' : ''}`}>
      <p className="text-lg font-bold text-gray-900 leading-tight">{valeur}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide leading-tight mt-0.5">{label}</p>
    </div>
  )
}

function Ligne({ label, valeur }) {
  return (
    <tr className="border border-gray-300">
      <td className="border border-gray-300 px-2 py-1.5 text-gray-600 text-xs">{label}</td>
      <td className="border border-gray-300 px-2 py-1.5 text-right font-medium text-gray-900 text-xs">{valeur}</td>
    </tr>
  )
}

function Repartition({ titre, groupes, avecSurface = false, note }) {
  if (!groupes || groupes.length === 0) return null
  return (
    <section>
      <TitreSection>{titre}</TitreSection>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {groupes.map(g => (
            <tr key={g.libelle} className="border border-gray-300">
              <td className="border border-gray-300 px-2 py-1.5">
                <span className="font-medium text-gray-900 text-xs">{g.libelle}</span>
                <span className="block text-[10px] text-gray-400">
                  {g.nb_parcelles} parcelle{g.nb_parcelles > 1 ? 's' : ''}
                  {avecSurface && ` · ${caToDisplayHa(g.surface_ca)}`}
                </span>
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums text-xs w-24">
                <span className="font-semibold text-gray-900">{fmt(g.poids)} kg</span>
                <span className="block text-[10px] text-gray-400">{g.part_pct} %</span>
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums font-medium text-gray-900 text-xs w-20">
                {g.rendement_kgha ? `${fmt(g.rendement_kgha)} kg/ha` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="text-[10px] text-gray-400 mt-1">{note}</p>}
    </section>
  )
}
