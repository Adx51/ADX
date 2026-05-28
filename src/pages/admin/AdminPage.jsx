import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, List, Trash2, Crown, User, Plus, X, Edit2, Check, Database, Download, Shield, ChevronDown, Leaf, ChevronRight, Eye, EyeOff, KeyRound } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import PageHeader from '../../components/PageHeader'
import { APP_VERSION } from '../../lib/version'

const PERM_SECTIONS = [
  { key: 'parcelles',   label: 'Parcelles' },
  { key: 'vendanges',   label: 'Vendanges' },
  { key: 'campagnes',   label: 'Campagnes' },
  { key: 'taches',      label: 'Tâches' },
  { key: 'chargements', label: 'Chargements' },
]

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/parcelles', { replace: true })
  }, [user, navigate])

  if (!user || user.role !== 'admin') return null

  return (
    <div>
      <PageHeader title={`Administration · v${APP_VERSION}`} back="/reglages" />

      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>
          <Users size={16} /> Utilisateurs
        </TabBtn>
        <TabBtn active={tab === 'refs'} onClick={() => setTab('refs')}>
          <List size={16} /> Référentiels
        </TabBtn>
        <TabBtn active={tab === 'backup'} onClick={() => setTab('backup')}>
          <Database size={16} /> Sauvegarde
        </TabBtn>
      </div>

      <div className="px-4 pt-4 pb-8">
        {tab === 'users' && <UsersTab />}
        {tab === 'refs'  && <RefsTab />}
        {tab === 'backup' && <BackupTab />}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-vigne-700 text-vigne-700' : 'border-transparent text-gray-500'
      }`}
    >
      {children}
    </button>
  )
}

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [permsId, setPermsId] = useState(null)

  useEffect(() => {
    api.get('/admin/users').then(data => { setUsers(data || []); setLoading(false) })
  }, [])

  async function saveEdit(u, fields) {
    setError('')
    try {
      const updated = await api.put(`/admin/users/${u.id}`, fields)
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...updated } : x))
      setEditingId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    setError('')
    try {
      await api.put(`/admin/users/${u.id}/role`, { role: newRole })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
    } catch (e) {
      setError(e.message)
    }
  }

  async function togglePerm(u, key) {
    const current = u.can_delete?.[key] ?? false
    const newPerms = { ...(u.can_delete || {}), [key]: !current }
    setError('')
    try {
      const updated = await api.put(`/admin/users/${u.id}/permissions`, { can_delete: newPerms })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, can_delete: updated.can_delete } : x))
    } catch (e) {
      setError(e.message)
    }
  }

  async function deleteUser(u) {
    if (!confirm(`Supprimer ${u.prenom} ${u.nom} (${u.email}) ?`)) return
    setError('')
    try {
      await api.delete(`/admin/users/${u.id}`)
      setUsers(prev => prev.filter(x => x.id !== u.id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-16" />)}
    </div>
  )

  return (
    <div className="space-y-3 lg:max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}
      {users.map(u => (
        <div key={u.id} className="card overflow-hidden">
          {editingId === u.id ? (
            <EditUserForm
              user={u}
              onSave={fields => saveEdit(u, fields)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${u.role === 'admin' ? 'bg-vigne-100' : 'bg-gray-100'}`}>
                  {u.role === 'admin'
                    ? <Crown size={18} className="text-vigne-700" />
                    : <User size={18} className="text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {u.prenom} {u.nom}
                    {u.id === me?.id && <span className="text-xs text-gray-400 ml-1">(moi)</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  <span className={`text-xs font-medium ${u.role === 'admin' ? 'text-vigne-700' : 'text-gray-400'}`}>
                    {u.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditingId(u.id)}
                          className="p-2 rounded-xl text-gray-400 active:bg-gray-100">
                    <Edit2 size={15} />
                  </button>
                  {u.id !== me?.id && (
                    <>
                      <button onClick={() => toggleRole(u)}
                              className="p-2 rounded-xl active:bg-gray-100"
                              title={u.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin'}>
                        <Crown size={15} className={u.role === 'admin' ? 'text-vigne-600' : 'text-gray-300'} />
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => setPermsId(permsId === u.id ? null : u.id)}
                          className={`p-2 rounded-xl active:bg-gray-100 ${permsId === u.id ? 'text-vigne-600 bg-vigne-50' : 'text-gray-400'}`}
                          title="Droits de suppression"
                        >
                          <Shield size={15} />
                        </button>
                      )}
                      <button onClick={() => deleteUser(u)}
                              className="p-2 rounded-xl text-red-400 active:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Panneau permissions — uniquement pour non-admins */}
              {permsId === u.id && u.role !== 'admin' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Droits de suppression
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PERM_SECTIONS.map(({ key, label }) => {
                      const enabled = u.can_delete?.[key] === true
                      return (
                        <button
                          key={key}
                          onClick={() => togglePerm(u, key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                            enabled
                              ? 'bg-vigne-50 border-vigne-300 text-vigne-700'
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                            enabled ? 'bg-vigne-600 border-vigne-600' : 'border-gray-300'
                          }`}>
                            {enabled && <Check size={10} className="text-white" strokeWidth={3} />}
                          </span>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Les administrateurs ont toujours tous les droits de suppression.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function EditUserForm({ user, onSave, onCancel }) {
  const [prenom, setPrenom] = useState(user.prenom)
  const [nom, setNom] = useState(user.nom)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdOk, setPwdOk] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await onSave({ prenom, nom, email })
    setSaving(false)
  }

  async function savePassword() {
    if (password.length < 6) { setPwdError('6 caractères minimum'); return }
    setPwdSaving(true); setPwdError(''); setPwdOk(false)
    try {
      await api.put(`/admin/users/${user.id}/password`, { password })
      setPassword(''); setPwdOk(true)
      setTimeout(() => setPwdOk(false), 3000)
    } catch (e) {
      setPwdError(e.message)
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Prénom</label>
            <input className="input py-2" value={prenom} onChange={e => setPrenom(e.target.value)} required />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input py-2" value={nom} onChange={e => setNom(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input py-2" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 active:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-vigne-700 text-white text-sm font-medium active:bg-vigne-800 flex items-center justify-center gap-1.5">
            <Check size={14} />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>

      {/* Réinitialisation du mot de passe */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <KeyRound size={12} /> Nouveau mot de passe
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setPwdError(''); setPwdOk(false) }}
              className="input py-2 pr-9 w-full"
              placeholder="Nouveau mot de passe…"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400"
            >
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            type="button"
            onClick={savePassword}
            disabled={pwdSaving || !password}
            className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium active:bg-amber-600 disabled:opacity-40 flex items-center gap-1.5"
          >
            <KeyRound size={14} />
            {pwdSaving ? '…' : 'Changer'}
          </button>
        </div>
        {pwdError && <p className="text-xs text-red-600">{pwdError}</p>}
        {pwdOk && <p className="text-xs text-vigne-700 font-medium">✓ Mot de passe mis à jour</p>}
      </div>
    </div>
  )
}

// ── Backup tab ───────────────────────────────────────────────────────────────

function BackupTab() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function download(endpoint, label) {
    setBusy(endpoint)
    setError('')
    try {
      const token = localStorage.getItem('adx_token')
      const res = await fetch(`/api${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="?([^"]+)"?/)
      const filename = m?.[1] || `lf-boyer-${Date.now()}.bin`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(`${label} : ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-4 lg:max-w-lg">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}
      <div className="card space-y-3">
        <div>
          <p className="font-semibold text-gray-900">Sauvegarde complète (.db)</p>
          <p className="text-xs text-gray-500 mt-1">Fichier SQLite brut — toutes les données, photos exclues.</p>
        </div>
        <button onClick={() => download('/admin/backup', 'Sauvegarde')} disabled={busy === '/admin/backup'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-vigne-700 text-white text-sm font-medium active:bg-vigne-800 disabled:opacity-60">
          <Download size={16} />
          {busy === '/admin/backup' ? 'Préparation...' : 'Télécharger la base'}
        </button>
      </div>
      <div className="card space-y-3">
        <div>
          <p className="font-semibold text-gray-900">Export JSON</p>
          <p className="text-xs text-gray-500 mt-1">Format lisible — utile pour archivage hors-ligne ou consultation.</p>
        </div>
        <button onClick={() => download('/admin/export', 'Export JSON')} disabled={busy === '/admin/export'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium active:bg-gray-50 disabled:opacity-60">
          <Download size={16} />
          {busy === '/admin/export' ? 'Préparation...' : 'Télécharger l\'export JSON'}
        </button>
      </div>
      <p className="text-xs text-gray-400 px-2">
        Sauvegarde automatique toutes les 30 minutes côté serveur (5 dernières conservées dans <code>/data/backups</code>).
        Restauration automatique au démarrage si la base est vide.
      </p>

      <button
        onClick={() => navigate('/phyto')}
        className="card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform mt-4"
      >
        <div className="w-10 h-10 rounded-xl bg-vigne-100 flex items-center justify-center">
          <Leaf size={18} className="text-vigne-700" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Registre phytosanitaire</p>
          <p className="text-xs text-gray-400 mt-0.5">Historique des traitements</p>
        </div>
        <ChevronRight size={16} className="text-gray-400 ml-auto" />
      </button>
    </div>
  )
}

// ── Referentials tab ─────────────────────────────────────────────────────────

function RefsTab() {
  return (
    <div className="space-y-6 lg:max-w-lg">
      <RefSection type="modele_tache" label="Modèles de tâche" />
      <RefSection type="commune" label="Communes" withInsee />
      <RefSection type="cepage" label="Cépages" />
      <RefSection type="prestataire" label="Prestataires" />
    </div>
  )
}

function RefSection({ type, label, withInsee = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newVal, setNewVal] = useState('')
  const [newInsee, setNewInsee] = useState('')
  const [editInseeId, setEditInseeId] = useState(null)
  const [editInseeVal, setEditInseeVal] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/admin/referentiels/${type}`)
      .then(data => { setItems(data || []); setLoading(false) })
  }, [type])

  async function add() {
    const val = newVal.trim()
    if (!val) return
    setError('')
    try {
      const item = await api.post(`/admin/referentiels/${type}`, {
        valeur: val,
        ...(withInsee ? { code_insee: newInsee } : {})
      })
      setItems(prev => [...prev, item])
      setNewVal('')
      setNewInsee('')
    } catch (e) {
      setError(e.message)
    }
  }

  async function saveInsee(item) {
    try {
      const updated = await api.put(`/admin/referentiels/${item.id}`, { code_insee: editInseeVal })
      setItems(prev => prev.map(x => x.id === item.id ? updated : x))
      setEditInseeId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(item) {
    try {
      await api.delete(`/admin/referentiels/${item.id}`)
      setItems(prev => prev.filter(x => x.id !== item.id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h2 className="font-bold text-gray-900 mb-3">{label}</h2>
      {withInsee && (
        <p className="text-xs text-gray-400 mb-2">Le code INSEE est requis pour la localisation automatique depuis le cadastre.</p>
      )}
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {loading ? (
        <div className="card skeleton h-20" />
      ) : (
        <div className="card space-y-2">
          {items.map(item => (
            <div key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{item.valeur}</span>
                  {withInsee && (
                    editInseeId === item.id ? (
                      <div className="flex gap-1 mt-1">
                        <input
                          value={editInseeVal}
                          onChange={e => setEditInseeVal(e.target.value)}
                          className="input py-1 text-xs w-28"
                          placeholder="51154"
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveInsee(item))}
                        />
                        <button onClick={() => saveInsee(item)}
                                className="p-1 text-vigne-700 active:bg-vigne-50 rounded">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditInseeId(null)}
                                className="p-1 text-gray-400 active:bg-gray-50 rounded">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditInseeId(item.id); setEditInseeVal(item.code_insee || '') }}
                        className="block text-xs text-gray-400 mt-0.5 hover:text-vigne-600"
                      >
                        INSEE : {item.code_insee || <span className="text-amber-500">non défini — cliquer pour ajouter</span>}
                      </button>
                    )
                  )}
                </div>
                <button onClick={() => remove(item)} className="p-1.5 text-red-400 active:bg-red-50 rounded-lg flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Aucune entrée</p>}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            {withInsee && (
              <input
                value={newInsee}
                onChange={e => setNewInsee(e.target.value)}
                className="input py-2 text-sm"
                placeholder="Code INSEE (ex : 51154)"
              />
            )}
            <div className="flex gap-2">
              <input
                value={newVal}
                onChange={e => setNewVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
                className="input flex-1 py-2"
                placeholder={`Ajouter un${type === 'commune' ? 'e commune' : type === 'prestataire' ? ' prestataire' : ' cépage'}...`}
              />
              <button onClick={add} className="bg-vigne-700 text-white px-3 rounded-xl active:bg-vigne-800">
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
