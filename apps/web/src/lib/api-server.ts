import 'server-only';
import { cookies } from 'next/headers';
import { apiFetch, TOKEN_COOKIE } from './api';

// Server Components run inside the web container, so they reach the API directly
// (not through the reverse proxy). Configurable for the Home Assistant add-on.
const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * API bound to the current request's JWT (read from the cookie). Use inside
 * Server Components / Route Handlers. Requests without a token will 401.
 */
export function serverApi() {
  const token = cookies().get(TOKEN_COOKIE)?.value ?? null;
  return {
    token,
    get: <T>(path: string) => apiFetch<T>(path, {}, token, INTERNAL_BASE),
    post: <T>(path: string, body: unknown) =>
      apiFetch<T>(
        path,
        { method: 'POST', body: JSON.stringify(body) },
        token,
        INTERNAL_BASE,
      ),
  };
}
