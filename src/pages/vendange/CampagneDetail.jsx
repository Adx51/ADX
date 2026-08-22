import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit2, Trash2, Lock, Unlock, ChevronRight, Grape, TrendingUp, TrendingDown, Calendar, CalendarDays, Target, Plus, FileText, Users, Search, X, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { caToDisplay, rendementKgHa } from '../../lib/surface'
import PageHeader from '../../components/PageHeader'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'
import ResteAVendanger from '../../components/ResteAVendanger'

const fmtKg = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

export default function CampagneDetail() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const { user, readOnly } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [campagne, setCampagne] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCloture, setConfirmCloture] = useState(false)
  const [bilanEdit, setBilanEdit] = useState(false)
  const [bilanValue, setBilanValue] = useState('')
  const [search, setSearch] = useState('')
  // Onglet ouvert. « parcelles » par défaut : pendant la vendange c'est l'écran
  // de travail, on y tape un chargement toutes les cinq minutes.
  const [tab, setTab] = useState('parcelles')
  // Communes repliées — partagé par les sections En cours / À vendanger /
  // Clôturées, pour qu'une commune masquée le soit partout.
  const [collapsed, setCollapsed] = useState(new Set())

  // Verrou anti-double-tap : empêche deux créations de vendange concurrentes
  // pour la même parcelle (sinon navigation cassée / doublons côté serveur).
  const creatingRef = useRef(new Set())

  const refreshTick = useRefreshTrigger()
  useEffect(() => { load() }, [annee, refreshTick])

  async function load() {
    const data = await api.get(`/campagnes/${annee}`)
    setCampagne(data)
    setBilanValue(data?.note_bilan || '')
    setLoading(false)
  }

  async function cloturer() {
    await api.post(`/campagnes/${annee}/cloturer`)
    setConfirmCloture(false)
    load()
  }

  async function rouvrir() {
    await api.post(`/campagnes/${annee}/rouvrir`)
    load()
  }

  async function deleteCampagne() {
    await api.delete(`/campagnes/${annee}`)
    navigate('/vendange')
  }

  async function saveBilan() {
    await api.put(`/campagnes/${annee}`, { note_bilan: bilanValue })
    setBilanEdit(false)
    load()
  }

  // Crée la vendange si besoin, en se protégeant des taps multiples.
  async function ensureVendange(parcelle_id, vendange_id) {
    if (vendange_id) return vendange_id
    if (readOnly) return null // consultation : on ne crée pas de vendange à la volée
    if (creatingRef.current.has(parcelle_id)) return null // création déjà en cours
    creatingRef.current.add(parcelle_id)
    try {
      const v = await api.post('/vendanges', { parcelle_id, annee: parseInt(annee) })
      return v?.id || null
    } finally {
      creatingRef.current.delete(parcelle_id)
    }
  }

  async function openParcelle(parcelle_id, vendange_id) {
    const id = await ensureVendange(parcelle_id, vendange_id)
    if (id) navigate(`/vendange/parcelle/${id}`)
  }

  async function quickChargement(parcelle_id, vendange_id) {
    const id = await ensureVendange(parcelle_id, vendange_id)
    if (id) navigate(`/vendange/parcelle/${id}/chargement/new`)
  }

  if (loading) return (
    <div>
      <PageHeader title="Chargement..." back="/vendange" />
      <div className="px-4 pt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card skeleton h-16" />)}
      </div>
    </div>
  )

  if (!campagne) return (
    <div>
      <PageHeader title="Introuvable" back="/vendange" />
      <p className="text-center py-8 text-gray-500">Cette campagne n'existe pas.</p>
    </div>
  )

  const isClosed = campagne.statut === 'cloturee'
  // En lecture seule : aucune écriture (mêmes verrous qu'une campagne clôturée)
  const canWrite = !isClosed && !readOnly
  const parcelles = campagne.parcelles || []

  // Quand clôturée : utiliser les valeurs figées au moment de la clôture
  const totalPoids = isClosed && campagne.poids_total_cloture != null
    ? campagne.poids_total_cloture
    : parcelles.reduce((s, p) => s + (p.poids_total || 0), 0)

  const totalCaisses = parcelles.reduce((s, p) => s + (p.nb_caisses_total || 0), 0)

  const totalSurfaceActiveCa = parcelles
    .filter(p => p.vendange_id)
    .reduce((s, p) => s + (p.surface_totale_ca || 0), 0)
  const rendementMoyen = rendementKgHa(totalPoids, totalSurfaceActiveCa)

  const attendu = campagne.rendement_attendu_kgha

  // Total kg attendu sur toutes les parcelles de la campagne
  const kgAttenduTotal = isClosed && campagne.kg_attendu_cloture != null
    ? campagne.kg_attendu_cloture
    : attendu
      ? Math.round(attendu * parcelles.reduce((s, p) => s + (p.surface_totale_ca || 0), 0) / 10000)
      : null

  const pctTotal = kgAttenduTotal ? Math.min(Math.round((totalPoids / kgAttenduTotal) * 100), 999) : null
  // Kilos restant à rentrer pour atteindre l'objectif de la campagne.
  // Nul une fois l'objectif atteint : on n'affiche pas de reste négatif.
  const resteGlobal = kgAttenduTotal ? Math.max(0, kgAttenduTotal - totalPoids) : 0

  const nbEnCours = parcelles.filter(p => p.vendange_id && p.vendange_statut !== 'cloturee').length

  // Score tri : vendange active=0, non commencée=1, clôturée=2
  const parcelleScore = p => {
    if (p.vendange_statut === 'cloturee') return 2
    if (p.vendange_id) return 0
    return 1
  }
  const sorted = [...parcelles].sort((a, b) => {
    const sa = parcelleScore(a), sb = parcelleScore(b)
    if (sa !== sb) return sa - sb
    const cA = (a.commune || '').localeCompare(b.commune || '', 'fr')
    if (cA !== 0) return cA
    return a.nom.localeCompare(b.nom, 'fr')
  })

  // Recherche : nom, commune ou pressoir
  const q = search.trim().toLowerCase()
  const visibles = q
    ? sorted.filter(p =>
        (p.nom || '').toLowerCase().includes(q) ||
        (p.commune || '').toLowerCase().includes(q) ||
        (p.commune_pressoir || '').toLowerCase().includes(q))
    : sorted

  const actives    = visibles.filter(p => p.vendange_id && p.vendange_statut !== 'cloturee')
  const nonLancees = visibles.filter(p => !p.vendange_id)
  const clotsurees = visibles.filter(p => p.vendange_statut === 'cloturee')

  // En-têtes de commune dès que la campagne en compte plusieurs, pour que le
  // repli soit disponible de façon homogène dans les trois sections.
  const nbCommunes = new Set(parcelles.map(p => (p.commune || '').trim()).filter(Boolean)).size
  const showVillage = nbCommunes > 1
  function toggleCommune(c) {
    setCollapsed(prev => {
      const n = new Set(prev)
      n.has(c) ? n.delete(c) : n.add(c)
      return n
    })
  }
  // Une recherche en cours déplie tout : on veut voir les résultats.
  const sectionProps = {
    showVillage, collapsed: q ? new Set() : collapsed, onToggleCommune: toggleCommune,
  }

  return (
    <div>
      <PageHeader title={`Vendange ${campagne.annee}`} back="/vendange">
        {canWrite && (
          <button onClick={() => navigate(`/vendange/${annee}/edit`)}
                  className="p-2 rounded-full active:bg-vigne-600">
            <Edit2 size={18} />
          </button>
        )}
      </PageHeader>

      {/* Bandeau de tête, au-dessus des onglets : le récap chiffré est ce que
          l'on regarde en permanence pendant la vendange, il ne doit jamais
          demander de changer d'onglet. */}
      <div className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">
          {isClosed && (
            <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
              <Lock size={14} />
              <span>Clôturée le {campagne.date_cloture ? format(parseISO(campagne.date_cloture), 'd MMMM yyyy', { locale: fr }) : ''}</span>
            </div>
          )}

          {/* Stats globales */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-amber-800">{fmtKg(Math.round(totalPoids))}</p>
                <p className="text-xs text-amber-600 mt-0.5">kg récoltés</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-800">{totalCaisses}</p>
                <p className="text-xs text-amber-600 mt-0.5">caisses</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-vigne-700">
                  {rendementMoyen ? rendementMoyen.toLocaleString('fr-FR') : '—'}
                </p>
                <p className="text-xs text-vigne-600 mt-0.5">kg/ha moyen</p>
              </div>
            </div>

            {/* Barre total récolté / attendu */}
            {kgAttenduTotal != null && (
              <div>
                {/* Le total récolté figure déjà en gros juste au-dessus :
                    on ne rappelle ici que l'objectif. */}
                <p className="text-xs text-center text-amber-600 mb-1">
                  sur {kgAttenduTotal.toLocaleString('fr-FR')} kg attendus
                  {isClosed && <span className="text-gray-400 ml-1">(figé)</span>}
                </p>
                <div className="h-2.5 bg-amber-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pctTotal > 100 ? 'bg-vigne-600' : 'bg-amber-600'}`}
                       style={{ width: `${Math.min(pctTotal, 100)}%` }} />
                </div>
                {/* Ce qu'il reste à rentrer pour atteindre l'objectif : la
                    donnée que l'on cherche en cours de vendange. */}
                {resteGlobal > 0 && (
                  <p className="text-center mt-1.5">
                    <span className="text-lg font-bold text-amber-800">{fmtKg(resteGlobal)} kg</span>
                    <span className="text-xs text-amber-700 font-semibold"> restants</span>
                  </p>
                )}
                <p className={`text-xs text-center font-semibold mt-1 ${pctTotal > 100 ? 'text-vigne-700' : 'text-amber-700'}`}>
                  {pctTotal}% de l'objectif campagne
                </p>
              </div>
            )}

            {/* La comparaison à l'objectif n'a de sens qu'une fois la campagne
                terminée : en cours de vendange elle est mécaniquement très
                négative et alarme pour rien. */}
            {isClosed && attendu && rendementMoyen != null && (
              <RendementComparison reel={rendementMoyen} attendu={attendu} />
            )}
            {!isClosed && nbEnCours > 0 && (
              <p className="text-xs text-center text-amber-600">
                {nbEnCours} / {parcelles.length} parcelle{parcelles.length > 1 ? 's' : ''} commencée{nbEnCours > 1 ? 's' : ''}
              </p>
            )}
          </div>
      </div>

      {/* Onglets — même barre que le détail d'une parcelle. Par défaut
          « Parcelles » : c'est l'écran de travail pendant la vendange. */}
      <div className="flex bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 mt-4">
        <TabBtn id="parcelles" label="Parcelles" active={tab} onClick={setTab} />
        <TabBtn id="suivi"     label="Suivi"     active={tab} onClick={setTab} />
        <TabBtn id="rapports" label="Rapports" active={tab} onClick={setTab} />
      </div>

      <div className="px-4 pt-4 pb-24 space-y-4 max-w-3xl mx-auto">
        {tab === 'suivi' && (
          <>
          {/* Infos campagne */}
          {(campagne.date_debut || attendu) && (
            <div className="card space-y-2.5">
              {campagne.date_debut && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500">Début</span>
                  <span className="font-medium text-gray-900 ml-auto capitalize">
                    {format(parseISO(campagne.date_debut), 'd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              )}
              {attendu && (
                <div className="flex items-center gap-3 text-sm">
                  <Target size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500">Objectif</span>
                  <span className="font-medium text-gray-900 ml-auto">
                    {Number(attendu).toLocaleString('fr-FR')} kg/ha
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reste à vendanger, par commune — pilotage de fin de vendange.
              Affichage seul : aucun calcul enregistré n'est modifié. */}
          {!isClosed && (
            <ResteAVendanger parcelles={parcelles} attendu={attendu} />
          )}

          {/* Note de bilan */}
          {(isClosed || campagne.note_bilan) && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900 text-sm">Note de bilan</p>
                {!bilanEdit && !readOnly && (
                  <button onClick={() => setBilanEdit(true)} className="text-vigne-700 text-sm font-medium">
                    Modifier
                  </button>
                )}
              </div>
              {bilanEdit ? (
                <>
                  <textarea value={bilanValue} onChange={e => setBilanValue(e.target.value)}
                            className="input min-h-[80px]" placeholder="Observations, bilan, anomalies..." />
                  <div className="flex gap-2">
                    <button onClick={() => { setBilanEdit(false); setBilanValue(campagne.note_bilan || '') }}
                            className="flex-1 btn-secondary py-2 text-sm">Annuler</button>
                    <button onClick={saveBilan} className="flex-1 btn-primary py-2 text-sm">Enregistrer</button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {campagne.note_bilan || <span className="text-gray-400 italic">Aucun bilan saisi.</span>}
                </p>
              )}
            </div>
          )}

          {/* Boutons clôture / réouverture */}
          {canWrite ? (
            confirmCloture ? (
              <div className="card border-amber-200 bg-amber-50 space-y-3">
                <p className="text-amber-800 font-medium text-sm text-center">
                  Clôturer la campagne {campagne.annee} ?
                </p>
                <p className="text-xs text-amber-700 text-center">Les saisies seront verrouillées (réouverture possible).</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setConfirmCloture(false)} className="btn-secondary py-2 text-sm">Annuler</button>
                  <button onClick={cloturer} className="py-2 rounded-xl bg-amber-600 text-white text-sm font-medium">Clôturer</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmCloture(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 text-white text-sm font-semibold active:bg-amber-700">
                <Lock size={16} />
                Clôturer la campagne
              </button>
            )
          ) : readOnly ? null : (
            <button onClick={rouvrir}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium active:bg-gray-50">
              <Unlock size={16} />
              Rouvrir la campagne
            </button>
          )}

          {readOnly ? null : !confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 text-red-500 py-3 text-sm font-medium">
              <Trash2 size={16} />
              Supprimer la campagne
            </button>
          ) : (
            <div className="card border-red-200 bg-red-50 space-y-3">
              <p className="text-red-700 font-medium text-sm text-center">
                Supprimer définitivement la campagne {campagne.annee} ?
              </p>
              <p className="text-xs text-red-600 text-center">Les vendanges et chargements ne sont pas supprimés.</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmDelete(false)} className="btn-secondary py-2 text-sm">Annuler</button>
                <button onClick={deleteCampagne} className="btn-danger py-2 text-sm">Supprimer</button>
              </div>
            </div>
          )}
          </>
        )}

        {/* Onglet Rapports — ils étaient auparavant derrière une icône
            d'imprimante dans l'en-tête, que personne ne trouvait. */}
        {tab === 'rapports' && (
          <div className="card">
            <p className="font-semibold text-gray-900 text-sm mb-2">Rapports à imprimer</p>
            <div>
              <RapportLink
                icon={FileText}
                titre="Récap par pressoir"
                detail="Poids et rendement par parcelle"
                onClick={() => navigate(`/vendange/${annee}/export`)}
              />
              <RapportLink
                icon={CalendarDays}
                titre="Récap journalier"
                detail="Ce qui est rentré, jour par jour"
                onClick={() => navigate(`/vendange/${annee}/export-journalier`)}
              />
              {isAdmin && (
                <RapportLink
                  icon={Users}
                  titre="Rapport bailleur"
                  detail="Un relevé par bailleur, avec ses parcelles"
                  onClick={() => navigate(`/vendange/${annee}/bailleurs`)}
                />
              )}
            </div>
          </div>
        )}

        {tab === 'parcelles' && (
          <div>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une parcelle…"
                className="input pl-9 pr-9 py-2.5 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600">
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Le titre « Parcelles » ferait doublon avec l'onglet du même nom :
                on ne garde que le rappel du geste. */}
            {canWrite && (
              <p className="text-xs text-gray-400 text-right mb-2">+ = nouveau chargement</p>
            )}
            {parcelles.length === 0 ? (
              <div className="card text-center py-6">
                <Grape size={32} className="mx-auto text-vigne-300 mb-2" />
                <p className="text-gray-500 text-sm">Aucune parcelle enregistrée</p>
              </div>
            ) : (
              <div className="space-y-1">
                {actives.length > 0 && (
                  <div className="space-y-2">
                    <SectionLabel label="En cours" count={actives.length} />
                    <ParcelleSection {...sectionProps} parcelles={actives} attendu={attendu} campagneClosed={!canWrite}
                      onOpen={p => openParcelle(p.id, p.vendange_id)}
                      onAdd={canWrite ? (p => quickChargement(p.id, p.vendange_id)) : null} />
                  </div>
                )}

                {nonLancees.length > 0 && (
                  <div className="space-y-2">
                    <SectionLabel label="À vendanger" count={nonLancees.length} className={actives.length > 0 ? 'mt-3' : ''} />
                    <ParcelleSection {...sectionProps} parcelles={nonLancees} attendu={attendu} campagneClosed={!canWrite}
                      onOpen={p => openParcelle(p.id, p.vendange_id)}
                      onAdd={canWrite ? (p => quickChargement(p.id, p.vendange_id)) : null} />
                  </div>
                )}

                {clotsurees.length > 0 && (
                  <div className="space-y-2">
                    <SectionLabel label="Clôturées" icon={<Lock size={14} className="text-gray-400" />} count={clotsurees.length} className="mt-3" />
                    <ParcelleSection {...sectionProps} parcelles={clotsurees} attendu={attendu} campagneClosed={!canWrite}
                      closed
                      onOpen={p => openParcelle(p.id, p.vendange_id)}
                      onAdd={null} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Onglet de tête. Même dessin que celui du détail d'une parcelle, pour que la
// navigation se lise pareil d'un écran à l'autre.
function TabBtn({ id, label, active, onClick }) {
  const isActive = active === id
  return (
    <button onClick={() => onClick(id)}
      className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-vigne-600 text-vigne-700'
          : 'border-transparent text-gray-500 active:text-gray-700'
      }`}>
      {label}
    </button>
  )
}

// Ligne d'accès à un rapport imprimable : icône, nom, et une ligne qui dit ce
// qu'on y trouve. Hauteur suffisante pour être tapée avec des mains de vendange.
function RapportLink({ icon: Icon, titre, detail, onClick }) {
  return (
    // Séparateur porté par la ligne elle-même, et non par un `divide-y` : seules
    // les classes `border-*` sont réécrites en mode sombre. Pas d'arrondi non
    // plus, sinon le trait épouse le rayon et dessine une accolade.
    <button onClick={onClick}
            className="w-full flex items-center gap-3 py-2.5 text-left active:bg-amber-50
                       border-t border-gray-100 first:border-t-0">
      <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Icon size={17} className="text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-tight">{titre}</p>
        <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}

function SectionLabel({ label, icon, count, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-bold text-gray-700">{label}</span>
        {count != null && (
          <span className="text-xs font-semibold text-gray-400">({count})</span>
        )}
      </div>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

function ParcelleSection({ parcelles, attendu, campagneClosed, closed, onOpen, onAdd,
                          showVillage = false, collapsed = new Set(), onToggleCommune }) {
  if (!showVillage) {
    return (
      <div className="space-y-2">
        {parcelles.map(p => (
          <ParcelleRow key={p.id} parcelle={p} attendu={attendu}
            campagneClosed={campagneClosed} closed={closed}
            onOpen={() => onOpen(p)} onAdd={onAdd ? () => onAdd(p) : null} />
        ))}
      </div>
    )
  }

  const grouped = parcelles.reduce((acc, p) => {
    const key = p.commune || 'Sans commune'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([commune, items]) => {
        const replie = collapsed.has(commune)
        const kg = items.reduce((s2, p) => s2 + (p.poids_total || 0), 0)
        return (
          <div key={commune}>
            {/* En-tête de commune repliable : masquer les communes sur
                lesquelles on ne travaille pas aujourd'hui. */}
            <button
              onClick={() => onToggleCommune?.(commune)}
              className="w-full flex items-center gap-2 mb-1.5 pl-1 text-left"
            >
              <span className="text-xs font-medium text-gray-400">{commune}</span>
              <span className="text-xs text-gray-300">
                {items.length} parc.{kg > 0 ? ` · ${Math.round(kg).toLocaleString('fr-FR')} kg` : ''}
              </span>
              <ChevronDown
                size={13}
                className={`text-gray-400 ml-auto transition-transform duration-200 ${replie ? '-rotate-90' : ''}`}
              />
            </button>
            {!replie && (
              <div className="space-y-2">
                {items.map(p => (
                  <ParcelleRow key={p.id} parcelle={p} attendu={attendu}
                    campagneClosed={campagneClosed} closed={closed}
                    onOpen={() => onOpen(p)} onAdd={onAdd ? () => onAdd(p) : null} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ParcelleRow({ parcelle, attendu, campagneClosed, closed, onOpen, onAdd }) {
  const hasVendange = Boolean(parcelle.vendange_id)
  const rendement   = hasVendange ? rendementKgHa(parcelle.poids_total, parcelle.surface_totale_ca) : null
  const showAdd     = !campagneClosed && !closed
  // Objectif propre à la parcelle : rendement d'appellation × sa surface
  const objectifKg  = attendu ? attendu * (parcelle.surface_totale_ca || 0) / 10000 : 0
  const pct = hasVendange && objectifKg > 0
    ? Math.min(Math.round((parcelle.poids_total || 0) / objectifKg * 100), 999)
    : null

  return (
    <div className={`card p-0 overflow-hidden flex items-stretch ${closed ? 'opacity-60' : ''}`}>
      <button
        onClick={(!hasVendange && campagneClosed) ? undefined : onOpen}
        disabled={!hasVendange && campagneClosed}
        className="flex items-center gap-3 flex-1 min-w-0 text-left p-4 active:bg-gray-50"
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          closed ? 'bg-gray-100' : hasVendange ? 'bg-amber-100' : 'bg-gray-100'
        }`}>
          {closed
            ? <Lock size={16} className="text-gray-400" />
            : <Grape size={20} className={hasVendange ? 'text-amber-700' : 'text-gray-400'} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-tight break-words">{parcelle.nom}</p>
          {hasVendange ? (
            <>
              <p className="text-xs text-gray-500 mt-0.5">
                {Number(parcelle.poids_total || 0).toFixed(0)} kg · {parcelle.nb_caisses_total || 0} caisses
                {rendement && <span className="text-vigne-600"> · {rendement.toLocaleString('fr-FR')} kg/ha</span>}
              </p>
              {/* Avancement de la parcelle vis-à-vis de son propre objectif,
                  sur le modèle de la barre globale de la campagne. */}
              {pct != null && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-vigne-600' : 'bg-amber-500'}`}
                         style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className={`text-xs font-semibold flex-shrink-0 ${pct >= 100 ? 'text-vigne-700' : 'text-amber-700'}`}>
                    {pct}%
                  </span>
                </div>
              )}
              {closed && attendu && rendement != null && (
                <RendementComparison reel={rendement} attendu={attendu} compact />
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">
              {caToDisplay(parcelle.surface_totale_ca)}
              {!campagneClosed && <span className="text-amber-600 font-medium"> · Tap + pour commencer</span>}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
      </button>

      {showAdd && (
        <button
          onClick={onAdd || onOpen}
          className="flex items-center justify-center w-14 border-l border-gray-100 bg-amber-50 active:bg-amber-100 flex-shrink-0"
        >
          <Plus size={20} className="text-amber-600" />
        </button>
      )}
    </div>
  )
}

function RendementComparison({ reel, attendu, compact = false, className = '' }) {
  const diff = reel - attendu
  const pct  = Math.round((diff / attendu) * 100)
  const positif = diff >= 0
  const color = positif ? 'text-vigne-700' : 'text-orange-600'
  const Icon  = positif ? TrendingUp : TrendingDown

  if (compact) {
    return (
      <p className={`text-xs font-medium ${color} mt-0.5 flex items-center gap-1`}>
        <Icon size={12} />
        {positif ? '+' : ''}{pct}% vs objectif
      </p>
    )
  }

  return (
    <div className={`flex items-center justify-center gap-1.5 text-xs font-medium ${color} ${className}`}>
      <Icon size={14} />
      {positif ? '+' : ''}{pct}% par rapport à l'objectif ({Number(attendu).toLocaleString('fr-FR')} kg/ha)
    </div>
  )
}
