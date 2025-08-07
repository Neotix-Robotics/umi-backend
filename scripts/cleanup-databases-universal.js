#!/usr/bin/env node

const { exec } = require('child_process');
const readline = require('readline');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

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

// Get database configuration from environment
function getDbConfig() {
  // Try to read from .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL="?postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^"?\s]+)/);
    
    if (match) {
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: match[4],
        mainDb: match[5],
        testDb: match[5].replace('_backend', '_test')
      };
    }
  }
  
  // Fallback to defaults
  return {
    user: 'umi_user',
    password: 'umi_password',
    host: 'localhost',
    port: '5432',
    mainDb: 'umi_backend',
    testDb: 'umi_test'
  };
}

// Execute SQL command
async function executeSql(sql, database, config) {
  const command = `PGPASSWORD="${config.password}" psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${database} -c "${sql}"`;
  return execAsync(command);
}

// Check database connection
async function checkConnection(config) {
  try {
    await executeSql('SELECT 1', config.mainDb, config);
    return true;
  } catch (error) {
    // Try with postgres database
    try {
      await executeSql('SELECT 1', 'postgres', config);
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Truncate all tables in a database
async function truncateDatabase(dbName, config) {
  log.warning(`Truncating all tables in: ${dbName}...`);
  
  try {
    // Get all table names excluding migrations
    const { stdout } = await executeSql(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';",
      dbName,
      config
    );
    
    const tables = stdout.trim().split('\n')
      .slice(2) // Skip header lines
      .filter(line => line.trim() && !line.includes('---') && !line.includes('rows)'))
      .map(line => line.trim());
    
    if (tables.length === 0) {
      log.warning(`No tables found in ${dbName}`);
      return;
    }
    
    // Build TRUNCATE command
    const tableList = tables.map(t => `"${t}"`).join(', ');
    const truncateCmd = `TRUNCATE TABLE ${tableList} CASCADE;`;
    
    // Execute truncate
    await executeSql(truncateCmd, dbName, config);
    
    log.success(`All tables in ${dbName} truncated`);
  } catch (error) {
    log.error(`Failed to truncate ${dbName}: ${error.message}`);
    throw error;
  }
}

// Drop database (requires admin connection)
async function dropDatabase(dbName, config) {
  log.warning(`Dropping database: ${dbName}...`);
  
  const adminConfig = await getAdminConfig(config);
  if (!adminConfig) {
    log.error('Cannot drop database without admin access');
    return;
  }
  
  try {
    // Terminate connections
    await executeSql(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();`,
      'postgres',
      adminConfig
    ).catch(() => {});
    
    // Drop database
    await executeSql(`DROP DATABASE IF EXISTS ${dbName}`, 'postgres', adminConfig);
    
    log.success(`Database ${dbName} dropped`);
  } catch (error) {
    log.error(`Failed to drop database ${dbName}: ${error.message}`);
    throw error;
  }
}

// Get admin configuration
async function getAdminConfig(appConfig) {
  log.warning('\n📋 Admin access required for this operation\n');
  
  // Try current system user first
  try {
    const { stdout: currentUser } = await execAsync('whoami');
    const user = currentUser.trim();
    await execAsync(`psql -U ${user} -d postgres -c "SELECT 1"`);
    return { ...appConfig, user, password: null };
  } catch (e) {
    // Need to ask for admin credentials
    const adminUser = await askQuestion('PostgreSQL admin username (default: postgres): ');
    const adminPassword = await askQuestion('PostgreSQL admin password: ');
    
    return {
      ...appConfig,
      user: adminUser || 'postgres',
      password: adminPassword
    };
  }
}

// Reset database
async function resetDatabase(dbName, config) {
  log.warning(`Resetting database: ${dbName}...`);
  
  await dropDatabase(dbName, config);
  
  const adminConfig = await getAdminConfig(config);
  if (!adminConfig) return;
  
  try {
    // Create database
    await executeSql(`CREATE DATABASE ${dbName} OWNER ${config.user}`, 'postgres', adminConfig);
    log.success(`Database ${dbName} created`);
    
    // Run migrations
    log.warning(`Running migrations for ${dbName}...`);
    const dbUrl = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${dbName}`;
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
  console.log('4) Drop both databases (requires admin)');
  console.log('5) Drop main database only (requires admin)');
  console.log('6) Drop test database only (requires admin)');
  console.log('7) Reset both databases (requires admin)');
  console.log('8) Reset main database only (requires admin)');
  console.log('9) Reset test database only (requires admin)');
  console.log('0) Exit');
  console.log('');
}

// Main function
async function main() {
  console.log('🧹 Database cleanup for umi-backend\n');
  
  const config = getDbConfig();
  
  console.log('Current configuration:');
  console.log(`  User: ${config.user}`);
  console.log(`  Main DB: ${config.mainDb}`);
  console.log(`  Test DB: ${config.testDb}`);
  console.log('');
  
  // Check connection
  const connected = await checkConnection(config);
  if (!connected) {
    log.error('Cannot connect to database. Please check your configuration.');
    log.info('Make sure the database exists and your .env file is correct.');
    process.exit(1);
  }
  
  log.success('Connected to database');
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  if (args.length > 0) {
    try {
      switch (args[0]) {
        case '--truncate':
          await truncateDatabase(config.mainDb, config);
          await truncateDatabase(config.testDb, config);
          break;
          
        case '--drop':
          console.log(`${colors.red}⚠️  WARNING: This will drop both databases!${colors.reset}`);
          const confirmDrop = await askQuestion('Are you sure? (yes/no): ');
          if (confirmDrop === 'yes') {
            await dropDatabase(config.mainDb, config);
            await dropDatabase(config.testDb, config);
          }
          break;
          
        case '--reset':
          await resetDatabase(config.mainDb, config);
          await resetDatabase(config.testDb, config);
          break;
          
        case '--help':
          console.log('Usage: node cleanup-databases-universal.js [option]');
          console.log('Options:');
          console.log('  --truncate    Truncate all tables in both databases');
          console.log('  --drop        Drop both databases (requires admin)');
          console.log('  --reset       Reset both databases (requires admin)');
          console.log('  --help        Show this help message');
          console.log('');
          console.log('Run without options for interactive menu');
          break;
          
        default:
          log.error(`Unknown option: ${args[0]}`);
      }
    } catch (error) {
      log.error(`Operation failed: ${error.message}`);
    }
    rl.close();
    return;
  }
  
  // Interactive menu
  while (true) {
    showMenu();
    const choice = await askQuestion('Enter your choice (0-9): ');
    
    try {
      switch (choice) {
        case '1':
          await truncateDatabase(config.mainDb, config);
          await truncateDatabase(config.testDb, config);
          break;
          
        case '2':
          await truncateDatabase(config.mainDb, config);
          break;
          
        case '3':
          await truncateDatabase(config.testDb, config);
          break;
          
        case '4':
          console.log(`${colors.red}⚠️  WARNING: This will drop both databases!${colors.reset}`);
          const confirm4 = await askQuestion('Are you sure? (yes/no): ');
          if (confirm4 === 'yes') {
            await dropDatabase(config.mainDb, config);
            await dropDatabase(config.testDb, config);
          }
          break;
          
        case '5':
          console.log(`${colors.red}⚠️  WARNING: This will drop the main database!${colors.reset}`);
          const confirm5 = await askQuestion('Are you sure? (yes/no): ');
          if (confirm5 === 'yes') {
            await dropDatabase(config.mainDb, config);
          }
          break;
          
        case '6':
          console.log(`${colors.red}⚠️  WARNING: This will drop the test database!${colors.reset}`);
          const confirm6 = await askQuestion('Are you sure? (yes/no): ');
          if (confirm6 === 'yes') {
            await dropDatabase(config.testDb, config);
          }
          break;
          
        case '7':
          log.warning('This will reset both databases with fresh schema');
          const confirm7 = await askQuestion('Continue? (y/n): ');
          if (confirm7.toLowerCase() === 'y') {
            await resetDatabase(config.mainDb, config);
            await resetDatabase(config.testDb, config);
          }
          break;
          
        case '8':
          log.warning('This will reset the main database with fresh schema');
          const confirm8 = await askQuestion('Continue? (y/n): ');
          if (confirm8.toLowerCase() === 'y') {
            await resetDatabase(config.mainDb, config);
          }
          break;
          
        case '9':
          log.warning('This will reset the test database with fresh schema');
          const confirm9 = await askQuestion('Continue? (y/n): ');
          if (confirm9.toLowerCase() === 'y') {
            await resetDatabase(config.testDb, config);
          }
          break;
          
        case '0':
          log.success('Exiting...');
          rl.close();
          process.exit(0);
          
        default:
          log.error('Invalid option. Please try again.');
      }
      
      if (choice !== '0') {
        await askQuestion('\nPress Enter to continue...');
      }
    } catch (error) {
      log.error(`Operation failed: ${error.message}`);
    }
  }
}

// Run
main();