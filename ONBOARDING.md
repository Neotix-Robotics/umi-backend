# Team Onboarding Guide - umi-backend

Welcome to the umi-backend project! This guide will help you get set up quickly.

## Prerequisites

1. **Node.js** (v16 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **PostgreSQL** (v13 or higher)
   - **macOS**: `brew install postgresql && brew services start postgresql`
   - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - **Linux**: `sudo apt-get install postgresql postgresql-contrib`
   - Verify: `psql --version`

3. **Git**
   - Clone the repository: `git clone <repo-url>`

## Quick Start (5 minutes)

### Step 1: Install Dependencies
```bash
cd umi-backend
npm install
```

### Step 2: Set Up Database
```bash
npm run db:setup
```

This interactive script will:
- ✅ Detect your PostgreSQL installation
- ✅ Create a dedicated database user (`umi_user`)
- ✅ Create both development and test databases
- ✅ Configure your environment files automatically
- ✅ Run database migrations

**Note**: The script will ask for your PostgreSQL admin credentials if needed. On most systems, you can just press Enter to use defaults.

### Step 3: Verify Setup
```bash
# Check if everything is working
npm run dev
```

Visit http://localhost:3000/health - you should see:
```json
{
  "status": "ok",
  "timestamp": "2024-XX-XX...",
  "environment": "development"
}
```

### Step 4: Run Tests (Optional)
```bash
npm test
```

## Database Credentials

The setup script creates these credentials automatically:
- **User**: `umi_user`
- **Password**: `umi_password`
- **Main Database**: `umi_backend`
- **Test Database**: `umi_test`
- **Connection**: `localhost:5432`

## Common Tasks

### Reset Database
```bash
# Clear all data (keep structure)
npm run db:truncate

# Complete reset (drop and recreate)
npm run db:reset
```

### View Database
```bash
# Open Prisma Studio (GUI)
npm run prisma:studio
```

### Update Database Schema
```bash
# After pulling new changes
npm run prisma:migrate
```

## Project Structure

```
umi-backend/
├── src/
│   ├── controllers/    # API endpoint handlers
│   ├── routes/         # Route definitions
│   ├── services/       # Business logic
│   ├── middleware/     # Express middleware
│   └── utils/          # Helper functions
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── migrations/     # Migration history
├── scripts/            # Setup and utility scripts
└── src/__tests__/      # Test files
```

## API Overview

The backend provides these main endpoints:

- **Auth**: `/api/v1/auth/*` - Login, register, refresh tokens
- **Tasks**: `/api/v1/tasks/*` - CRUD operations for tasks
- **Users**: `/api/v1/users/*` - User management
- **Assignments**: `/api/v1/assignments/*` - Task assignments
- **Sessions**: `/api/v1/sessions/*` - Recording sessions

## Environment Files

The setup script creates these files:
- `.env` - Development configuration
- `.env.test` - Test configuration

These are gitignored, so each developer has their own copy.

## Troubleshooting

### "PostgreSQL is not running"
- **macOS**: `brew services start postgresql`
- **Linux**: `sudo systemctl start postgresql`
- **Windows**: Start PostgreSQL service from Services panel

### "FATAL: role 'postgres' does not exist"
The setup script handles this automatically by detecting your system user.

### "User was denied access on the database" (P1010 error)
This happens when the database user lacks proper permissions. Fix it with:
```bash
npm run db:fix-permissions
```

Or manually:
```bash
psql -U <your-admin-user> -f scripts/fix-permissions.sql
```

### "Database already exists"
Use the cleanup script:
```bash
npm run db:cleanup
```

### Port 3000 already in use
Change the port in your `.env` file:
```
PORT=3001
```

## Getting Help

1. Check the [README.md](README.md) for detailed documentation
2. Run test suite to ensure everything works: `npm test`
3. Ask team members in Slack/Discord
4. Check existing issues in GitHub

## Tips for New Developers

1. **Use Prisma Studio** to explore the database visually:
   ```bash
   npm run prisma:studio
   ```

2. **Watch mode** for development:
   ```bash
   npm run dev
   ```

3. **Test specific endpoints** with tools like:
   - [Postman](https://www.postman.com/)
   - [Insomnia](https://insomnia.rest/)
   - VSCode REST Client extension

4. **Database migrations** are handled automatically, but you can create new ones:
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```

## Next Steps

1. ✅ Complete setup
2. 📖 Read the API documentation
3. 🧪 Run the test suite
4. 🚀 Start building!

---

**Welcome to the team!** 🎉