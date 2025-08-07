# PostgreSQL Setup for UMI Backend

## macOS Setup (using Homebrew)

1. **Install PostgreSQL**:
   ```bash
   brew install postgresql@15
   brew services start postgresql@15
   ```

2. **Create the database and user**:
   ```bash
   # Connect to PostgreSQL as the default user
   psql postgres
   
   # In the PostgreSQL prompt, run:
   CREATE USER umi_user WITH PASSWORD 'umi_password';
   CREATE DATABASE umi_tasks OWNER umi_user;
   GRANT ALL PRIVILEGES ON DATABASE umi_tasks TO umi_user;
   \q
   ```

3. **Update your .env file**:
   ```
   DATABASE_URL=postgresql://umi_user:umi_password@localhost:5432/umi_tasks
   ```

## Alternative: Using Docker

1. **Create docker-compose.yml** in the project root:
   ```yaml
   version: '3.8'
   services:
     postgres:
       image: postgres:15
       environment:
         POSTGRES_USER: umi_user
         POSTGRES_PASSWORD: umi_password
         POSTGRES_DB: umi_tasks
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
   
   volumes:
     postgres_data:
   ```

2. **Start PostgreSQL**:
   ```bash
   docker-compose up -d
   ```

3. **Update your .env file**:
   ```
   DATABASE_URL=postgresql://umi_user:umi_password@localhost:5432/umi_tasks
   ```

## Verify Connection

Test your connection:
```bash
psql postgresql://umi_user:umi_password@localhost:5432/umi_tasks
```

## Next Steps

Once PostgreSQL is running and configured:

1. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

2. **Run migrations**:
   ```bash
   npm run prisma:migrate
   ```

3. **Seed the database**:
   ```bash
   npm run prisma:seed
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```