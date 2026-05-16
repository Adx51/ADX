import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Edit2, Trash2, Package, Scale, Lock, Unlock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { caToDisplay, rendementKgHa } from '../../lib/surface'
import PageHeader from '../../components/PageHeader'
import { useRefreshTrigger } from '../../lib/useRefreshOnFocus'

export default function VendangeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canDeleteVendange = isAdmin || user?.can_delete?.vendanges === true
  const canDeleteChargement = isAdmin || user?.can_delete?.chargements === true
  const [vendange, setVendange] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmCloture, setConfirmCloture] = useState(false)

  const refreshTick = useRefreshTrigger()
  useEffect(() => { load() }, [id, refreshTick])

  async function load() {
    const data = await api.get(`/vendanges/${id}`)
    setVendange(data)
    setLoading(false)
  }

  async function deleteChargement(cid) {
    await api.delete(`/chargements/${cid}`)
    setConfirmDelete(null)
    load()
  }

  async function deleteVendange() {
    await api.delete(`/vendanges/${id}`)
    navigate(vendange?.annee ? `/vendange/${vendange.annee}` : '/vendange')
  }

  async function cloturer() {
    await api.post(`/vendanges/${id}/cloturer`)
    setConfirmCloture(false)
    load()
  }

  async function rouvrir() {
    await api.post(`/vendanges/${id}/rouvrir`)
    load()
  }

  if (loading) return (
    <div>
      <PageHeader title="Chargement..." back="/vendange" />
      <div className="px-4 pt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-16" />)}
      </div>
    </div>
  )

  if (!vendange) return (
    <div>
      <PageHeader title="Introuvable" back="/vendange" />
      <p className="text-center py-8 text-gray-500">Vendange introuvable.</p>
    </div>
  )

  const backUrl = `/vendange/${vendange.annee}`
  const isClosed = vendange.statut === 'cloturee'
  const parcelle  = vendange.parcelles
  const campagne  = vendange.campagne
  const chargements = vendange.chargements || []
  const rendement = rendementKgHa(vendange.poids_total, parcelle?.surface_totale_ca)
  const kgParCaisse = vendange.nb_caisses_total > 0
    ? (vendange.poids_total / vendange.nb_caisses_total).toFixed(1)
    : null

  // kg attendu = rendement attendu × surface totale
  const kgAttendu = campagne?.rendement_attendu_kgha && parcelle?.surface_totale_ca
    ? Math.round(campagne.rendement_attendu_kgha * parcelle.surface_totale_ca / 10000)
    : null

  const poidsReel = Number(vendange.poids_total || 0)
  const pctAtteint = kgAttendu ? Math.min(Math.round((poidsReel / kgAttendu) * 100), 100) : null

  const byDate = chargements.reduce((acc, c) => {
    const key = c.date_chargement
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  return (
    <div>
      <PageHeader title={`${parcelle?.nom} — ${vendange.annee}`} back={backUrl} />

      <div className="px-4 pt-4 space-y-4 pb-8">

        {/* Bannière clôture */}
        {isClosed && (
          <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-gray-600">
            <Lock size={14} className="flex-shrink-0" />
            <span>Vendange clôturée — saisies verrouillées</span>
          </div>
        )}

        {/* Récap */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-amber-800">{poidsReel.toFixed(0)}</p>
              <p className="text-xs text-amber-600 mt-0.5">kg total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-800">{vendange.nb_caisses_total || 0}</p>
              <p className="text-xs text-amber-600 mt-0.5">caisses</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-vigne-700">
                {rendement ? rendement.toLocaleString('fr-FR') : '—'}
              </p>
              <p className="text-xs text-vigne-600 mt-0.5">kg/ha</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">
                {kgParCaisse ?? '—'}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">kg/caisse</p>
            </div>
          </div>

          {/* Barre de progression vs attendu */}
          {kgAttendu != null && (
            <div className="mt-3">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-amber-700 font-medium">{poidsReel.toFixed(0)} kg récolté</span>
                <span className="text-amber-600">{kgAttendu.toLocaleString('fr-FR')} kg attendu</span>
              </div>
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 rounded-full transition-all"
                  style={{ width: `${pctAtteint}%` }}
                />
              </div>
              <p className="text-xs text-center text-amber-700 font-semibold mt-1">
                {pctAtteint}% de l'objectif
              </p>
            </div>
          )}

          {parcelle?.surface_totale_ca && (
            <p className="text-xs text-center text-amber-600 mt-2">
              Surface : {caToDisplay(parcelle.surface_totale_ca)}
            </p>
          )}
        </div>

        {vendange.notes && (
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{vendange.notes}</p>
          </div>
        )}

        {/* Chargements par date */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Chargements au pressoir</h2>
            {!isClosed && (
              <button onClick={() => navigate(`/vendange/parcelle/${id}/chargement/new`)}
                      className="flex items-center gap-1 text-amber-600 font-semibold text-sm">
                <Plus size={18} />
                Ajouter
              </button>
            )}
          </div>

          {chargements.length === 0 ? (
            <div className="card text-center py-8">
              <Package size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">Aucun chargement enregistré</p>
              {!isClosed && (
                <button onClick={() => navigate(`/vendange/parcelle/${id}/chargement/new`)}
                        className="mt-3 text-amber-600 font-medium text-sm">
                  Ajouter le premier chargement
                </button>
              )}
            </div>
          ) : (
            Object.entries(byDate).map(([date, items]) => {
              const dateFormatted = format(parseISO(date), 'EEEE d MMMM yyyy', { locale: fr })
              const dayPoids   = items.reduce((s, c) => s + (c.poids_kg || 0), 0)
              const dayCaisses = items.reduce((s, c) => s + (c.nombre_caisses || 0), 0)

              return (
                <div key={date} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700 capitalize">{dateFormatted}</p>
                    <p className="text-xs text-gray-400">{dayCaisses} c · {dayPoids.toFixed(0)} kg</p>
                  </div>
                  <div className="space-y-2">
                    {items.map(c => (
                      <div key={c.id}>
                        {canDeleteChargement && confirmDelete === c.id ? (
                          <div className="card border-red-200 bg-red-50 p-3">
                            <p className="text-red-700 text-sm text-center mb-2">Supprimer ce chargement ?</p>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmDelete(null)}
                                      className="flex-1 bg-white border border-gray-300 rounded-xl py-2 text-sm font-medium">
                                Annuler
                              </button>
                              <button onClick={() => deleteChargement(c.id)}
                                      className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium">
                                Supprimer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="card flex items-center gap-3">
                            <div className="w-12 text-center flex-shrink-0">
                              <p className="text-xs font-bold text-vigne-700">
                                {c.heure_livraison ? c.heure_livraison.slice(0, 5) : '—'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Package size={14} className="text-gray-400" />
                              <span className="font-bold text-gray-900">{c.nombre_caisses}</span>
                              <span className="text-xs text-gray-400">c</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-1">
                              <Scale size={14} className="text-gray-400" />
                              <span className="font-bold text-amber-700">{c.poids_kg} kg</span>
                            </div>
                            {!isClosed && (
                              <div className="flex gap-1">
                                <button onClick={() => navigate(`/vendange/parcelle/${id}/chargement/${c.id}/edit`)}
                                        className="p-2 text-gray-400 active:text-vigne-700">
                                  <Edit2 size={16} />
                                </button>
                                {canDeleteChargement && (
                                  <button onClick={() => setConfirmDelete(c.id)}
                                          className="p-2 text-gray-400 active:text-red-600">
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            )}
                            {isClosed && <Lock size={14} className="text-gray-300 flex-shrink-0" />}
                          </div>
                        )}
                        {c.notes && <p className="text-xs text-gray-400 pl-4 mt-0.5">{c.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Clôturer / Rouvrir */}
        {!isClosed ? (
          confirmCloture ? (
            <div className="card border-amber-200 bg-amber-50 space-y-3">
              <p className="text-amber-800 font-medium text-sm text-center">
                Clôturer la vendange de {parcelle?.nom} ?
              </p>
              <p className="text-xs text-amber-700 text-center">
                Plus aucun chargement ne pourra être ajouté (réouverture possible).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmCloture(false)} className="btn-secondary py-2 text-sm">Annuler</button>
                <button onClick={cloturer} className="py-2 rounded-xl bg-amber-600 text-white text-sm font-medium">Clôturer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmCloture(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-amber-300 text-amber-700 text-sm font-semibold active:bg-amber-50">
              <Lock size={16} />
              Clôturer cette parcelle
            </button>
          )
        ) : (
          <button onClick={rouvrir}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium active:bg-gray-50">
            <Unlock size={16} />
            Rouvrir la vendange
          </button>
        )}

        {/* Supprimer vendange — admin uniquement */}
        {canDeleteVendange && !isClosed && (
          confirmDelete === 'vendange' ? (
            <div className="card border-red-200 bg-red-50 space-y-3">
              <p className="text-red-700 font-medium text-sm text-center">
                Supprimer toute la vendange {vendange.annee} de {parcelle?.nom} ?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary py-2 text-sm">Annuler</button>
                <button onClick={deleteVendange} className="btn-danger py-2 text-sm">Supprimer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete('vendange')}
                    className="w-full flex items-center justify-center gap-2 text-red-500 py-3 text-sm font-medium">
              <Trash2 size={16} />
              Supprimer cette vendange
            </button>
          )
        )}
      </div>
    </div>
  )
}
