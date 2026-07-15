'use client';

import { apiFetch, TOKEN_COOKIE, type AuthResult } from './api';

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${TOKEN_COOKIE}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function setToken(token: string) {
  // 7-day, site-wide cookie. Not httpOnly so Server Components can read it too.
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearToken() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
}

/** Authenticated client-side API (reads the token from the cookie). */
export const clientApi = {
  get: <T>(path: string) => apiFetch<T>(path, {}, getToken()),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }, getToken()),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, getToken()),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }, getToken()),
};

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await apiFetch<AuthResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(res.accessToken);
  return res;
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResult> {
  const res = await apiFetch<AuthResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  setToken(res.accessToken);
  return res;
}
