const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Demo identity header until the auth flow (Auth.js / Clerk) is wired in.
const DEMO_USER = process.env.NEXT_PUBLIC_DEMO_USER_ID ?? 'demo';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': DEMO_USER,
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ─── Shared domain types (mirror the Prisma model) ──────────────────────────

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
