import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

export interface ScannedBottle {
  domain?: string;
  cuvee?: string;
  vintage?: number;
  appellation?: string;
  region?: string;
  country?: string;
  color?: 'RED' | 'WHITE' | 'ROSE' | 'ORANGE';
  grapes?: string[];
  confidence?: number;
}

export interface ScannedInvoice {
  vendor?: string;
  date?: string;
  lines: Array<{
    domain?: string;
    cuvee?: string;
    vintage?: number;
    quantity?: number;
    unitPrice?: number;
  }>;
}

/**
 * Vision pipeline for the three scan flows: a single bottle label, a full case
 * (multiple bottles), and a purchase invoice (OCR + line extraction).
 */
@Injectable()
export class ScannerService {
  constructor(private readonly ai: OpenAiService) {}

  async scanBottle(imageUrl: string): Promise<ScannedBottle | null> {
    return this.ai.vision<ScannedBottle>(
      `You read a wine bottle photo. Return ONLY JSON:
{ domain, cuvee, vintage (number), appellation, region, country,
  color ("RED"|"WHITE"|"ROSE"|"ORANGE"), grapes (string[]), confidence (0-1) }.
Determine "color" from BOTH the label wording AND the visible colour of the wine
and packaging — a pink/salmon liquid or "rosé"/"rosado"/"rosato" wording is ROSE,
a clear pale bottle labelled blanc/white is WHITE, etc. Include "grapes" only if
printed on the label. Omit any field you cannot read; never invent a vintage.`,
      "Identifie ce vin d'après la photo de la bouteille.",
      imageUrl,
    );
  }

  async scanCase(imageUrl: string): Promise<ScannedBottle[]> {
    const result = await this.ai.vision<{ bottles: ScannedBottle[] }>(
      'You detect every distinct wine bottle in the image. Return ONLY JSON: { bottles: [{ domain, cuvee, vintage, appellation, region, country, confidence }] }.',
      'Identifie toutes les bouteilles visibles dans cette caisse.',
      imageUrl,
    );
    return result?.bottles ?? [];
  }

  async scanInvoice(imageUrl: string): Promise<ScannedInvoice | null> {
    return this.ai.vision<ScannedInvoice>(
      'You are an OCR + parsing engine for wine invoices. Return ONLY JSON: { vendor, date (ISO), lines: [{ domain, cuvee, vintage, quantity, unitPrice }] }.',
      'Extrais le vendeur, la date et chaque ligne de cette facture de vin.',
      imageUrl,
    );
  }
}
