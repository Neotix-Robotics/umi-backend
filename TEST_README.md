# Backend Testing Guide

This guide explains how to run the comprehensive test suite for the umi-backend.

## Test Setup

### Prerequisites

1. PostgreSQL database running locally
2. Node.js and npm installed
3. All dependencies installed (`npm install`)

### Database Setup

1. Create a test database:
```bash
createdb umi_test
```

2. Copy the test environment file:
```bash
cp .env.test .env
```

3. Run migrations on test database:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/umi_test" npm run prisma:migrate
```

## Running Tests

### Run all tests:
```bash
npm test
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Run tests with coverage:
```bash
npm run test:coverage
```

### Run specific test file:
```bash
npm test -- taskRoutes.test.ts
```

### Run tests matching pattern:
```bash
npm test -- --testNamePattern="should create task"
```

## Test Structure

The test suite includes:

### Route Tests
- **Task Routes** (`taskRoutes.test.ts`): CRUD operations, video management, permissions
- **Auth Routes** (`authRoutes.test.ts`): Login, registration, token refresh, logout
- **User Routes** (`userRoutes.test.ts`): User management, profile updates, deletion
- **Recording Routes** (`recordingRoutes.test.ts`): Assignments, sessions, metadata

### Service Tests
- **Task Service** (`taskService.test.ts`): Business logic, data validation, progress tracking

### Middleware Tests
- **Error Handler** (`errorHandler.test.ts`): Error formatting, status codes, logging

### Test Helpers
- **Auth Helper** (`helpers/auth.ts`): User creation, token generation
- **Factories** (`helpers/factories.ts`): Test data creation
- **Setup** (`setup.ts`): Database cleanup, custom matchers

## Test Coverage

The test suite aims for 80%+ coverage and includes:

- ✅ All API endpoints
- ✅ Authentication and authorization
- ✅ Input validation
- ✅ Error handling
- ✅ Database operations
- ✅ Business logic
- ✅ Edge cases and error scenarios

## Common Issues

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env.test
- Verify database exists: `psql -d umi_test`

### Test Timeouts
- Increase Jest timeout in jest.config.js if needed
- Check for unresolved promises in tests

### Port Conflicts
- Tests use port 5001 by default
- Change PORT in .env.test if needed

## Writing New Tests

1. Follow existing test patterns
2. Use test helpers for common operations
3. Clean up test data (handled automatically by setup)
4. Test both success and error cases
5. Mock external dependencies when needed

## CI/CD Integration

For CI/CD pipelines, ensure:
1. PostgreSQL service is available
2. Test database is created
3. Migrations are run before tests
4. Environment variables are set

Example GitHub Actions setup:
```yaml
- name: Setup PostgreSQL
  uses: harmon758/postgresql-action@v1
  with:
    postgresql db: umi_test
    postgresql user: postgres
    postgresql password: postgres

- name: Run tests
  run: |
    cp .env.test .env
    npm run prisma:migrate:prod
    npm test
```