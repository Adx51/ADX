// Client-side base. Empty string ⇒ same-origin: requests hit `/api/*`, which
// Next.js proxies to the API (see next.config rewrites). This keeps everything
// on one origin so it works behind a reverse proxy such as Home Assistant Ingress.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Name of the cookie holding the JWT (readable by client + server components). */
export const TOKEN_COOKIE = 'adx_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Low-level fetch against the API. A bearer token can be supplied explicitly
 * (server components read it from cookies; client helpers from document.cookie).
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
  base: string = API_BASE,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    });
  } catch {
    // Network failure (API down, DNS, CORS) — surface as status 0.
    throw new ApiError(0, 'Network error');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Shared domain types (mirror the Prisma model) ──────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export interface Overview {
  bottleCount: number;
  uniqueWines: number;
  totalValue: number;
  totalCost: number;
  gain: number;
  returnPct: number;
  avgBottleValue: number;
}

export interface Distribution {
  byColor: Record<string, number>;
  byRegion: Record<string, number>;
  byCountry: Record<string, number>;
  byVintage: Record<string, number>;
}

export interface Alert {
  bottleId: string;
  label: string;
  type: 'PEAK' | 'DRINK_SOON' | 'PAST_PEAK' | 'HOLD';
  message: string;
}

export interface Wine {
  id: string;
  domain: string;
  cuvee: string | null;
  vintage: number | null;
  appellation: string | null;
  region: string | null;
  country: string | null;
  color: 'RED' | 'WHITE' | 'ROSE' | 'ORANGE' | null;
  grapes: string[];
  foodPairings: string[];
  drinkFrom: number | null;
  drinkUntil: number | null;
  peakYear: number | null;
}

export interface Bottle {
  id: string;
  quantity: number;
  status: string;
  purchasePrice: string | null;
  estimatedValue: string | null;
  valueMin: string | null;
  valueMax: string | null;
  wine: Wine;
}

export interface SommelierAnswer {
  answer: string;
  bottleIds: string[];
}
