# Surgery Cost Intelligence — Backend (Phase 2)

Production Node.js + Express + Prisma + PostgreSQL backend for the
Hospital Surgery Cost Intelligence & Recommendation Engine. Built on top
of the Phase 1 recommendation engine. **Prisma's `schema.prisma` is the
single source of truth for the database schema** — there is no raw SQL
for tables/columns anywhere in this project; `npm start` alone builds
the entire database from scratch on a fresh clone.

## Stack

- **Node.js 18+ / Express** — REST API
- **Prisma Client + `prisma db push`** — schema-first ORM, no migration files
- **JWT** (access + refresh tokens) — authentication
- **Joi** — request validation
- **swagger-jsdoc + swagger-ui-express** — live OpenAPI docs at `/api-docs`
- **exceljs / pdfkit** — Excel, CSV, PDF export
- **helmet / cors / express-rate-limit / compression** — hardening

## Folder structure

```
backend/
  prisma/
    schema.prisma       -- the source of truth for every table/column
    seed.js              -- optional legacy seed script (see note below)
  database/sql/
    views_and_functions.sql -- the one piece of schema Prisma can't
                                express (views, materialized views,
                                the similarity-matching function) —
                                applied automatically, idempotently
  src/
    bootstrap/
      ensureEnvFile.js         -- creates .env from .env.example if missing
    config/               -- env, prisma client singleton, logger, swagger
    constants/             -- roles/permission groups
    middleware/             -- auth, rbac, validation, error handling
    utils/                    -- ApiError, ApiResponse, pagination, asyncHandler
    db/                        -- the automatic startup bootstrap (see below)
    engine/                      -- statistics/outlier/similarity/recommendation/alert
                                    engine (ported unchanged from Phase 1)
    modules/
      auth/                      -- register, login, refresh, change password
      masters/                    -- surgeons, surgery types, anaesthetists,
                                      assistants, OT rooms, branches, departments, patients
      surgeries/                   -- surgery CRUD, budget/actual entry, status
                                       lifecycle, assistants/consumables/pharmacy/
                                       collections, computeDerivedFields.js
      recommendations/               -- the recommendation engine API
      explorer/                       -- Similar Surgery Explorer
      benchmarks/                      -- Surgeon/Surgery/Anaesthetist/OT dashboards
      dashboard/                        -- hospital-wide KPIs, top-N, comparisons, forecast
      alerts/                            -- alert evaluation + thresholds
      reports/                            -- Excel/CSV/PDF export
    routes/index.js                       -- mounts all module routers
    app.js                                  -- Express app (middleware + routes)
    server.js                                -- entry point, runs the bootstrap, graceful shutdown
```

## IMPORTANT: how Prisma is used here

`prisma/schema.prisma` is the actual source of truth — the database is
built by `prisma db push`, **never `prisma migrate`**. Two consequences
worth knowing about:

