import { PrismaClient, WineColor, WineStyle, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Demo credentials: demo@adx.wine / demo1234
const DEMO_PASSWORD = 'demo1234';

/**
 * Seeds a demo account with a small but realistic cellar so the UI has
 * something to render on a fresh install.
 */
async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@adx.wine' },
    update: { passwordHash },
    create: {
      email: 'demo@adx.wine',
      name: 'Antoine',
      locale: 'fr',
      passwordHash,
      preference: {
        create: {
          favoriteRegions: ['Bourgogne', 'Bordeaux', 'Rhône'],
          favoriteGrapes: ['Pinot Noir', 'Syrah', 'Chardonnay'],
        },
      },
    },
  });

  const cellar = await prisma.cellar.create({
    data: {
      name: 'Cave principale',
      description: 'Ma cave à la maison',
      ownerId: user.id,
      memberships: { create: { userId: user.id, role: Role.OWNER } },
      zones: {
        create: [
          {
            name: 'Mur A',
            position: 0,
            racks: {
              create: [
                { name: 'Casier A1', columns: 6, rows: 5, depth: 2, capacity: 60 },
                { name: 'Casier A2', columns: 6, rows: 5, depth: 2, capacity: 60 },
              ],
            },
          },
          { name: 'Mur B', position: 1 },
        ],
      },
    },
    include: { zones: { include: { racks: true } } },
  });

  const wines = [
    {
      domain: 'Domaine de la Romanée-Conti',
      cuvee: 'La Tâche',
      vintage: 2015,
      appellation: 'La Tâche Grand Cru',
      region: 'Bourgogne',
      country: 'France',
      color: WineColor.RED,
      grapes: ['Pinot Noir'],
      abv: '13.5',
      drinkFrom: 2028,
      drinkUntil: 2050,
      peakYear: 2038,
      servingTempC: 17,
      decantMinutes: 60,
      foodPairings: ['Gibier', 'Bœuf de Wagyu', 'Truffe'],
      estimatedValue: '4800',
      valueMin: '4200',
      valueMax: '5500',
      purchasePrice: '3200',
    },
    {
      domain: 'Château Margaux',
      cuvee: 'Grand Vin',
      vintage: 2010,
      appellation: 'Margaux',
      region: 'Bordeaux',
      country: 'France',
      color: WineColor.RED,
      grapes: ['Cabernet Sauvignon', 'Merlot', 'Petit Verdot'],
      abv: '13.5',
      drinkFrom: 2025,
      drinkUntil: 2045,
      peakYear: 2035,
      servingTempC: 17,
      decantMinutes: 90,
      foodPairings: ['Côte de bœuf', 'Agneau', 'Fromages affinés'],
      estimatedValue: '780',
      valueMin: '700',
      valueMax: '900',
      purchasePrice: '550',
    },
    {
      domain: 'Domaine Zind-Humbrecht',
      cuvee: 'Clos Windsbuhl',
      vintage: 2019,
      appellation: 'Alsace',
      region: 'Alsace',
      country: 'France',
      color: WineColor.WHITE,
      grapes: ['Riesling'],
      abv: '13',
      drinkFrom: 2024,
      drinkUntil: 2035,
      peakYear: 2029,
      servingTempC: 11,
      decantMinutes: 0,
      foodPairings: ['Poissons', 'Choucroute', 'Fromages'],
      estimatedValue: '65',
      valueMin: '55',
      valueMax: '80',
      purchasePrice: '48',
    },
  ];

  for (const w of wines) {
    const { estimatedValue, valueMin, valueMax, purchasePrice, ...wineData } = w;
    const wine = await prisma.wine.create({
      data: { ...wineData, style: WineStyle.STILL, aiConfidence: '0.9' },
    });
    await prisma.bottle.create({
      data: {
        cellarId: cellar.id,
        wineId: wine.id,
        quantity: 1,
        estimatedValue,
        valueMin,
        valueMax,
        purchasePrice,
        purchaseDate: new Date('2022-11-01'),
        purchasePlace: 'iDealwine',
      },
    });
  }

  console.log(`Seeded demo user ${user.email} with cellar "${cellar.name}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
