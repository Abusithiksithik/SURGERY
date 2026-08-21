-- =====================================================================
-- 01_extensions.sql
-- PostgreSQL extensions required by the Hospital Surgery Cost Intelligence schema.
-- All statements are fully idempotent (IF NOT EXISTS).
-- =====================================================================

-- uuid_generate_v4() — used as the DEFAULT for every UUID primary key.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto — provides crypt()/gen_salt('bf') used in 06_seed.sql
-- to hash the bootstrap admin password with bcrypt.
-- bcryptjs in the Node.js backend can verify pgcrypto-produced hashes
-- without any changes (both implement the same $2b$ algorithm).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
