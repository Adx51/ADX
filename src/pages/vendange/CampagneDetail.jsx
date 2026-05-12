import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit2, Trash2, Lock, Unlock, ChevronRight, Grape, TrendingUp, TrendingDown, Calendar, Target, Plus, Printer } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../lib/api'
import { caToDisplay, rendementKgHa } from '../../lib/surface'
import PageHeader from '../../components/PageHeader'

export default function CampagneDetail() {
  const { annee } = useParams()
  const navigate = useNavigate()
  const [campagne, setCampagne] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCloture, setConfirmCloture] = useState(false)
  const [bilanEdit, setBilanEdit] = useState(false)
  const [bilanValue, setBilanValue] = useState('')

  useEffect(() => { load() }, [annee])

  useEffect(() => {
    function onVisible() { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [annee])

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

  async function openParcelle(parcelle_id, vendange_id) {
    if (vendange_id) {
      navigate(`/vendange/parcelle/${vendange_id}`)
    } else {
      const v = await api.post('/vendanges', { parcelle_id, annee: parseInt(annee) })
      navigate(`/vendange/parcelle/${v.id}`)
    }
  }

  async function quickChargement(parcelle_id, vendange_id) {
    if (vendange_id) {
      navigate(`/vendange/parcelle/${vendange_id}/chargement/new`)
    } else {
      const v = await api.post('/vendanges', { parcelle_id, annee: parseInt(annee) })
      navigate(`/vendange/parcelle/${v.id}/chargement/new`)
    }
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
  const parcelles = campagne.parcelles || []
  const totalPoids   = parcelles.reduce((s, p) => s + (p.poids_total || 0), 0)
  const totalCaisses = parcelles.reduce((s, p) => s + (p.nb_caisses_total || 0), 0)
  const totalSurfaceCa = parcelles
    .filter(p => p.vendange_id)
    .reduce((s, p) => s + (p.surface_totale_ca || 0), 0)
  const rendementMoyen = rendementKgHa(totalPoids, totalSurfaceCa)
  const attendu = campagne.rendement_attendu_kgha
  const nbEnCours = parcelles.filter(p => p.vendange_id).length

  return (
    <div>
      <PageHeader title={`Vendange ${campagne.annee}`} back="/vendange">
        <button onClick={() => navigate(`/vendange/${annee}/export`)}
                className="p-2 rounded-full active:bg-vigne-600">
          <Printer size={18} />
        </button>
        {!isClosed && (
          <button onClick={() => navigate(`/vendange/${annee}/edit`)}
                  className="p-2 rounded-full active:bg-vigne-600">
            <Edit2 size={18} />
          </button>
        )}
      </PageHeader>

      <div className="px-4 pt-4 space-y-4 pb-8">
        {isClosed && (
          <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
            <Lock size={14} />
            <span>Clôturée le {campagne.date_cloture ? format(parseISO(campagne.date_cloture), 'd MMMM yyyy', { locale: fr }) : ''}</span>
          </div>
        )}

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

        {/* Stats globales */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-amber-800">{totalPoids.toFixed(0)}</p>
              <p className="text-xs text-amber-600 mt-0.5">kg total</p>
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
          {attendu && rendementMoyen != null && (
            <RendementComparison reel={rendementMoyen} attendu={attendu} className="mt-3" />
          )}
          {nbEnCours > 0 && (
            <p className="text-xs text-center text-amber-600 mt-2">
              {nbEnCours} / {parcelles.length} parcelle{parcelles.length > 1 ? 's' : ''} commencée{nbEnCours > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Liste des parcelles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Parcelles</h2>
            {!isClosed && (
              <p className="text-xs text-gray-400">Appuyer sur + pour ajouter un chargement</p>
            )}
          </div>
          {parcelles.length === 0 ? (
            <div className="card text-center py-6">
              <Grape size={32} className="mx-auto text-vigne-300 mb-2" />
              <p className="text-gray-500 text-sm">Aucune parcelle enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {parcelles.map(p => (
                <ParcelleRow
                  key={p.id}
                  parcelle={p}
                  attendu={attendu}
                  isClosed={isClosed}
                  onOpen={() => openParcelle(p.id, p.vendange_id)}
                  onAdd={() => quickChargement(p.id, p.vendange_id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Note de bilan */}
        {(isClosed || campagne.note_bilan) && (
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900 text-sm">Note de bilan</p>
              {!bilanEdit && (
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
        {!isClosed ? (
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
        ) : (
          <button onClick={rouvrir}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium active:bg-gray-50">
            <Unlock size={16} />
            Rouvrir la campagne
          </button>
        )}

        {!confirmDelete ? (
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
      </div>
    </div>
  )
}

function ParcelleRow({ parcelle, attendu, isClosed, onOpen, onAdd }) {
  const hasVendange = Boolean(parcelle.vendange_id)
  const rendement = hasVendange ? rendementKgHa(parcelle.poids_total, parcelle.surface_totale_ca) : null

  return (
    <div className={`card p-0 overflow-hidden flex items-stretch ${!hasVendange && isClosed ? 'opacity-50' : ''}`}>
      {/* Zone principale — ouvre le détail */}
      <button
        onClick={(!hasVendange && isClosed) ? undefined : onOpen}
        disabled={!hasVendange && isClosed}
        className="flex items-center gap-3 flex-1 text-left p-4 active:bg-gray-50"
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          hasVendange ? 'bg-amber-100' : 'bg-gray-100'
        }`}>
          <Grape size={20} className={hasVendange ? 'text-amber-700' : 'text-gray-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{parcelle.nom}</p>
          {hasVendange ? (
            <>
              <p className="text-xs text-gray-500 mt-0.5">
                {Number(parcelle.poids_total || 0).toFixed(0)} kg · {parcelle.nb_caisses_total || 0} caisses
                {rendement && <span className="text-vigne-600"> · {rendement.toLocaleString('fr-FR')} kg/ha</span>}
              </p>
              {attendu && rendement != null && (
                <RendementComparison reel={rendement} attendu={attendu} compact />
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">
              {caToDisplay(parcelle.surface_totale_ca)}
              {!isClosed && <span className="text-amber-600 font-medium"> · Tap + pour commencer</span>}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
      </button>

      {/* Bouton + chargement rapide */}
      {!isClosed && (
        <button
          onClick={onAdd}
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
