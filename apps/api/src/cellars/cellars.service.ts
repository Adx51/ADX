import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCellarDto, UpdateCellarDto, CreateZoneDto, CreateRackDto } from './dto';

@Injectable()
export class CellarsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string) {
    return this.prisma.cellar.findMany({
      where: { memberships: { some: { userId } } },
      include: {
        _count: { select: { bottles: { where: { status: 'IN_STOCK' } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const cellar = await this.prisma.cellar.findUnique({
      where: { id },
      include: {
        zones: {
          orderBy: { position: 'asc' },
          include: {
            racks: {
              include: {
                positions: { include: { bottle: { include: { wine: true } } } },
              },
            },
          },
        },
      },
    });
    if (!cellar) throw new NotFoundException('Cellar not found');
    return cellar;
  }

  async create(userId: string, dto: CreateCellarDto) {
    return this.prisma.cellar.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: userId,
        memberships: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  update(id: string, dto: UpdateCellarDto) {
    return this.prisma.cellar.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.cellar.delete({ where: { id } });
  }

  addZone(cellarId: string, dto: CreateZoneDto) {
    return this.prisma.zone.create({
      data: { cellarId, name: dto.name, position: dto.position ?? 0 },
    });
  }

  /**
   * Creates a rack and materializes every physical slot (column × row × depth)
   * so bottles can be assigned to a precise position immediately.
   */
  async addRack(zoneId: string, dto: CreateRackDto) {
    const depth = dto.depth ?? 1;
    const capacity = dto.columns * dto.rows * depth;

    return this.prisma.rack.create({
      data: {
        zoneId,
        name: dto.name,
        columns: dto.columns,
        rows: dto.rows,
        depth,
        capacity,
        positions: {
          create: Array.from({ length: dto.rows }, (_, r) =>
            Array.from({ length: dto.columns }, (_, c) =>
              Array.from({ length: depth }, (_, d) => ({
                column: c + 1,
                row: r + 1,
                level: d + 1,
              })),
            ),
          ).flat(2),
        },
      },
      include: { positions: true },
    });
  }
}
