import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()

  async function onSubmit(data) {
    setError('')
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setError('Email ou mot de passe incorrect')
    } else {
      navigate('/parcelles')
    }
  }

  return (
    <div className="min-h-screen bg-vigne-700 flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🍇</div>
          <h1 className="text-3xl font-bold text-white">LF-Boyer Vignoble</h1>
          <p className="text-vigne-200 mt-2">Gestion de votre domaine</p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Connexion</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="votre@email.com"
                {...register('email', { required: true })}
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                {...register('password', { required: true })}
              />
            </div>

            <button
              type="submit"
              className="btn-primary mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Accès réservé — comptes créés par l'administrateur du domaine.
          </p>
        </div>
      </div>
    </div>
  )
}
