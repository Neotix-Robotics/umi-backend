# UMI Backend API

Backend API server for the UMI Controller multi-user task management system.

## Setup

### Quick Start (Recommended)

We provide an automated setup script that handles everything:

```bash
# Using Docker (recommended)
docker-compose up -d
./scripts/setup-db.sh

# Or using local PostgreSQL
./scripts/setup-db.sh
```

This will:
- Create the database
- Run migrations
- Seed initial data (admin user, sample data)
- Update your .env file

For detailed setup instructions, see [SETUP.md](./SETUP.md).

### Manual Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Run Prisma migrations:**
   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Type checking
npm run lint

# Clean build directory
npm run clean
```

## API Endpoints

All endpoints are prefixed with `/api/v1/` for versioning.

### Health & Version
- `GET /health` - Health check (no versioning)
- `GET /api/v1` - API version and endpoints info

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - Register new user (admin only)
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - Logout user

### Tasks
- `GET /api/v1/tasks` - List tasks (filtered by role)
- `POST /api/v1/tasks` - Create new task (admin only)
- `GET /api/v1/tasks/:id` - Get task details
- `PUT /api/v1/tasks/:id` - Update task (admin only)
- `DELETE /api/v1/tasks/:id` - Delete task (admin only)

### Users
- `GET /api/v1/users` - List all users (admin only)
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile
- `DELETE /api/v1/users/:id` - Delete user (admin only)

### Recording Sessions
- `POST /api/v1/assignments` - Create task assignment (admin only)
- `GET /api/v1/assignments/:id/sessions` - Get recording sessions for assignment
- `GET /api/v1/assignments/:id/progress` - Get assignment progress
- `POST /api/v1/sessions` - Start recording session
- `PUT /api/v1/sessions/:id` - Update session status
- `POST /api/v1/sessions/:id/metadata` - Upload session metadata

## Environment Variables

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (optional)
- `JWT_SECRET` - Secret for JWT signing
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `JWT_EXPIRES_IN` - Access token expiration (default: 24h)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration (default: 7d)
- `BCRYPT_ROUNDS` - Bcrypt salt rounds (default: 10)
- `API_RATE_LIMIT` - Rate limit per window (default: 100)

## Project Structure

```
src/
├── controllers/    # Request handlers
├── middleware/     # Express middleware
├── models/         # TypeScript interfaces
├── routes/         # API route definitions
├── services/       # Business logic
├── utils/          # Utilities (database, validators)
├── config/         # Configuration
└── app.ts         # Application entry point
```