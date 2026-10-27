-- Initialization script for Pollwise isolated databases and least-privilege roles
-- Executed on fresh PostgreSQL container startup

-- 1. Create databases
CREATE DATABASE identity_db;
CREATE DATABASE election_db;
CREATE DATABASE ballot_db;

-- 2. Create isolated database roles with distinct least-privilege credentials
CREATE ROLE identity_user WITH LOGIN PASSWORD 'identity_pass';
CREATE ROLE election_user WITH LOGIN PASSWORD 'election_pass';
CREATE ROLE ballot_user WITH LOGIN PASSWORD 'ballot_pass';
CREATE ROLE tally_ro_user WITH LOGIN PASSWORD 'tally_ro_pass';

-- 3. Grant database connection permissions
GRANT ALL PRIVILEGES ON DATABASE identity_db TO identity_user;
GRANT ALL PRIVILEGES ON DATABASE election_db TO election_user;
GRANT ALL PRIVILEGES ON DATABASE ballot_db TO ballot_user;

-- Grant tally user read-only access to ballot_db
GRANT CONNECT ON DATABASE ballot_db TO tally_ro_user;
