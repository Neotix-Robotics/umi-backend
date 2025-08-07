#!/bin/bash

# Database setup script for umi-backend
# This script creates both the main and test databases with the postgres user

set -e  # Exit on error

echo "🚀 Setting up PostgreSQL databases for umi-backend..."

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database configuration
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"
MAIN_DB="umi_backend"
TEST_DB="umi_test"

# Function to check if PostgreSQL is running
check_postgres() {
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ PostgreSQL is not installed. Please install PostgreSQL first.${NC}"
        exit 1
    fi
    
    if ! pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
        echo -e "${RED}❌ PostgreSQL is not running. Please start PostgreSQL first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
}

# Function to create a database
create_database() {
    local db_name=$1
    
    echo -e "${YELLOW}Creating database: $db_name...${NC}"
    
    # Check if database exists
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $db_name; then
        echo -e "${YELLOW}Database $db_name already exists. Dropping and recreating...${NC}"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $db_name;"
    fi
    
    # Create database
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $db_name;"
    
    echo -e "${GREEN}✅ Database $db_name created successfully${NC}"
}

# Function to update .env files
update_env_files() {
    echo -e "${YELLOW}Updating environment files...${NC}"
    
    # Create .env if it doesn't exist
    if [ ! -f .env ]; then
        cp .env.example .env 2>/dev/null || true
    fi
    
    # Update or add DATABASE_URL in .env
    if grep -q "^DATABASE_URL=" .env; then
        sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$MAIN_DB\"|" .env
    else
        echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$MAIN_DB\"" >> .env
    fi
    
    # Update or add TEST_DATABASE_URL in .env.test
    if [ -f .env.test ]; then
        if grep -q "^TEST_DATABASE_URL=" .env.test; then
            sed -i.bak "s|^TEST_DATABASE_URL=.*|TEST_DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$TEST_DB\"|" .env.test
        else
            echo "TEST_DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$TEST_DB\"" >> .env.test
        fi
        
        # Also update DATABASE_URL in .env.test to use test database
        if grep -q "^DATABASE_URL=" .env.test; then
            sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$TEST_DB\"|" .env.test
        else
            echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$TEST_DB\"" >> .env.test
        fi
    fi
    
    # Remove backup files
    rm -f .env.bak .env.test.bak
    
    echo -e "${GREEN}✅ Environment files updated${NC}"
}

# Function to run migrations
run_migrations() {
    echo -e "${YELLOW}Running migrations...${NC}"
    
    # Generate Prisma client
    npx prisma generate
    
    # Run migrations for main database
    echo -e "${YELLOW}Running migrations for main database...${NC}"
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$MAIN_DB" npx prisma migrate deploy
    
    # Run migrations for test database
    echo -e "${YELLOW}Running migrations for test database...${NC}"
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$TEST_DB" npx prisma migrate deploy
    
    echo -e "${GREEN}✅ Migrations completed${NC}"
}

# Main execution
main() {
    echo "======================================"
    echo "Database Setup Configuration:"
    echo "User: $DB_USER"
    echo "Password: $DB_PASSWORD"
    echo "Host: $DB_HOST"
    echo "Port: $DB_PORT"
    echo "Main Database: $MAIN_DB"
    echo "Test Database: $TEST_DB"
    echo "======================================"
    echo ""
    
    # Check PostgreSQL
    check_postgres
    
    # Create databases
    create_database $MAIN_DB
    create_database $TEST_DB
    
    # Update environment files
    update_env_files
    
    # Ask if user wants to run migrations
    read -p "Do you want to run Prisma migrations now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_migrations
    else
        echo -e "${YELLOW}Skipping migrations. You can run them later with:${NC}"
        echo "npm run prisma:migrate"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Database setup completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Make sure your .env file has the correct settings"
    echo "2. Run 'npm run prisma:migrate' if you didn't run migrations"
    echo "3. Run 'npm run dev' to start the development server"
    echo "4. Run 'npm test' to run the test suite"
}

# Run main function
main