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
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
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

export const api = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  delete: (path)       => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData, true)
}
