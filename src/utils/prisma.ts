import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// In test environment, use the test prisma instance from setup
let prismaInstance: PrismaClient;

if (process.env.NODE_ENV === 'test') {
  // Use existing global instance for tests if available
  if ((global as any).__PRISMA_CLIENT__) {
    prismaInstance = (global as any).__PRISMA_CLIENT__;
  } else {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://umi_user:umi_password@localhost:5432/umi_test'
        }
      },
      log: ['error'] as const,
    });
    (global as any).__PRISMA_CLIENT__ = prismaInstance;
  }
} else {
  const prismaOptions = {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  };
  prismaInstance = globalForPrisma.prisma || new PrismaClient(prismaOptions as any);
}

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Middleware to log query execution time in development
if (process.env.NODE_ENV === 'development') {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
    return result;
  });
}