1. **No STORED generated columns.** Postgres's `GENERATED ALWAYS AS ...
   STORED` (used in an earlier iteration of this schema for
   `budgetTotal`, `actualTotal`, `profitAmount`, `durationMinutes`, and
   the two line-item `totalCost` fields) can't be expressed in
   `schema.prisma`. Those are now ordinary writable columns, and the
   application computes them instead — see
   `src/modules/surgeries/computeDerivedFields.js`, called from
   `surgeries.service.js` on every create/update. If you're modifying
   surgery cost logic, that file — not the database — is where the
   totals get computed.
2. **Primary keys use Prisma's own `uuid()`**, not a Postgres extension
   function, so `prisma db push` alone is enough to build the schema in
   a brand-new database — no `CREATE EXTENSION` step needed anywhere.
3. Materialized views (`mv_surgeon_stats`, etc.) and the
   `fn_similar_surgeries()` function are **not** modeled in
   `schema.prisma` — Prisma has no native concept of either. They're
   created by `database/sql/views_and_functions.sql`, applied
   automatically by `src/db/applyViewsAndFunctions.js` right after
   `db push`. Every statement in that file is `CREATE OR REPLACE` /
   `IF NOT EXISTS`, so it's safe to re-run on every startup — no
   separate tracking table needed for it.

## Setup & run

A fresh clone needs exactly two commands — no pgAdmin, no manually running `.sql` files, no separate migrate step, not even a manually-created `.env`:

```bash
cd backend
npm install
npm start
```

That's it, provided a PostgreSQL **server** is running and reachable (locally: `postgres` installed and started — that one piece, "a running Postgres server exists," isn't something `npm install` can do for you; everything after it is automatic).

What happens automatically on `npm start`, in order, with the console printing a checkmark as each stage genuinely completes:

1. **`.env` is created from `.env.example` if it doesn't exist yet** (`src/bootstrap/ensureEnvFile.js`) — runs before anything else, so even skipping the usual "cp .env.example .env" step works.
2. The server checks whether the target database exists on your Postgres server, and creates it if not → **`✓ Database Connected`**
3. Runs `prisma generate`, then `prisma db push --accept-data-loss --skip-generate` — building every table, column, index, and constraint directly from `prisma/schema.prisma` → **`✓ Prisma Schema Synced`**
   (views/materialized views/the similarity function are applied right after this, silently unless something fails)
4. Creates the default admin user via Prisma Client, only if a user with that username doesn't already exist → **`✓ Default Admin Created`**
5. Starts the Express server → **`✓ Server Running`**

If any step fails — Postgres unreachable, a bad schema change, etc. — you get a clearly formatted error block in the console and the process exits with a non-zero code. The API is never left half-initialized.

**Idempotency**: every one of these steps is safe to run any number of times. `prisma db push` only changes what's actually different from the live schema (a no-op if nothing changed); `views_and_functions.sql` is pure `CREATE OR REPLACE`/`IF NOT EXISTS`; the admin-creation step does a plain existence check, not an upsert, so it will never reset the admin's password on a later boot. Restarting the server, redeploying, or running `npm start` five times in a row all behave identically to running it once.

Want to skip the auto-init entirely (e.g. CI, or a DB provisioned some other way)? Set `SKIP_DB_INIT=true` in `.env`.

Once running, open **http://localhost:4000/api-docs** for interactive Swagger docs.

Default admin login (created automatically, configurable via `ADMIN_USERNAME`/`ADMIN_PASSWORD`/etc. in `.env`): `username: admin`, `password: 12345` — **change it immediately** via `POST /api/v1/auth/change-password`.

`npm run seed` (the old `prisma/seed.js`, using Prisma Client to add a sample branch/department alongside an admin user) still exists and is entirely optional — the automatic bootstrap already creates a working admin login on its own.

## Auth flow

1. `POST /api/v1/auth/login` → `{ accessToken, refreshToken, user }`
2. Send `Authorization: Bearer <accessToken>` on every other request.
3. When the access token expires (15 min default), call
   `POST /api/v1/auth/refresh` with the refresh token to get a new pair.

## Roles

`ADMIN`, `FINANCE`, `MANAGEMENT`, `SURGEON`, `OT_COORDINATOR`, `VIEWER`.
Write access to budgets is `ADMIN | FINANCE | OT_COORDINATOR`
(`ROLE_GROUPS.BUDGET_WRITERS`); financial exports and acceptance-rate
reporting require `FINANCE`/`MANAGEMENT`/`ADMIN`; master-data writes and
threshold configuration are `ADMIN` only. See `src/constants/roles.js`.

## Endpoint map (full list is in Swagger)

| Area | Base path | Highlights |
|---|---|---|
| Auth | `/auth` | register, login, refresh, change-password, me |
| Masters | `/masters` | surgeons, surgery-types, anaesthetists, assistants, ot-rooms, branches, departments (list/get/create/update/deactivate) |
| Surgeries | `/surgeries` | CRUD, `/status` transitions, `/assistants`, `/consumables`, `/pharmacy`, `/collections` |
| Recommendations | `/recommendations` | `/preview` (no surgery needed), `/surgery/:id` (generate+persist / history), `/acceptance-rate` |
| Explorer | `/explorer` | `/search` (similarity + filters + sort + pagination), `/compare` |
| Benchmarks | `/benchmarks` | `/surgeons`, `/surgery-types`, `/anaesthetists`, `/ot`, `/refresh` |
| Dashboard | `/dashboard` | `/summary`, `/top-profitable`, `/lowest-margin`, `/highest-ot-cost`, `/highest-assistant-cost`, `/highest-consumables`, `/department-comparison`, `/branch-comparison`, `/doctor-comparison`, `/forecast` |
| Alerts | `/alerts` | `/surgery/:id/evaluate`, list, `/:id/acknowledge`, `/thresholds` |
| Reports | `/reports` | `/surgeries` (xlsx/csv), `/dashboard.pdf` |

## Key business rules enforced in code

- **Recommendations never overwrite budget fields.** `PUT /surgeries/:id`
  compares any changed `budget*` field against the surgery's latest
  stored recommendation; if it differs, the request is rejected (400)
  unless `overrideReasons.<field>` is supplied — which is then logged to
  `recommendation_overrides` for acceptance-rate reporting
  (`GET /recommendations/acceptance-rate`).
- **Completed surgeries are financially locked** — `PUT /surgeries/:id`
  rejects any edit once `status = COMPLETED`.
- **Status transitions are validated server-side** against an explicit
  allowed-transition map (`surgeries.service.js`), and marking a surgery
  `COMPLETED` requires actual cost fields to be populated first.
- **Outlier handling is toggleable per request**, not baked into the
  data: `fetchSimilarCandidates()` always pulls candidates with
  `p_include_outliers = TRUE` from the DB, and the JS-side
  `excludeOutliers` flag controls filtering — so a single DB round-trip
  serves both views.
- **Benchmarks are read from materialized views**, not computed live,
  to hold up at 100k+ surgeries. Call `POST /benchmarks/refresh` (Admin)
  after bulk data loads, or wire `fn_refresh_benchmark_views()` into a
  scheduled job.

## Troubleshooting: `prisma generate` fails with a 403 from binaries.prisma.sh

`prisma generate` (and `prisma validate`/`prisma format`) needs to download a
platform-specific query engine binary from `binaries.prisma.sh` the first
time it runs for a given Prisma version. If your network blocks that host —
a corporate proxy/firewall, a VPN with an allowlist, or security software
that intercepts unrecognized binary downloads — you'll see something like:

```
Error: Failed to fetch sha256 checksum at https://binaries.prisma.sh/... - 403 Forbidden
```

This is **not** a problem with this project's schema, code, or Prisma/Postgres
version pinning — it's your machine's network reaching (or not reaching)
Prisma's own CDN. A few things worth checking, in order:

1. **Are you behind a corporate proxy?** Make sure `HTTP_PROXY`/`HTTPS_PROXY`
   (and `NO_PROXY` if needed) are set in your shell/environment so both `npm`
   and the Prisma CLI's own outbound requests go through it.
2. **Is `binaries.prisma.sh` explicitly allowed** through your firewall/VPN/
   antivirus? Corporate security tools sometimes block unfamiliar binary
   download domains even when `registry.npmjs.org` is allowed — this project
   needs both.
3. **Working from a folder synced by OneDrive (or Dropbox/Google Drive)?**
   This isn't the same failure as the 403 above, but it's a related and very
   common source of Prisma/`node_modules` breakage on Windows: the sync
   client can lock a file mid-write (`EPERM`/`EBUSY`), or the fully-qualified
   path can exceed Windows' `MAX_PATH` (especially likely with a nested
   `OneDrive - Company Name\...\node_modules\...` path plus Prisma's own
   nested engine folders). The safest fix, with **no application code
   changes**: work from a path outside any cloud-synced folder (e.g.
   `C:\dev\surgery-intelligence` instead of somewhere under
   `OneDrive - ...\`), or at minimum right-click the project folder in
   Explorer → OneDrive → "Always keep on this device" so it's never a
   sync placeholder mid-download while npm/Prisma are writing to it.
4. As a last resort **for local development only**, `prisma generate` can
   skip the checksum step with `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`
   set in your shell before running it (this is Prisma's own documented
   escape hatch, not something this project enables by default — enabling
   it unconditionally would silently skip integrity verification of a
   downloaded binary, which shouldn't be the default behavior).

Once `prisma generate` can reach `binaries.prisma.sh` successfully, `npm
start`'s automatic bootstrap (see "Setup & run" above) handles everything
else the same way regardless of what was blocking it.

## Not yet built (next phase)

- Docker Compose + deployment guide
- Formal integration test suite against a live database (unit tests for
  the engine already exist from Phase 1 and are reused unchanged here)
- Background job runner for scheduled materialized-view refresh
- Assistants/Consumables/Pharmacy line-item editor UI on the frontend's
  budget page (the API endpoints above are ready; see `frontend/README.md`)

The React + TypeScript + MUI frontend (Phase 3) already exists — see
`../frontend/README.md`.
