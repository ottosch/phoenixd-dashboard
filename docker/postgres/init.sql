-- This script runs on PostgreSQL first initialization
-- It ensures the database exists even if there are connection attempts before full init

-- The database is created by POSTGRES_DB environment variable,
-- but this script ensures tables can be created properly

-- Enable extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'PostgreSQL initialization complete';
END $$;
