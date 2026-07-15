import 'server-only';
import { cookies } from 'next/headers';
import { apiFetch, TOKEN_COOKIE } from './api';

/**
 * API bound to the current request's JWT (read from the cookie). Use inside
 * Server Components / Route Handlers. Requests without a token will 401.
 */
export function serverApi() {
  const token = cookies().get(TOKEN_COOKIE)?.value ?? null;
  return {
    token,
    get: <T>(path: string) => apiFetch<T>(path, {}, token),
    post: <T>(path: string, body: unknown) =>
      apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),
  };
}
