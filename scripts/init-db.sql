-- SQL script to initialize databases when using Docker
-- This runs automatically when the PostgreSQL container starts for the first time

-- Create test database
CREATE DATABASE umi_test;

-- Grant all privileges to postgres user (already has them by default, but being explicit)
GRANT ALL PRIVILEGES ON DATABASE umi_backend TO postgres;
GRANT ALL PRIVILEGES ON DATABASE umi_test TO postgres;