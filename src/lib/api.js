const BASE = '/api'

function getToken() {
  return localStorage.getItem('adx_token')
}

// Direct fetch without queue wrapping — used by syncQueue in OfflineContext
export async function rawRequest(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 401) {
    localStorage.removeItem('adx_token')
    localStorage.removeItem('adx_user')
    window.location.href = '/login'
    return
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = new Error(data.error || `Erreur ${res.status}`)
    e.status = res.status
    throw e
  }
  return data
}

async function request(method, path, body, isFormData = false) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData && body) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined
    })
  } catch {
    // Network failure — enqueue write operations for later sync
    if (!isFormData && ['POST', 'PUT', 'DELETE'].includes(method)) {
      try {
        const { enqueueOperation } = await import('./offlineQueue.js')
        await enqueueOperation({ method, path, body })
      } catch {}
    }
    const e = new Error(
      method === 'GET' ? 'Hors ligne — données non disponibles' : 'Hors ligne — opération enregistrée'
    )
    e.offline = true
    throw e
  }

  if (res.status === 401) {
    localStorage.removeItem('adx_token')
    localStorage.removeItem('adx_user')
    window.location.href = '/login'
    return
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
  return data
}

// Cache mémoire pour les GET — évite le skeleton flash à chaque navigation
const _cache = new Map()

function cachedGet(path) {
  if (_cache.has(path)) {
    // Retourne le cache instantanément, rafraîchit en arrière-plan
    request('GET', path).then(data => _cache.set(path, data)).catch(() => {})
    return Promise.resolve(_cache.get(path))
  }
  return request('GET', path).then(data => { _cache.set(path, data); return data })
}

function invalidate(path) {
  // Invalide les entrées dont le préfixe correspond (ex: /campagnes invalide /campagnes/2024)
  for (const key of _cache.keys()) {
    if (key.startsWith(path) || path.startsWith(key)) _cache.delete(key)
  }
}

export function invalidateAll() {
  _cache.clear()
  window.dispatchEvent(new Event('adx:data-changed'))
}

// ─── Mode lecture seule ───────────────────────────────────────────────────────
// Miroir client du rôle « lecteur ». La vraie sécurité est côté serveur
// (middleware blockReadOnlyWrites) ; ce garde-fou évite qu'une écriture partie
// d'un bouton oublié ne soit mise en file d'attente hors ligne, et donne une
// erreur immédiate et lisible.
let _readOnly = false

export function setReadOnly(v) { _readOnly = Boolean(v) }
export function isReadOnly() { return _readOnly }

function guardWrite(path) {
  if (!_readOnly) return null
  // La connexion reste possible (POST /auth/login) même en lecture seule
  if (typeof path === 'string' && path.startsWith('/auth/')) return null
  const e = new Error('Compte en lecture seule — aucune modification autorisée')
  e.readOnly = true
  return e
}

function afterMutation(d) {
  // Invalidation globale : les entités sont trop liées entre elles pour une
  // invalidation ciblée fiable (chargement → vendange → parcelle, tâche →
  // activité parcelle…). Le cache est en mémoire, le refetch est bon marché.
  invalidateAll()
  return d
}

// Toute écriture passe par ce wrapper : refus immédiat en lecture seule
function write(fn) {
  return (path, ...rest) => {
    const blocked = guardWrite(path)
    return blocked ? Promise.reject(blocked) : fn(path, ...rest)
  }
}

export const api = {
  get:    (path)       => cachedGet(path),
  post:   write((path, body) => request('POST',   path, body).then(afterMutation)),
  put:    write((path, body) => request('PUT',    path, body).then(afterMutation)),
  delete: write((path)       => request('DELETE', path).then(afterMutation)),
  upload: write((path, formData) => request('POST', path, formData, true).then(afterMutation)),
  invalidate,
  invalidateAll,
}
