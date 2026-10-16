# Hospital Surgery Cost Intelligence API

## Requirements
- Node.js 18+
- PostgreSQL 14+

## Local setup
1. Copy `.env.example` to `.env` and set a local PostgreSQL URL, JWT secrets, and a non-default admin password.
2. Run `npm ci` in `backend/`.
3. Create the target database (or configure `DATABASE_URL` to a role permitted to create it).
4. Run `npm run dev` for development or `npm start` to start the API.

The backend bootstraps the database using the ordered, idempotent SQL files in `database/split/`. `src/db/initializeDatabase.js` registers the SQL files in `SCHEMA_FILES`; the legacy seed file is `06_seed.sql`. No Prisma schema or Prisma migration is used.

## Tests
Run `npm test` in `backend/`. The server validates production secrets before database initialization. Production requires explicit `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`; both JWT secrets must be at least 32 characters and must not be example/development values. Default admin passwords are rejected in production.

## Security
- Never commit `.env`, database dumps, patient data, uploads, logs, or build output.
- Keep `.env.example` free of real credentials.
- Rotate any credentials that have been exposed.
- Run on a private test database before any production deployment.
