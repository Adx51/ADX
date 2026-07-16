import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WinesService } from '../wines/wines.service';
import { EnrichmentService } from '../ai/enrichment.service';
import {
  CreateBottleDto,
  UpdateBottleDto,
  ConsumeBottleDto,
  MoveBottleDto,
  ListBottlesQuery,
} from './dto';
import type { Prisma, BottleStatus } from '@adx/database';

@Injectable()
export class BottlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wines: WinesService,
    private readonly enrichment: EnrichmentService,
  ) {}

  async list(query: ListBottlesQuery) {
    const where: Prisma.BottleWhereInput = {
      status: (query.status as BottleStatus) ?? 'IN_STOCK',
    };
    if (query.cellarId) where.cellarId = query.cellarId;
    if (query.q) {
      where.wine = {
        OR: [
          { domain: { contains: query.q, mode: 'insensitive' } },
          { cuvee: { contains: query.q, mode: 'insensitive' } },
          { region: { contains: query.q, mode: 'insensitive' } },
          { appellation: { contains: query.q, mode: 'insensitive' } },
        ],
      };
    }

    return this.prisma.bottle.findMany({
      where,
      include: {
        wine: true,
        position: { include: { rack: { include: { zone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const bottle = await this.prisma.bottle.findUnique({
      where: { id },
      include: {
        wine: { include: { pricepoints: { orderBy: { recordedAt: 'asc' } } } },
        position: { include: { rack: { include: { zone: true } } } },
        consumptions: { orderBy: { consumedAt: 'desc' } },
        tastingNotes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!bottle) throw new NotFoundException('Bottle not found');
    return bottle;
  }

  /**
   * Adds a bottle (or several via `quantity`). Resolves the canonical wine with
   * AI enrichment, then estimates the market value so the portfolio view is
   * populated from the start.
   */
  async create(dto: CreateBottleDto) {
    const wine = await this.wines.findOrCreate({
      domain: dto.domain,
      cuvee: dto.cuvee,
      vintage: dto.vintage,
      appellation: dto.appellation,
      region: dto.region,
      country: dto.country,
      color: dto.color,
    });

    const valuation = await this.enrichment.valuate({
      domain: dto.domain,
      cuvee: dto.cuvee,
      vintage: dto.vintage,
      purchasePrice: dto.purchasePrice,
    });

    return this.prisma.bottle.create({
      data: {
        cellarId: dto.cellarId,
        wineId: wine.id,
        quantity: dto.quantity ?? 1,
        volumeMl: dto.volumeMl ?? 750,
        purchasePrice: dto.purchasePrice?.toString(),
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        purchasePlace: dto.purchasePlace,
        notes: dto.notes,
        personalRating: dto.personalRating,
        estimatedValue: valuation?.estimatedValue?.toString(),
        valueMin: valuation?.valueMin?.toString(),
        valueMax: valuation?.valueMax?.toString(),
      },
      include: { wine: true },
    });
  }

  async update(id: string, dto: UpdateBottleDto) {
    await this.ensureExists(id);
    return this.prisma.bottle.update({
      where: { id },
      data: {
        quantity: dto.quantity,
        purchasePrice: dto.purchasePrice?.toString(),
        purchasePlace: dto.purchasePlace,
        notes: dto.notes,
        personalRating: dto.personalRating,
        photoUrl: dto.photoUrl,
      },
      include: { wine: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.bottle.delete({ where: { id } });
  }

  /**
   * Records a consumption event and decrements stock. When the last unit is
   * consumed, the bottle flips to CONSUMED and frees its physical slot.
   */
  async consume(id: string, dto: ConsumeBottleDto) {
    const bottle = await this.ensureExists(id);
    const qty = dto.quantity ?? 1;
    if (qty > bottle.quantity) {
      throw new BadRequestException('Quantity exceeds remaining stock');
    }

    const remaining = bottle.quantity - qty;

    return this.prisma.$transaction(async (tx) => {
      await tx.consumption.create({
        data: { bottleId: id, quantity: qty, occasion: dto.occasion },
      });

      if (remaining <= 0) {
        await tx.position.updateMany({
          where: { bottleId: id },
          data: { bottleId: null },
        });
      }

      return tx.bottle.update({
        where: { id },
        data: {
          quantity: remaining,
          status: remaining <= 0 ? 'CONSUMED' : 'IN_STOCK',
        },
        include: { wine: true },
      });
    });
  }

  /** Drag-and-drop: assign a bottle to a physical slot (must be free). */
  async move(id: string, dto: MoveBottleDto) {
    await this.ensureExists(id);
    const position = await this.prisma.position.findUnique({
      where: { id: dto.positionId },
    });
    if (!position) throw new NotFoundException('Position not found');
    if (position.bottleId && position.bottleId !== id) {
      throw new BadRequestException('Position already occupied');
    }

    return this.prisma.$transaction(async (tx) => {
      // Vacate any previous slot held by this bottle.
      await tx.position.updateMany({
        where: { bottleId: id },
        data: { bottleId: null },
      });
      return tx.position.update({
        where: { id: dto.positionId },
        data: { bottleId: id },
      });
    });
  }

  /** Recompute the AI valuation on demand (e.g. nightly job or user refresh). */
  async revaluate(id: string) {
    const bottle = await this.findOne(id);
    const valuation = await this.enrichment.valuate({
      domain: bottle.wine.domain,
      cuvee: bottle.wine.cuvee,
      vintage: bottle.wine.vintage,
      purchasePrice: bottle.purchasePrice ? Number(bottle.purchasePrice) : null,
    });
    if (!valuation) return bottle;

    return this.prisma.bottle.update({
      where: { id },
      data: {
        estimatedValue: valuation.estimatedValue.toString(),
        valueMin: valuation.valueMin.toString(),
        valueMax: valuation.valueMax.toString(),
      },
      include: { wine: true },
    });
  }

  private async ensureExists(id: string) {
    const bottle = await this.prisma.bottle.findUnique({ where: { id } });
    if (!bottle) throw new NotFoundException('Bottle not found');
    return bottle;
  }
}
