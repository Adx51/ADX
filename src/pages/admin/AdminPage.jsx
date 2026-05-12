import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, List, Trash2, Crown, User, Plus, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import PageHeader from '../../components/PageHeader'

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
      <PageHeader title="Administration" back="/parcelles" />

      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>
          <Users size={16} /> Utilisateurs
        </TabBtn>
        <TabBtn active={tab === 'refs'} onClick={() => setTab('refs')}>
          <List size={16} /> Référentiels
        </TabBtn>
      </div>

      <div className="px-4 pt-4 pb-8">
        {tab === 'users' ? <UsersTab /> : <RefsTab />}
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

  useEffect(() => {
    api.get('/admin/users').then(data => { setUsers(data || []); setLoading(false) })
  }, [])

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    try {
      await api.put(`/admin/users/${u.id}/role`, { role: newRole })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
    } catch (e) {
      setError(e.message)
    }
  }

  async function deleteUser(u) {
    if (!confirm(`Supprimer ${u.prenom} ${u.nom} (${u.email}) ?`)) return
    try {
      await api.delete(`/admin/users/${u.id}`)
      setUsers(prev => prev.filter(x => x.id !== u.id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton h-16" />)}</div>

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
      {users.map(u => (
        <div key={u.id} className="card flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${u.role === 'admin' ? 'bg-vigne-100' : 'bg-gray-100'}`}>
            {u.role === 'admin' ? <Crown size={18} className="text-vigne-700" /> : <User size={18} className="text-gray-500" />}
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
            {u.id !== me?.id && (
              <>
                <button onClick={() => toggleRole(u)}
                        className="p-2 rounded-xl text-gray-400 active:bg-gray-100"
                        title={u.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin'}>
                  <Crown size={16} className={u.role === 'admin' ? 'text-vigne-600' : 'text-gray-300'} />
                </button>
                <button onClick={() => deleteUser(u)}
                        className="p-2 rounded-xl text-red-400 active:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Referentials tab ─────────────────────────────────────────────────────────

function RefsTab() {
  return (
    <div className="space-y-6">
      <RefSection type="commune" label="Communes" />
      <RefSection type="cepage" label="Cépages" />
    </div>
  )
}

function RefSection({ type, label }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newVal, setNewVal] = useState('')
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
      const item = await api.post(`/admin/referentiels/${type}`, { valeur: val })
      setItems(prev => [...prev, item])
      setNewVal('')
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
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {loading ? (
        <div className="card skeleton h-20" />
      ) : (
        <div className="card space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-800">{item.valeur}</span>
              <button onClick={() => remove(item)} className="p-1.5 text-red-400 active:bg-red-50 rounded-lg">
                <X size={14} />
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Aucune entrée</p>}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <input
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
              className="input flex-1 py-2"
              placeholder={`Ajouter un${type === 'commune' ? 'e commune' : ' cépage'}...`}
            />
            <button onClick={add} className="bg-vigne-700 text-white px-3 rounded-xl active:bg-vigne-800">
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
