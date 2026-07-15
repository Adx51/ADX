import type { Overview, Distribution, Alert, Bottle } from './api';

/**
 * Representative fallback data so the UI renders beautifully even before the
 * backend + database are running. Real data replaces this transparently once
 * `NEXT_PUBLIC_API_URL` points at a live API.
 */
export const demoOverview: Overview = {
  bottleCount: 128,
  uniqueWines: 74,
  totalValue: 42800,
  totalCost: 31500,
  gain: 11300,
  returnPct: 35.9,
  avgBottleValue: 334,
};

export const demoDistribution: Distribution = {
  byColor: { RED: 82, WHITE: 31, ROSE: 9, ORANGE: 6 },
  byRegion: {
    Bordeaux: 34,
    Bourgogne: 28,
    Rhône: 21,
    Champagne: 14,
    Alsace: 11,
    Loire: 10,
    Autres: 10,
  },
  byCountry: { France: 108, Italie: 12, Espagne: 5, 'États-Unis': 3 },
  byVintage: {
    '2015': 18,
    '2016': 22,
    '2017': 16,
    '2018': 20,
    '2019': 24,
    '2020': 15,
    '2021': 13,
  },
};

export const demoAlerts: Alert[] = [
  {
    bottleId: '1',
    label: 'Château Margaux 2010',
    type: 'PEAK',
    message: 'Cette bouteille arrive à son apogée.',
  },
  {
    bottleId: '2',
    label: 'Domaine Leflaive Puligny-Montrachet 2018',
    type: 'DRINK_SOON',
    message: 'À boire dans les 12 mois.',
  },
  {
    bottleId: '3',
    label: 'Guigal Côte-Rôtie 2012',
    type: 'PAST_PEAK',
    message: 'Risque de dépasser l’apogée — à boire sans tarder.',
  },
];

export const demoBottles: Bottle[] = [
  {
    id: '1',
    quantity: 1,
    status: 'IN_STOCK',
    purchasePrice: '3200',
    estimatedValue: '4800',
    valueMin: '4200',
    valueMax: '5500',
    wine: {
      id: 'w1',
      domain: 'Domaine de la Romanée-Conti',
      cuvee: 'La Tâche',
      vintage: 2015,
      appellation: 'La Tâche Grand Cru',
      region: 'Bourgogne',
      country: 'France',
      color: 'RED',
      grapes: ['Pinot Noir'],
      foodPairings: ['Gibier', 'Truffe'],
      drinkFrom: 2028,
      drinkUntil: 2050,
      peakYear: 2038,
    },
  },
  {
    id: '2',
    quantity: 6,
    status: 'IN_STOCK',
    purchasePrice: '550',
    estimatedValue: '780',
    valueMin: '700',
    valueMax: '900',
    wine: {
      id: 'w2',
      domain: 'Château Margaux',
      cuvee: 'Grand Vin',
      vintage: 2010,
      appellation: 'Margaux',
      region: 'Bordeaux',
      country: 'France',
      color: 'RED',
      grapes: ['Cabernet Sauvignon', 'Merlot'],
      foodPairings: ['Côte de bœuf', 'Agneau'],
      drinkFrom: 2025,
      drinkUntil: 2045,
      peakYear: 2035,
    },
  },
  {
    id: '3',
    quantity: 12,
    status: 'IN_STOCK',
    purchasePrice: '48',
    estimatedValue: '65',
    valueMin: '55',
    valueMax: '80',
    wine: {
      id: 'w3',
      domain: 'Domaine Zind-Humbrecht',
      cuvee: 'Clos Windsbuhl',
      vintage: 2019,
      appellation: 'Alsace',
      region: 'Alsace',
      country: 'France',
      color: 'WHITE',
      grapes: ['Riesling'],
      foodPairings: ['Poissons', 'Choucroute'],
      drinkFrom: 2024,
      drinkUntil: 2035,
      peakYear: 2029,
    },
  },
];

/** Try the API; fall back to demo data on any error (offline-friendly). */
export async function withFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
