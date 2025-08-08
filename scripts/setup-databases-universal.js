#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Default database configuration
const DEFAULT_CONFIG = {
  host: 'localhost',
  port: '5432',
  appUser: 'umi_user',
  appPassword: 'umi_password',
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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Detect current user and PostgreSQL setup
async function detectPostgresSetup() {
  log.info('Detecting PostgreSQL setup...');
  
  try {
    // Try to connect without password (local peer authentication)
    const { stdout: currentUser } = await execAsync('whoami');
    const user = currentUser.trim();
    
    // Try connecting with current user
    await execAsync(`psql -U ${user} -d postgres -c "SELECT 1"`);
    log.success(`Can connect as system user: ${user}`);
    return { adminUser: user, needsPassword: false };
    
  } catch (error) {
    // Try common admin users
    const adminUsers = ['postgres', 'postgresql'];
    
    for (const adminUser of adminUsers) {
      try {
        await execAsync(`psql -U ${adminUser} -d postgres -c "SELECT 1"`);
        log.success(`Can connect as: ${adminUser}`);
        return { adminUser, needsPassword: false };
      } catch (e) {
        // Continue trying
      }
    }
    
    // If we get here, we need to ask for credentials
    log.warning('Could not connect with default users. Manual configuration needed.');
    return null;
  }
}

// Execute SQL with proper user context
async function executeSql(sql, database = 'postgres', config) {
  const { adminUser, adminPassword, needsPassword } = config;
  
  let command;
  if (needsPassword && adminPassword) {
    command = `PGPASSWORD="${adminPassword}" psql -h ${DEFAULT_CONFIG.host} -p ${DEFAULT_CONFIG.port} -U ${adminUser} -d ${database} -c "${sql}"`;
  } else {
    command = `psql -U ${adminUser} -d ${database} -c "${sql}"`;
  }
  
  return execAsync(command);
}

// Create application user
async function createAppUser(config) {
  log.warning(`Creating application user: ${DEFAULT_CONFIG.appUser}...`);
  
  try {
    // Check if user exists
    const checkUserResult = await executeSql(
      `SELECT 1 FROM pg_user WHERE usename = '${DEFAULT_CONFIG.appUser}'`,
      'postgres',
      config
    ).catch(() => null);
    
    if (checkUserResult) {
      log.warning(`User ${DEFAULT_CONFIG.appUser} already exists, updating password...`);
      // Update password for existing user
      await executeSql(
        `ALTER USER ${DEFAULT_CONFIG.appUser} WITH PASSWORD '${DEFAULT_CONFIG.appPassword}'`,
        'postgres',
        config
      );
      log.success('Application user password updated');
    } else {
      // Create user if doesn't exist
      await executeSql(
        `CREATE USER ${DEFAULT_CONFIG.appUser} WITH PASSWORD '${DEFAULT_CONFIG.appPassword}'`,
        'postgres',
        config
      );
      log.success('Application user created');
    }
  } catch (error) {
    log.error(`Failed to create/update user: ${error.message}`);
    throw error;
  }
}

// Create database with owner
async function createDatabase(dbName, config) {
  log.warning(`Creating database: ${dbName}...`);
  
  try {
    // Drop if exists
    await executeSql(
      `DROP DATABASE IF EXISTS ${dbName}`,
      'postgres',
      config
    );
    
    // Create database with owner
    await executeSql(
      `CREATE DATABASE ${dbName} OWNER ${DEFAULT_CONFIG.appUser}`,
      'postgres',
      config
    );
    
    // Grant all privileges on database
    await executeSql(
      `GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${DEFAULT_CONFIG.appUser}`,
      'postgres',
      config
    );
    
    // Grant schema permissions (needed for migrations)
    await executeSql(
      `GRANT ALL ON SCHEMA public TO ${DEFAULT_CONFIG.appUser}`,
      dbName,
      config
    );
    
    // Grant create permission on schema (needed for creating tables)
    await executeSql(
      `GRANT CREATE ON SCHEMA public TO ${DEFAULT_CONFIG.appUser}`,
      dbName,
      config
    );
    
    log.success(`Database ${dbName} created`);
  } catch (error) {
    log.error(`Failed to create database ${dbName}: ${error.message}`);
    throw error;
  }
}

// Update environment files
function updateEnvFiles() {
  log.warning('Updating environment files...');
  
  const mainDbUrl = `postgresql://${DEFAULT_CONFIG.appUser}:${DEFAULT_CONFIG.appPassword}@${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/${DEFAULT_CONFIG.mainDb}`;
  const testDbUrl = `postgresql://${DEFAULT_CONFIG.appUser}:${DEFAULT_CONFIG.appPassword}@${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/${DEFAULT_CONFIG.testDb}`;
  
  // Create .env from example if it doesn't exist
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
  }
  
  // Update .env file
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${mainDbUrl}"`);
  } else {
    envContent += `\nDATABASE_URL="${mainDbUrl}"`;
  }
  
  fs.writeFileSync(envPath, envContent);
  
  // Update .env.test file
  const envTestPath = path.join(process.cwd(), '.env.test');
  if (fs.existsSync(envTestPath)) {
    let envTestContent = fs.readFileSync(envTestPath, 'utf8');
    
    // Update DATABASE_URL
    if (envTestContent.includes('DATABASE_URL=')) {
      envTestContent = envTestContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${testDbUrl}"`);
    } else {
      envTestContent += `\nDATABASE_URL="${testDbUrl}"`;
    }
    
    // Update TEST_DATABASE_URL
    if (envTestContent.includes('TEST_DATABASE_URL=')) {
      envTestContent = envTestContent.replace(/TEST_DATABASE_URL=.*/g, `TEST_DATABASE_URL="${testDbUrl}"`);
    } else {
      envTestContent += `\nTEST_DATABASE_URL="${testDbUrl}"`;
    }
    
    fs.writeFileSync(envTestPath, envTestContent);
  }
  
  log.success('Environment files updated');
}

