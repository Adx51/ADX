import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('adx_user')) } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('adx_token')
    if (!token) { setLoading(false); return }

    api.get('/auth/me')
      .then(data => {
        if (data?.user) {
          setUser(data.user)
          localStorage.setItem('adx_user', JSON.stringify(data.user))
          // Préchauffer le cache des pages principales
          api.get('/campagnes')
          api.get('/parcelles')
          api.get('/taches')
          api.get('/phyto/rapports')
        } else {
          localStorage.removeItem('adx_token')
          localStorage.removeItem('adx_user')
          setUser(null)
        }
      })
      .catch(() => {
        // Network failure or server error — keep stored user, do not logout.
        // 401 (expired token) is handled by api.js which redirects to /login.
      })
      .finally(() => setLoading(false))
  }, [])

  async function signIn(email, password) {
    try {
      const data = await api.post('/auth/login', { email, password })
      localStorage.setItem('adx_token', data.token)
      localStorage.setItem('adx_user', JSON.stringify(data.user))
      setUser(data.user)
      api.get('/campagnes')
      api.get('/parcelles')
      api.get('/taches')
      api.get('/phyto/rapports')
      return { error: null }
    } catch (e) {
      return { error: e.message }
    }
  }

  async function signUp(email, password, prenom, nom) {
    try {
      const data = await api.post('/auth/register', { email, password, prenom, nom })
      localStorage.setItem('adx_token', data.token)
      localStorage.setItem('adx_user', JSON.stringify(data.user))
      setUser(data.user)
      return { error: null }
    } catch (e) {
      return { error: e.message }
    }
  }

  function signOut() {
    localStorage.removeItem('adx_token')
    localStorage.removeItem('adx_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
