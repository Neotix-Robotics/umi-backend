#!/bin/bash

# Database cleanup script for umi-backend
# This script can drop databases or clean data while preserving schema

set -e  # Exit on error

echo "🧹 Database cleanup for umi-backend..."

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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
    if ! pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
        echo -e "${RED}❌ PostgreSQL is not running. Please start PostgreSQL first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
}

# Function to drop a database
drop_database() {
    local db_name=$1
    
    echo -e "${YELLOW}Dropping database: $db_name...${NC}"
    
    # Terminate existing connections
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db_name' AND pid <> pg_backend_pid();" 2>/dev/null || true
    
    # Drop database
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $db_name;"
    
    echo -e "${GREEN}✅ Database $db_name dropped${NC}"
}

# Function to truncate all tables (keep schema)
truncate_database() {
    local db_name=$1
    
    echo -e "${YELLOW}Truncating all tables in: $db_name...${NC}"
    
    # Get all table names excluding migrations
    local tables=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $db_name -t -c \
        "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';")
    
    if [ -z "$tables" ]; then
        echo -e "${YELLOW}No tables found in $db_name${NC}"
        return
    fi
    
    # Build TRUNCATE command
    local truncate_cmd="TRUNCATE TABLE"
    for table in $tables; do
        truncate_cmd="$truncate_cmd \"$table\","
    done
    truncate_cmd="${truncate_cmd%,} CASCADE;"
    
    # Execute truncate
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $db_name -c "$truncate_cmd"
    
    echo -e "${GREEN}✅ All tables in $db_name truncated${NC}"
}

# Function to reset database (drop and recreate with migrations)
reset_database() {
    local db_name=$1
    
    echo -e "${YELLOW}Resetting database: $db_name...${NC}"
    
    # Drop database
    drop_database $db_name
    
    # Create database
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $db_name;"
    echo -e "${GREEN}✅ Database $db_name created${NC}"
    
    # Run migrations
    if [ "$db_name" = "$MAIN_DB" ]; then
        echo -e "${YELLOW}Running migrations for main database...${NC}"
        DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$db_name" npx prisma migrate deploy
    else
        echo -e "${YELLOW}Running migrations for test database...${NC}"
        DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$db_name" npx prisma migrate deploy
    fi
    
    echo -e "${GREEN}✅ Database $db_name reset complete${NC}"
}

# Show menu
show_menu() {
    echo ""
    echo -e "${BLUE}Select cleanup option:${NC}"
    echo "1) Truncate all tables (keep schema) - Both databases"
    echo "2) Truncate main database only"
    echo "3) Truncate test database only"
    echo "4) Drop both databases completely"
    echo "5) Drop main database only"
    echo "6) Drop test database only"
    echo "7) Reset both databases (drop, create, migrate)"
    echo "8) Reset main database only"
    echo "9) Reset test database only"
    echo "0) Exit"
    echo ""
}

# Main execution
main() {
    check_postgres
    
    while true; do
        show_menu
        read -p "Enter your choice (0-9): " choice
        
        case $choice in
            1)
                truncate_database $MAIN_DB
                truncate_database $TEST_DB
                ;;
            2)
                truncate_database $MAIN_DB
                ;;
            3)
                truncate_database $TEST_DB
                ;;
            4)
                echo -e "${RED}⚠️  WARNING: This will completely remove both databases!${NC}"
                read -p "Are you sure? (yes/no): " confirm
                if [ "$confirm" = "yes" ]; then
                    drop_database $MAIN_DB
                    drop_database $TEST_DB
                fi
                ;;
            5)
                echo -e "${RED}⚠️  WARNING: This will completely remove the main database!${NC}"
                read -p "Are you sure? (yes/no): " confirm
                if [ "$confirm" = "yes" ]; then
                    drop_database $MAIN_DB
                fi
                ;;
            6)
                echo -e "${RED}⚠️  WARNING: This will completely remove the test database!${NC}"
                read -p "Are you sure? (yes/no): " confirm
                if [ "$confirm" = "yes" ]; then
                    drop_database $TEST_DB
                fi
                ;;
            7)
                echo -e "${YELLOW}This will drop and recreate both databases with fresh schema${NC}"
                read -p "Continue? (y/n): " confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    reset_database $MAIN_DB
                    reset_database $TEST_DB
                fi
                ;;
            8)
                echo -e "${YELLOW}This will drop and recreate the main database with fresh schema${NC}"
                read -p "Continue? (y/n): " confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    reset_database $MAIN_DB
                fi
                ;;
            9)
                echo -e "${YELLOW}This will drop and recreate the test database with fresh schema${NC}"
                read -p "Continue? (y/n): " confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    reset_database $TEST_DB
                fi
                ;;
            0)
                echo -e "${GREEN}Exiting...${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Quick cleanup options via command line arguments
if [ "$1" = "--truncate" ]; then
    check_postgres
    truncate_database $MAIN_DB
    truncate_database $TEST_DB
    exit 0
elif [ "$1" = "--drop" ]; then
    check_postgres
    echo -e "${RED}⚠️  WARNING: This will drop both databases!${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        drop_database $MAIN_DB
        drop_database $TEST_DB
    fi
    exit 0
elif [ "$1" = "--reset" ]; then
    check_postgres
    reset_database $MAIN_DB
    reset_database $TEST_DB
    exit 0
elif [ "$1" = "--help" ]; then
    echo "Usage: $0 [option]"
    echo "Options:"
    echo "  --truncate    Truncate all tables in both databases"
    echo "  --drop        Drop both databases"
    echo "  --reset       Drop and recreate both databases with migrations"
    echo "  --help        Show this help message"
    echo ""
    echo "Run without options for interactive menu"
    exit 0
fi

# Run interactive menu
main