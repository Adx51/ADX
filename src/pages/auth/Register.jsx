import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm()

  async function onSubmit(data) {
    setError('')
    const { error } = await signUp(data.email, data.password)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-vigne-700 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Vérifiez votre email</h2>
          <p className="text-gray-600 text-sm mb-6">
            Un lien de confirmation a été envoyé à votre adresse email. Cliquez dessus pour activer votre compte.
          </p>
          <Link to="/login" className="btn-primary inline-block text-center no-underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vigne-700 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🍇</div>
        <h1 className="text-2xl font-bold text-white">ADX Vignoble</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Créer un compte</h2>

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
              placeholder="Min. 8 caractères"
              {...register('password', { required: true, minLength: 8 })}
            />
          </div>
          <div>
            <label className="label">Confirmer le mot de passe</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...register('confirmPassword', {
                required: true,
                validate: v => v === watch('password') || 'Les mots de passe ne correspondent pas'
              })}
            />
          </div>

          <button type="submit" className="btn-primary mt-2" disabled={isSubmitting}>
            {isSubmitting ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-vigne-700 font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