// Run Prisma migrations
async function runMigrations() {
  log.warning('Running migrations...');
  
  try {
    // Generate Prisma client
    log.info('Generating Prisma client...');
    await execAsync('npx prisma generate');
    
    // Run migrations for main database
    log.warning('Running migrations for main database...');
    const mainDbUrl = `postgresql://${DEFAULT_CONFIG.appUser}:${DEFAULT_CONFIG.appPassword}@${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/${DEFAULT_CONFIG.mainDb}`;
    await execAsync(`DATABASE_URL="${mainDbUrl}" npx prisma migrate deploy`);
    
    // Run migrations for test database
    log.warning('Running migrations for test database...');
    const testDbUrl = `postgresql://${DEFAULT_CONFIG.appUser}:${DEFAULT_CONFIG.appPassword}@${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/${DEFAULT_CONFIG.testDb}`;
    await execAsync(`DATABASE_URL="${testDbUrl}" npx prisma migrate deploy`);
    
    log.success('Migrations completed');
  } catch (error) {
    log.error(`Failed to run migrations: ${error.message}`);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🚀 Universal Database Setup for umi-backend\n');
  console.log('This script will:');
  console.log('1. Create a dedicated database user (umi_user)');
  console.log('2. Create main and test databases');
  console.log('3. Set up your environment files');
  console.log('4. Run migrations\n');
  
  try {
    // Detect PostgreSQL setup
    let config = await detectPostgresSetup();
    
    if (!config) {
      // Manual configuration needed
      log.warning('\n📋 Manual PostgreSQL configuration required\n');
      
      const adminUser = await askQuestion('PostgreSQL admin username (default: postgres): ');
      const adminPassword = await askQuestion('PostgreSQL admin password (leave blank if not needed): ');
      
      config = {
        adminUser: adminUser || 'postgres',
        adminPassword: adminPassword,
        needsPassword: !!adminPassword
      };
      
      // Test connection
      try {
        await executeSql('SELECT 1', 'postgres', config);
        log.success('Successfully connected to PostgreSQL');
      } catch (error) {
        log.error('Failed to connect to PostgreSQL. Please check your credentials.');
        process.exit(1);
      }
    }
    
    console.log('\n======================================');
    console.log('Configuration Summary:');
    console.log(`Admin User: ${config.adminUser}`);
    console.log(`App User: ${DEFAULT_CONFIG.appUser}`);
    console.log(`App Password: ${DEFAULT_CONFIG.appPassword}`);
    console.log(`Main Database: ${DEFAULT_CONFIG.mainDb}`);
    console.log(`Test Database: ${DEFAULT_CONFIG.testDb}`);
    console.log('======================================\n');
    
    const proceed = await askQuestion('Proceed with setup? (y/n) ');
    if (proceed.toLowerCase() !== 'y') {
      log.info('Setup cancelled');
      process.exit(0);
    }
    
    // Create application user
    await createAppUser(config);
    
    // Create databases
    await createDatabase(DEFAULT_CONFIG.mainDb, config);
    await createDatabase(DEFAULT_CONFIG.testDb, config);
    
    // Update environment files
    updateEnvFiles();
    
    // Ask if user wants to run migrations
    const runMigrationsAnswer = await askQuestion('\nRun Prisma migrations now? (y/n) ');
    
    if (runMigrationsAnswer.toLowerCase() === 'y') {
      await runMigrations();
    } else {
      log.warning('Skipping migrations. You can run them later with:');
      console.log('npm run prisma:migrate');
    }
    
    console.log('\n' + '='.repeat(50));
    log.success('🎉 Database setup completed successfully!');
    console.log('='.repeat(50) + '\n');
    
    console.log('📝 Database Credentials:');
    console.log(`   User: ${DEFAULT_CONFIG.appUser}`);
    console.log(`   Password: ${DEFAULT_CONFIG.appPassword}`);
    console.log(`   Main DB: ${DEFAULT_CONFIG.mainDb}`);
    console.log(`   Test DB: ${DEFAULT_CONFIG.testDb}\n`);
    
    console.log('📋 Next steps:');
    console.log('1. Your .env files have been updated automatically');
    console.log('2. Run \'npm run prisma:migrate\' if you skipped migrations');
    console.log('3. Run \'npm run dev\' to start the development server');
    console.log('4. Run \'npm test\' to run the test suite\n');
    
    console.log('💡 For team members:');
    console.log('   Share the database credentials securely');
    console.log('   They can run this same script on their machines');
    
  } catch (error) {
    log.error('Setup failed: ' + error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Add help command
if (process.argv.includes('--help')) {
  console.log('Universal Database Setup Script');
  console.log('\nUsage: node setup-databases-universal.js [options]');
  console.log('\nThis script automatically:');
  console.log('  - Detects your PostgreSQL setup');
  console.log('  - Creates a dedicated app user');
  console.log('  - Creates main and test databases');
  console.log('  - Updates environment files');
  console.log('  - Runs migrations (optional)');
  console.log('\nNo options needed - the script is interactive!');
  process.exit(0);
}

// Run the setup
main();