#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Database configuration
const DB_CONFIG = {
  appUser: 'umi_user',
  mainDb: 'umi_backend',
  testDb: 'umi_test'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`)
};

async function fixPermissions() {
  console.log('🔧 Fixing database permissions for umi_user...\n');
  
  try {
    // Get current user
    const { stdout: currentUser } = await execAsync('whoami');
    const adminUser = currentUser.trim();
    
    log.warning(`Using admin user: ${adminUser}`);
    
    // Fix permissions for both databases
    for (const dbName of [DB_CONFIG.mainDb, DB_CONFIG.testDb]) {
      log.warning(`Fixing permissions for database: ${dbName}`);
      
      try {
        // Grant all privileges on database
        await execAsync(
          `psql -U ${adminUser} -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${DB_CONFIG.appUser}"`
        );
        
        // Connect to the database and grant schema permissions
        await execAsync(
          `psql -U ${adminUser} -d ${dbName} -c "GRANT ALL ON SCHEMA public TO ${DB_CONFIG.appUser}"`
        );
        
        // Grant usage and create on schema
        await execAsync(
          `psql -U ${adminUser} -d ${dbName} -c "GRANT USAGE, CREATE ON SCHEMA public TO ${DB_CONFIG.appUser}"`
        );
        
        // Grant all privileges on all tables (including future ones)
        await execAsync(
          `psql -U ${adminUser} -d ${dbName} -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_CONFIG.appUser}"`
        );
        
        // Grant all privileges on all sequences (for auto-increment fields)
        await execAsync(
          `psql -U ${adminUser} -d ${dbName} -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_CONFIG.appUser}"`
        );
        
        // If there are existing tables, grant permissions on them too
        await execAsync(
          `psql -U ${adminUser} -d ${dbName} -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_CONFIG.appUser}"`
        ).catch(() => {}); // Ignore if no tables exist
        
        await execAsync(
          `psql -U ${adminUser} -d ${dbName} -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_CONFIG.appUser}"`
        ).catch(() => {}); // Ignore if no sequences exist
        
        log.success(`Permissions fixed for ${dbName}`);
      } catch (error) {
        log.error(`Failed to fix permissions for ${dbName}: ${error.message}`);
      }
    }
    
    log.success('\n🎉 Permissions fixed! Try running your tests again.');
    console.log('\nYou can now run:');
    console.log('  npm test');
    console.log('  npm run prisma:migrate');
    
  } catch (error) {
    log.error(`Failed to fix permissions: ${error.message}`);
    console.log('\nTry running this command with your PostgreSQL admin user:');
    console.log(`  psql -U <admin-user> -f scripts/fix-permissions.sql`);
  }
}

// Run the fix
fixPermissions();