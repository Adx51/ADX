import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async cellarIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { cellarId: true },
    });
    return memberships.map((m) => m.cellarId);
  }

  /** Portfolio overview: total value, gain/loss vs. purchase, counts. */
  async overview(userId: string) {
    const cellarIds = await this.cellarIds(userId);
    const bottles = await this.prisma.bottle.findMany({
      where: { cellarId: { in: cellarIds }, status: 'IN_STOCK' },
      include: { wine: true },
    });

    let totalValue = 0;
    let totalCost = 0;
    let bottleCount = 0;

    for (const b of bottles) {
      const qty = b.quantity;
      bottleCount += qty;
      if (b.estimatedValue) totalValue += Number(b.estimatedValue) * qty;
      if (b.purchasePrice) totalCost += Number(b.purchasePrice) * qty;
    }

    const gain = totalValue - totalCost;
    const returnPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;

    return {
      bottleCount,
      uniqueWines: new Set(bottles.map((b) => b.wineId)).size,
      totalValue: Math.round(totalValue),
      totalCost: Math.round(totalCost),
      gain: Math.round(gain),
      returnPct: Math.round(returnPct * 10) / 10,
      avgBottleValue: bottleCount > 0 ? Math.round(totalValue / bottleCount) : 0,
    };
  }

  /** Distribution breakdowns (color, region, country, vintage). */
  async distribution(userId: string) {
    const cellarIds = await this.cellarIds(userId);
    const bottles = await this.prisma.bottle.findMany({
      where: { cellarId: { in: cellarIds }, status: 'IN_STOCK' },
      include: { wine: true },
    });

    const byColor: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byVintage: Record<string, number> = {};

    for (const b of bottles) {
      const qty = b.quantity;
      const color = b.wine.color ?? 'UNKNOWN';
      const region = b.wine.region ?? 'Inconnue';
      const country = b.wine.country ?? 'Inconnu';
      const vintage = b.wine.vintage ? String(b.wine.vintage) : 'NV';
      byColor[color] = (byColor[color] ?? 0) + qty;
      byRegion[region] = (byRegion[region] ?? 0) + qty;
      byCountry[country] = (byCountry[country] ?? 0) + qty;
      byVintage[vintage] = (byVintage[vintage] ?? 0) + qty;
    }

    return { byColor, byRegion, byCountry, byVintage };
  }

  /**
   * Drinking-window alerts. Compares the current year to each wine's window to
   * flag bottles that are peaking, must be drunk soon, or are past their apogee.
   */
  async alerts(userId: string) {
    const year = new Date().getFullYear();
    const cellarIds = await this.cellarIds(userId);
    const bottles = await this.prisma.bottle.findMany({
      where: { cellarId: { in: cellarIds }, status: 'IN_STOCK' },
      include: { wine: true },
    });

    const alerts: Array<{
      bottleId: string;
      label: string;
      type: 'PEAK' | 'DRINK_SOON' | 'PAST_PEAK' | 'HOLD';
      message: string;
    }> = [];

    for (const b of bottles) {
      const label = [b.wine.domain, b.wine.cuvee, b.wine.vintage]
        .filter(Boolean)
        .join(' ');
      const { drinkFrom, drinkUntil, peakYear } = b.wine;

      if (drinkUntil && year > drinkUntil) {
        alerts.push({
          bottleId: b.id,
          label,
          type: 'PAST_PEAK',
          message: 'Risque de dépasser l’apogée — à boire sans tarder.',
        });
      } else if (drinkUntil && year >= drinkUntil - 1) {
        alerts.push({
          bottleId: b.id,
          label,
          type: 'DRINK_SOON',
          message: 'À boire dans les 12 mois.',
        });
      } else if (peakYear && Math.abs(year - peakYear) <= 1) {
        alerts.push({
          bottleId: b.id,
          label,
          type: 'PEAK',
          message: 'Cette bouteille arrive à son apogée.',
        });
      } else if (drinkFrom && year < drinkFrom) {
        alerts.push({
          bottleId: b.id,
          label,
          type: 'HOLD',
          message: `À conserver encore ${drinkFrom - year} an(s).`,
        });
      }
    }

    return alerts;
  }
}
