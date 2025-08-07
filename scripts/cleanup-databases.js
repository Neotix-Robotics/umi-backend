#!/usr/bin/env node

const { exec } = require('child_process');
const readline = require('readline');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Database configuration
const DB_CONFIG = {
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: '5432',
  mainDb: 'umi_backend',
  testDb: 'umi_test'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`)
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Check if PostgreSQL is available
async function checkPostgres() {
  try {
    await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -c "SELECT 1" -d postgres`
    );
    log.success('PostgreSQL is running');
    return true;
  } catch (error) {
    log.error('PostgreSQL is not running or cannot connect');
    return false;
  }
}

// Drop a database
async function dropDatabase(dbName) {
  log.warning(`Dropping database: ${dbName}...`);
  
  try {
    // Terminate existing connections
    await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();"`
    ).catch(() => {}); // Ignore errors if no connections
    
    // Drop database
    await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d postgres -c "DROP DATABASE IF EXISTS ${dbName}"`
    );
    
    log.success(`Database ${dbName} dropped`);
  } catch (error) {
    log.error(`Failed to drop database ${dbName}: ${error.message}`);
    throw error;
  }
}

// Truncate all tables in a database
async function truncateDatabase(dbName) {
  log.warning(`Truncating all tables in: ${dbName}...`);
  
  try {
    // Get all table names excluding migrations
    const { stdout } = await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${dbName} -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';"`
    );
    
    const tables = stdout.trim().split('\n')
      .filter(t => t.trim() && !t.includes('rows)'))
      .map(t => t.trim());
    
    if (tables.length === 0) {
      log.warning(`No tables found in ${dbName}`);
      return;
    }
    
    // Build TRUNCATE command
    const tableList = tables.map(t => `"${t.trim()}"`).join(', ');
    const truncateCmd = `TRUNCATE TABLE ${tableList} CASCADE;`;
    
    // Execute truncate
    await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${dbName} -c "${truncateCmd}"`
    );
    
    log.success(`All tables in ${dbName} truncated`);
  } catch (error) {
    log.error(`Failed to truncate ${dbName}: ${error.message}`);
    throw error;
  }
}

// Reset database (drop, create, migrate)
async function resetDatabase(dbName) {
  log.warning(`Resetting database: ${dbName}...`);
  
  try {
    // Drop database
    await dropDatabase(dbName);
    
    // Create database
    await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d postgres -c "CREATE DATABASE ${dbName}"`
    );
    log.success(`Database ${dbName} created`);
    
    // Run migrations
    log.warning(`Running migrations for ${dbName}...`);
    const dbUrl = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${dbName}`;
    await execAsync(`DATABASE_URL="${dbUrl}" npx prisma migrate deploy`);
    
    log.success(`Database ${dbName} reset complete`);
  } catch (error) {
    log.error(`Failed to reset ${dbName}: ${error.message}`);
    throw error;
  }
}

// Show menu
function showMenu() {
  console.log('');
  log.info('Select cleanup option:');
  console.log('1) Truncate all tables (keep schema) - Both databases');
  console.log('2) Truncate main database only');
  console.log('3) Truncate test database only');
  console.log('4) Drop both databases completely');
  console.log('5) Drop main database only');
  console.log('6) Drop test database only');
  console.log('7) Reset both databases (drop, create, migrate)');
  console.log('8) Reset main database only');
  console.log('9) Reset test database only');
  console.log('0) Exit');
  console.log('');
}

// Handle menu selection
async function handleMenuChoice(choice) {
  switch (choice) {
    case '1':
      await truncateDatabase(DB_CONFIG.mainDb);
      await truncateDatabase(DB_CONFIG.testDb);
      break;
      
    case '2':
      await truncateDatabase(DB_CONFIG.mainDb);
      break;
      
    case '3':
      await truncateDatabase(DB_CONFIG.testDb);
      break;
      
    case '4':
      console.log(`${colors.red}⚠️  WARNING: This will completely remove both databases!${colors.reset}`);
      const confirm4 = await askQuestion('Are you sure? (yes/no): ');
      if (confirm4 === 'yes') {
        await dropDatabase(DB_CONFIG.mainDb);
        await dropDatabase(DB_CONFIG.testDb);
      }
      break;
      
    case '5':
      console.log(`${colors.red}⚠️  WARNING: This will completely remove the main database!${colors.reset}`);
      const confirm5 = await askQuestion('Are you sure? (yes/no): ');
      if (confirm5 === 'yes') {
        await dropDatabase(DB_CONFIG.mainDb);
      }
      break;
      
    case '6':
      console.log(`${colors.red}⚠️  WARNING: This will completely remove the test database!${colors.reset}`);
      const confirm6 = await askQuestion('Are you sure? (yes/no): ');
      if (confirm6 === 'yes') {
        await dropDatabase(DB_CONFIG.testDb);
      }
      break;
      
    case '7':
      log.warning('This will drop and recreate both databases with fresh schema');
      const confirm7 = await askQuestion('Continue? (y/n): ');
      if (confirm7.toLowerCase() === 'y') {
        await resetDatabase(DB_CONFIG.mainDb);
        await resetDatabase(DB_CONFIG.testDb);
      }
      break;
      
    case '8':
      log.warning('This will drop and recreate the main database with fresh schema');
      const confirm8 = await askQuestion('Continue? (y/n): ');
      if (confirm8.toLowerCase() === 'y') {
        await resetDatabase(DB_CONFIG.mainDb);
      }
      break;
      
    case '9':
      log.warning('This will drop and recreate the test database with fresh schema');
      const confirm9 = await askQuestion('Continue? (y/n): ');
      if (confirm9.toLowerCase() === 'y') {
        await resetDatabase(DB_CONFIG.testDb);
      }
      break;
      
    case '0':
      log.success('Exiting...');
      rl.close();
      process.exit(0);
      
    default:
      log.error('Invalid option. Please try again.');
  }
}

// Main interactive function
async function interactive() {
  const pgAvailable = await checkPostgres();
  if (!pgAvailable) {
    rl.close();
    process.exit(1);
  }
  
  while (true) {
    showMenu();
    const choice = await askQuestion('Enter your choice (0-9): ');
    
    try {
      await handleMenuChoice(choice);
      
      if (choice !== '0') {
        await askQuestion('\nPress Enter to continue...');
      }
    } catch (error) {
      log.error(`Operation failed: ${error.message}`);
    }
  }
}

// Handle command line arguments
async function handleArgs() {
  const args = process.argv.slice(2);
  const arg = args[0];
  
  if (!arg) {
    return interactive();
  }
  
  const pgAvailable = await checkPostgres();
  if (!pgAvailable) {
    process.exit(1);
  }
  
  try {
    switch (arg) {
      case '--truncate':
        await truncateDatabase(DB_CONFIG.mainDb);
        await truncateDatabase(DB_CONFIG.testDb);
        break;
        
      case '--drop':
        console.log(`${colors.red}⚠️  WARNING: This will drop both databases!${colors.reset}`);
        const confirm = await askQuestion('Are you sure? (yes/no): ');
        if (confirm === 'yes') {
          await dropDatabase(DB_CONFIG.mainDb);
          await dropDatabase(DB_CONFIG.testDb);
        }
        break;
        
      case '--reset':
        await resetDatabase(DB_CONFIG.mainDb);
        await resetDatabase(DB_CONFIG.testDb);
        break;
        
      case '--help':
        console.log('Usage: node cleanup-databases.js [option]');
        console.log('Options:');
        console.log('  --truncate    Truncate all tables in both databases');
        console.log('  --drop        Drop both databases');
        console.log('  --reset       Drop and recreate both databases with migrations');
        console.log('  --help        Show this help message');
        console.log('');
        console.log('Run without options for interactive menu');
        break;
        
      default:
        log.error(`Unknown option: ${arg}`);
        console.log('Run with --help for usage information');
    }
  } catch (error) {
    log.error(`Operation failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
console.log('🧹 Database cleanup for umi-backend...\n');
handleArgs();