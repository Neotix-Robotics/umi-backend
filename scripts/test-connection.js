const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  console.log('Testing database connection...\n');
  
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://umi_user:umi_password@localhost:5432/umi_test';
  console.log('DATABASE_URL:', databaseUrl.replace(/:([^@]+)@/, ':****@'));
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
  
  try {
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Connected to database');
    
    // Test if we can query
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`;
    console.log('✅ Query successful:', result);
    
    // Check if migrations table exists
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    console.log('\n📋 Tables in database:');
    tables.forEach(t => console.log(`  - ${t.tablename}`));
    
    // Check migration status
    try {
      const migrations = await prisma.$queryRaw`
        SELECT * FROM _prisma_migrations 
        ORDER BY started_at DESC 
        LIMIT 5
      `;
      console.log('\n📋 Recent migrations:');
      migrations.forEach(m => console.log(`  - ${m.migration_name} (${m.finished_at ? 'completed' : 'pending'})`));
    } catch (e) {
      console.log('\n⚠️  No migrations table found - database needs migrations');
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run with environment variable if provided
if (process.argv[2]) {
  process.env.DATABASE_URL = process.argv[2];
}

testConnection();