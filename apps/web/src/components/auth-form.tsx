'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, register } from '@/lib/api-client';
import { ApiError } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const isLogin = mode === 'login';

  const [email, setEmail] = useState(isLogin ? 'demo@adx.wine' : '');
  const [password, setPassword] = useState(isLogin ? 'demo1234' : '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 0
          ? 'API injoignable. Lancez l’API (port 4000) et la base de données.'
          : err instanceof Error && err.message
            ? tryParseMessage(err.message)
            : 'Une erreur est survenue.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-6">
      <h2 className="font-display text-lg font-medium text-white">
        {isLogin ? 'Connexion' : 'Créer un compte'}
      </h2>

      {!isLogin && (
        <Field
          label="Nom"
          type="text"
          value={name}
          onChange={setName}
          placeholder="Antoine"
        />
      )}
      <Field
        label="E-mail"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="vous@exemple.com"
        required
      />
      <Field
        label="Mot de passe"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        required
      />

      {error && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-bordeaux-500 disabled:opacity-50"
      >
        {loading ? '…' : isLogin ? 'Se connecter' : 'Créer mon compte'}
      </button>

      <p className="text-center text-sm text-neutral-500">
        {isLogin ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
        <Link
          href={isLogin ? '/register' : '/login'}
          className="text-gold-400 hover:underline"
        >
          {isLogin ? 'Créer un compte' : 'Se connecter'}
        </Link>
      </p>

      {isLogin && (
        <p className="text-center text-xs text-neutral-600">
          Démo : demo@adx.wine / demo1234
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-widest text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-gold-500/40 focus:outline-none"
      />
    </label>
  );
}

// The API returns validation errors as a JSON string ({ message: [...] }).
function tryParseMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const m = parsed?.message;
    if (Array.isArray(m)) return m.join(' ');
    if (typeof m === 'string') return m;
  } catch {
    /* not JSON */
  }
  return raw;
}
