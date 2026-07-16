import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrichmentService } from '../ai/enrichment.service';
import type { Wine, WineColor } from '@adx/database';

export interface WineSeed {
  domain: string;
  cuvee?: string | null;
  vintage?: number | null;
  appellation?: string | null;
  region?: string | null;
  country?: string | null;
  // When the user (or the label scan) already knows these, they win over the
  // AI's text-only guess — e.g. a rosé seen on the photo must stay ROSE.
  color?: WineColor | null;
  grapes?: string[] | null;
}

@Injectable()
export class WinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrichment: EnrichmentService,
  ) {}

  /**
   * Finds an existing canonical wine (domain + cuvée + vintage) or creates one,
   * running AI enrichment on first creation so the technical sheet, drinking
   * window and pairings are populated automatically.
   */
  async findOrCreate(seed: WineSeed): Promise<Wine> {
    const existing = await this.prisma.wine.findUnique({
      where: {
        domain_cuvee_vintage: {
          domain: seed.domain,
          cuvee: seed.cuvee ?? '',
          vintage: seed.vintage ?? 0,
        },
      },
    });
    if (existing) return existing;

    const enriched = await this.enrichment.enrich(seed);

    return this.prisma.wine.create({
      data: {
        domain: seed.domain,
        cuvee: seed.cuvee ?? '',
        vintage: seed.vintage ?? 0,
        appellation: seed.appellation ?? enriched.appellation,
        region: seed.region ?? enriched.region,
        country: seed.country ?? enriched.country,
        producer: enriched.producer,
        color: seed.color ?? enriched.color,
        style: enriched.style ?? 'STILL',
        grapes: seed.grapes?.length ? seed.grapes : (enriched.grapes ?? []),
        abv: enriched.abv?.toString(),
        description: enriched.description,
        history: enriched.history,
        servingTempC: enriched.servingTempC,
        decantMinutes: enriched.decantMinutes,
        foodPairings: enriched.foodPairings ?? [],
        drinkFrom: enriched.drinkFrom,
        drinkUntil: enriched.drinkUntil,
        peakYear: enriched.peakYear,
        communityRating: enriched.communityRating?.toString(),
        aiConfidence: enriched.aiConfidence?.toString(),
      },
    });
  }

  findOne(id: string) {
    return this.prisma.wine.findUnique({
      where: { id },
      include: { pricepoints: { orderBy: { recordedAt: 'asc' } } },
    });
  }

  search(query: string, take = 20) {
    return this.prisma.wine.findMany({
      where: {
        OR: [
          { domain: { contains: query, mode: 'insensitive' } },
          { cuvee: { contains: query, mode: 'insensitive' } },
          { appellation: { contains: query, mode: 'insensitive' } },
          { region: { contains: query, mode: 'insensitive' } },
        ],
      },
      take,
    });
  }
}
