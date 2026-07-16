import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from './openai.service';

export interface WineEnrichment {
  producer?: string;
  region?: string;
  country?: string;
  appellation?: string;
  color?: 'RED' | 'WHITE' | 'ROSE' | 'ORANGE';
  style?: 'STILL' | 'SPARKLING' | 'FORTIFIED' | 'SWEET';
  grapes?: string[];
  abv?: number;
  description?: string;
  history?: string;
  servingTempC?: number;
  decantMinutes?: number;
  foodPairings?: string[];
  drinkFrom?: number;
  drinkUntil?: number;
  peakYear?: number;
  communityRating?: number;
  aiConfidence?: number;
}

export interface WineValuation {
  estimatedValue: number;
  valueMin: number;
  valueMax: number;
  rationale: string;
}

/**
 * Fills in the technical sheet, drinking window and market valuation for a wine
 * from a minimal seed (domain / cuvée / vintage). When the AI is disabled it
 * returns conservative heuristics so the product still works end-to-end.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(private readonly ai: OpenAiService) {}

  async enrich(seed: {
    domain: string;
    cuvee?: string | null;
    vintage?: number | null;
    region?: string | null;
    country?: string | null;
  }): Promise<WineEnrichment> {
    const label = [seed.domain, seed.cuvee, seed.vintage].filter(Boolean).join(' ');

    const result = await this.ai.json<WineEnrichment>(
      `You are a master sommelier and wine data expert. Return ONLY a JSON object
matching this TypeScript type (omit unknown fields, never invent precise prices):
{ producer, region, country, appellation, color ("RED"|"WHITE"|"ROSE"|"ORANGE"),
  style ("STILL"|"SPARKLING"|"FORTIFIED"|"SWEET"), grapes: string[], abv: number,
  description, history, servingTempC, decantMinutes, foodPairings: string[],
  drinkFrom: number, drinkUntil: number, peakYear: number,
  communityRating (0-100), aiConfidence (0-1) }.
Write description, history and foodPairings in French.`,
      `Enrichis cette fiche vin : "${label}".`,
    );

    if (result) return result;
    return this.heuristicEnrichment(seed);
  }

  /** Rough valuation range. Real implementation would query auction data + pgvector. */
  async valuate(seed: {
    domain: string;
    cuvee?: string | null;
    vintage?: number | null;
    purchasePrice?: number | null;
  }): Promise<WineValuation | null> {
    const label = [seed.domain, seed.cuvee, seed.vintage].filter(Boolean).join(' ');
    const result = await this.ai.json<WineValuation>(
      `You are a realistic wine-pricing analyst valuing ONE bottle in EUR.
Be conservative and honest:
- The vast majority of wines are everyday bottles with NO secondary/auction
  market; their value ≈ current retail price, typically 5–25 €. Do NOT inflate.
- Only genuinely recognised fine/collectible wines (grands crus classés, iconic
  domaines, sought-after vintages) are worth clearly more.
- If a purchase price is given, stay close to it (roughly ±30 %) UNLESS the wine
  is a recognised collectible that has appreciated.
- If you do not recognise the wine, assume an ordinary bottle near its purchase
  price (or 8–15 € if unknown).
Return ONLY JSON: { estimatedValue, valueMin, valueMax, rationale }.
Rationale: one short sentence in French.`,
      `Estime la valeur actuelle réaliste de : "${label}".${
        seed.purchasePrice
          ? ` Prix d'achat payé : ${seed.purchasePrice} € (reste proche sauf grand cru reconnu).`
          : ' Prix d’achat inconnu — suppose une bouteille ordinaire.'
      }`,
    );
    if (result) return result;

    // Fallback: assume modest appreciation over purchase price when known.
    if (seed.purchasePrice) {
      const base = seed.purchasePrice;
      return {
        estimatedValue: Math.round(base * 1.1),
        valueMin: Math.round(base * 0.9),
        valueMax: Math.round(base * 1.4),
        rationale: 'Estimation heuristique (IA désactivée) basée sur le prix d’achat.',
      };
    }
    return null;
  }

  private heuristicEnrichment(seed: {
    vintage?: number | null;
    country?: string | null;
  }): WineEnrichment {
    const vintage = seed.vintage ?? new Date().getFullYear();
    return {
      country: seed.country ?? 'France',
      style: 'STILL',
      grapes: [],
      foodPairings: [],
      servingTempC: 16,
      decantMinutes: 30,
      drinkFrom: vintage + 3,
      drinkUntil: vintage + 12,
      peakYear: vintage + 7,
      aiConfidence: 0.2,
      description:
        'Fiche technique en attente d’enrichissement IA (clé OpenAI non configurée).',
    };
  }
}
