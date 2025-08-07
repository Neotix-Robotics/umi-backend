#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
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
  red: '\x1b[31m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(msg)
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

// Check if PostgreSQL is available
async function checkPostgres() {
  try {
    await execAsync('psql --version');
    log.success('PostgreSQL is installed');
    
    // Check if PostgreSQL is running by trying to connect
    const { stderr } = await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -c "SELECT 1" -d postgres`
    );
    
    if (stderr && stderr.includes('could not connect')) {
      throw new Error('Cannot connect to PostgreSQL');
    }
    
    log.success('PostgreSQL is running');
    return true;
  } catch (error) {
    if (error.message.includes('command not found') || error.message.includes('is not recognized')) {
      log.error('PostgreSQL is not installed. Please install PostgreSQL first.');
    } else {
      log.error('PostgreSQL is not running or cannot connect. Please check your PostgreSQL installation.');
      log.info(`Error: ${error.message}`);
    }
    return false;
  }
}

// Create a database
async function createDatabase(dbName) {
  log.warning(`Creating database: ${dbName}...`);
  
  try {
    // Check if database exists
    const { stdout } = await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -lqt -d postgres`
    );
    
    const dbExists = stdout.split('\n').some(line => line.includes(dbName));
    
    if (dbExists) {
      log.warning(`Database ${dbName} already exists. Dropping and recreating...`);
      await execAsync(
        `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -c "DROP DATABASE IF EXISTS ${dbName}" -d postgres`
      );
    }
    
    // Create database
    await execAsync(
      `PGPASSWORD=${DB_CONFIG.password} psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -c "CREATE DATABASE ${dbName}" -d postgres`
    );
    
    log.success(`Database ${dbName} created successfully`);
  } catch (error) {
    log.error(`Failed to create database ${dbName}: ${error.message}`);
    throw error;
  }
}

// Update environment files
function updateEnvFiles() {
  log.warning('Updating environment files...');
  
  const mainDbUrl = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.mainDb}`;
  const testDbUrl = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.testDb}`;
  
  // Update .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(path.join(process.cwd(), '.env.example'))) {
    envContent = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
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
    const mainDbUrl = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.mainDb}`;
    await execAsync(`DATABASE_URL="${mainDbUrl}" npx prisma migrate deploy`);
    
    // Run migrations for test database
    log.warning('Running migrations for test database...');
    const testDbUrl = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.testDb}`;
    await execAsync(`DATABASE_URL="${testDbUrl}" npx prisma migrate deploy`);
    
    log.success('Migrations completed');
  } catch (error) {
    log.error(`Failed to run migrations: ${error.message}`);
    throw error;
  }
}

// Main function
async function main() {
  console.log('======================================');
  console.log('Database Setup Configuration:');
  console.log(`User: ${DB_CONFIG.user}`);
  console.log(`Password: ${DB_CONFIG.password}`);
  console.log(`Host: ${DB_CONFIG.host}`);
  console.log(`Port: ${DB_CONFIG.port}`);
  console.log(`Main Database: ${DB_CONFIG.mainDb}`);
  console.log(`Test Database: ${DB_CONFIG.testDb}`);
  console.log('======================================\n');
  
  try {
    // Check PostgreSQL
    const pgAvailable = await checkPostgres();
    if (!pgAvailable) {
      process.exit(1);
    }
    
    // Create databases
    await createDatabase(DB_CONFIG.mainDb);
    await createDatabase(DB_CONFIG.testDb);
    
    // Update environment files
    updateEnvFiles();
    
    // Ask if user wants to run migrations
    const runMigrationsAnswer = await askQuestion('Do you want to run Prisma migrations now? (y/n) ');
    
    if (runMigrationsAnswer.toLowerCase() === 'y') {
      await runMigrations();
    } else {
      log.warning('Skipping migrations. You can run them later with:');
      console.log('npm run prisma:migrate');
    }
    
    console.log('');
    log.success('🎉 Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Make sure your .env file has the correct settings');
    console.log('2. Run \'npm run prisma:migrate\' if you didn\'t run migrations');
    console.log('3. Run \'npm run dev\' to start the development server');
    console.log('4. Run \'npm test\' to run the test suite');
    
  } catch (error) {
    log.error('Setup failed: ' + error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the setup
main();