# Hospital Surgery Cost Intelligence & Recommendation Engine

React + TypeScript + MUI frontend, Node.js/Express API, PostgreSQL database and recommendation engine.

## Project layout

- `backend/` — Express API, JWT authentication, permission middleware, SQL schema bootstrap and tests.
- `backend/database/split/` — ordered SQL bootstrap/migrations. Sprint 0/Sprint 1 additions are `18_roles_permissions.sql` through `26_surgery_number.sql`.
- `backend/scripts/import-items.js` — re-runnable item-master importer with a dry-run mode; it never imports opening stock.
- `frontend/` — React/Vite application.
- `engine/` — recommendation, statistics, similarity, outlier and alert logic.

## Local setup

1. Install Node.js 18+ and PostgreSQL 14+.
2. In `backend/`, copy `.env.example` to `.env` and replace all placeholders with local development values.
3. Run `npm ci` in both `backend/` and `frontend/`.
4. Start the API with `npm run dev` in `backend/` and the UI with `npm run dev` in `frontend/`.
5. The backend applies ordered SQL files in `database/split/` during startup unless `SKIP_DB_INIT=true`.

Never commit `.env`, production credentials, patient data, database dumps, uploaded files or build output. Rotate credentials that have been exposed. Production requires explicit database and JWT secrets; JWT secrets must each be at least 32 characters and must not be example/development values. Default or placeholder admin passwords are rejected in production.

## Item import

Run a non-mutating preview against the configured database:

```bash
cd backend
npm run import:items -- /path/to/masters-workbook.xlsx --dry-run
```

Review new items, exact duplicates and the manual-review list before running without `--dry-run`. Opening stock is intentionally excluded. The source workbook was not included in the supplied project archive, so the importer has not been run against the hospital's actual workbook yet.

## Tests

- Backend security and migration-registration tests: `cd backend && npm test`.
- Frontend TypeScript check: `cd frontend && npx tsc -b`.
- The full Vite bundle should also be built on the target Windows/dev environment. The supplied dependency snapshot lacks Rollup's Linux optional binary, so a Vite bundle could not be produced in this validation environment.

See `IMPLEMENTATION_STATUS.md` for implemented changes and items requiring staging/infrastructure validation.


## App user password fix (2026-10-15)
- Internal hospital emails such as `management1@hospital.local` are accepted by app-user validation.
- Editing an app user now updates the password hash when a new password (6–100 characters) is supplied; leaving the field blank keeps the current password.
- The password input is masked and short passwords show a validation message before save.
- Backend test suite: 13/13 passed in the provided environment. Frontend production build could not be re-verified in this Linux environment because the installed Rollup native binary was missing; run `npm ci` in `frontend` on the target machine before testing the build.

## Management user login troubleshooting

If an existing App User is active but cannot sign in after an admin password update, reset the password through the backend's configured database using the interactive helper (it does not print or save the password):

```powershell
cd backend
node scripts/reset-app-user-password.js management1
```

The script uses `backend/.env` `DATABASE_URL`, verifies that the user exists and is active, asks for the new password twice, enforces 6–100 characters, hashes it with bcrypt, and updates only that user's `password_hash`. Confirm `DATABASE_URL` points to the intended database before running it. Do not run this against production without authorization.
