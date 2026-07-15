import { PrismaClient } from '@prisma/client';

// Re-export the generated types so apps depend on `@adx/database`, not on the
// raw @prisma/client path. This keeps the ORM an internal implementation detail.
export * from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
