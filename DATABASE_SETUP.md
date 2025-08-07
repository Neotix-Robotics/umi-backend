# Database Setup Guide

This guide provides multiple methods to set up PostgreSQL databases for the umi-backend application.

## Quick Start (Recommended)

The universal setup script handles everything automatically:

```bash
npm run db:setup
```

This will:
- ✅ Detect your PostgreSQL setup automatically
- ✅ Create a dedicated application user (`umi_user`)
- ✅ Create `umi_backend` database (main)
- ✅ Create `umi_test` database (test)
- ✅ Update your `.env` files with the correct connection strings
- ✅ Optionally run migrations

## Why Use a Dedicated User?

The universal setup creates a dedicated `umi_user` instead of using system users because:
- **Portability**: Same credentials work across all team members' machines
- **Security**: Application has limited permissions, not full admin access
- **Simplicity**: No need to manage different PostgreSQL setups
- **Onboarding**: New team members get running in minutes

## Database Configuration

The universal setup creates:
- **App User**: `umi_user`
- **App Password**: `umi_password`
- **Host**: localhost
- **Port**: 5432
- **Main Database**: `umi_backend`
- **Test Database**: `umi_test`

## Setup Methods

### Method 1: Node.js Script (Recommended - Cross-platform)

```bash
npm run db:setup
```

Or run directly:
```bash
node scripts/setup-databases.js
```

### Method 2: Bash Script (macOS/Linux)

```bash
npm run db:setup:bash
```

Or run directly:
```bash
./scripts/setup-databases.sh
```

### Method 3: Docker Compose

If you prefer using Docker:

```bash
# Start PostgreSQL with Docker
docker-compose -f docker-compose.postgres.yml up -d

# Wait for PostgreSQL to be ready
sleep 5

# Run migrations
npm run prisma:migrate
```

### Method 4: Manual Setup

If you prefer to set up manually:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create databases
CREATE DATABASE umi_backend;
CREATE DATABASE umi_test;

# Exit psql
\q

# Update your .env file with:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/umi_backend"

# Update your .env.test file with:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/umi_test"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/umi_test"

# Run migrations
npm run prisma:migrate
```

## Environment Files

The setup scripts will automatically update your environment files:

### .env (Main database)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/umi_backend"
```

### .env.test (Test database)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/umi_test"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/umi_test"
```

## Running Migrations

After database creation, you need to run migrations:

```bash
# For development (creates migration files)
npm run prisma:migrate

# For production (applies existing migrations)
npm run prisma:migrate:prod
```

## Troubleshooting

### PostgreSQL not installed
- **macOS**: `brew install postgresql && brew services start postgresql`
- **Ubuntu/Debian**: `sudo apt-get install postgresql postgresql-contrib`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)

### PostgreSQL not running
- **macOS**: `brew services start postgresql`
- **Linux**: `sudo systemctl start postgresql`
- **Windows**: Start from Services panel

### Connection refused
- Check if PostgreSQL is running on port 5432
- Verify postgres user exists and password is correct
- Check pg_hba.conf allows local connections

### Permission denied
- Make sure the postgres user has the correct password
- On some systems, you may need to set the postgres password:
  ```bash
  sudo -u postgres psql
  ALTER USER postgres PASSWORD 'postgres';
  ```

## Scripts Overview

### setup-databases.js
- Cross-platform Node.js script
- Checks PostgreSQL installation and connection
- Creates/recreates databases
- Updates environment files
- Optionally runs migrations

### setup-databases.sh
- Bash script for Unix-like systems
- Same functionality as Node.js script
- More native feel for Linux/macOS users

### docker-compose.postgres.yml
- PostgreSQL 16 Alpine image
- Automatically creates both databases
- Persistent volume for data
- Health checks included

## Next Steps

After setting up the databases:

1. Run migrations if you haven't already:
   ```bash
   npm run prisma:migrate
   ```

2. Seed the database (optional):
   ```bash
   npm run prisma:seed
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Database Cleanup

Several cleanup options are available:

### Interactive Cleanup Menu
```bash
npm run db:cleanup
```

This provides an interactive menu with options to:
- Truncate tables (keep schema)
- Drop databases
- Reset databases (drop + recreate + migrate)

### Quick Cleanup Commands

```bash
# Truncate all tables in both databases (keep schema)
npm run db:truncate

# Drop both databases completely
npm run db:drop

# Reset both databases (drop, recreate, migrate)
npm run db:reset

# Use Prisma's built-in reset (interactive)
npm run prisma:reset
```

### Cleanup Options Explained

1. **Truncate**: Removes all data but keeps the schema intact
   - Fastest option for cleaning test data
   - Preserves migrations history
   - Good for development reset

2. **Drop**: Completely removes the database
   - Removes all data and schema
   - Cannot be undone
   - Requires running setup again

3. **Reset**: Drops and recreates with fresh schema
   - Clean slate with latest migrations
   - Good for resolving migration conflicts
   - Combines drop + create + migrate

## Security Note

The default configuration uses 'postgres' as both username and password. This is fine for development, but for production:
- Use strong passwords
- Consider using environment-specific users
- Use connection pooling
- Enable SSL/TLS
- Restrict network access