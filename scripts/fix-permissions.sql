-- SQL script to fix permissions for umi_user
-- Run this as a PostgreSQL admin user if the Node.js script doesn't work

-- Fix permissions for umi_backend database
\c umi_backend

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO umi_user;
GRANT USAGE, CREATE ON SCHEMA public TO umi_user;

-- Grant permissions on existing objects
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO umi_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO umi_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO umi_user;

-- Grant permissions on future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO umi_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO umi_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO umi_user;

-- Fix permissions for umi_test database
\c umi_test

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO umi_user;
GRANT USAGE, CREATE ON SCHEMA public TO umi_user;

-- Grant permissions on existing objects
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO umi_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO umi_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO umi_user;

-- Grant permissions on future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO umi_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO umi_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO umi_user;

-- Verify permissions
\c umi_backend
\dt
\dp

\c umi_test
\dt
\dp

\echo 'Permissions fixed! umi_user now has full access to both databases.'