import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

// Extend the global namespace to include prisma
declare global {
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

// Force test database URL before creating Prisma client
const testDbUrl = 'postgresql://umi_user:umi_password@localhost:5432/umi_test';
process.env.DATABASE_URL = testDbUrl;

export const prisma = global.__PRISMA_CLIENT__ || new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  global.__PRISMA_CLIENT__ = prisma;
}

// Setup test database
beforeAll(async () => {
  // Force test database URL - override any loaded .env
  const testDbUrl = 'postgresql://umi_user:umi_password@localhost:5432/umi_test';
  process.env.DATABASE_URL = testDbUrl;
  
  try {
    // Check if we can connect to the database first
    await prisma.$connect();
    
    // Check if migrations are needed
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
    `;
    
    if (tables && (tables as any[]).length > 0) {
      // Migrations table exists, check if all migrations are applied
      try {
        execSync('npx prisma migrate status', {
          env: {
            ...process.env,
            DATABASE_URL: testDbUrl,
            NODE_ENV: 'test'
          },
          stdio: 'pipe'
        });
        console.log('✅ Database migrations are up to date');
      } catch (statusError: any) {
        // Status check failed, try to apply migrations
        console.log('⚠️ Migrations needed, applying...');
        execSync('npx prisma migrate deploy', {
          env: {
            ...process.env,
            DATABASE_URL: testDbUrl,
            NODE_ENV: 'test'
          },
          stdio: 'inherit' // Show output for debugging
        });
      }
    } else {
      // No migrations table, run migrations
      console.log('📦 Setting up test database with migrations...');
      execSync('npx prisma migrate deploy', {
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          NODE_ENV: 'test'
        },
        stdio: 'inherit' // Show output for debugging
      });
    }
  } catch (error: any) {
    console.error('❌ Database setup failed:', error.message);
    
    // Log the actual database URL being used (without password)
    const sanitizedUrl = testDbUrl.replace(/:([^@]+)@/, ':****@');
    console.error('DATABASE_URL:', sanitizedUrl);
    
    // Check if it's a connection error
    if (error.message.includes('P1001') || error.message.includes('connect')) {
      throw new Error(
        'Cannot connect to test database. Please ensure PostgreSQL is running and the database exists.\n' +
        'Run: npm run db:setup to create the database.'
      );
    }
    
    // If migration fails due to permissions
    if (error.message.includes('P1010') || error.message.includes('denied') || error.message.includes('permission')) {
      throw new Error(
        'Database permission error. The user lacks necessary privileges.\n' +
        'Run: npm run db:fix-permissions to fix this issue.'
      );
    }
    
    throw error;
  }
});

// Clean up database between tests
beforeEach(async () => {
  // Clean up the database but keep the schema
  // Order matters due to foreign key constraints
  await prisma.$transaction([
    prisma.recordingSession.deleteMany(),
    prisma.taskAssignment.deleteMany(),
    prisma.subtask.deleteMany(),
    prisma.task.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Add custom matchers if needed
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
});