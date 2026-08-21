# Hospital Surgery Cost Intelligence & Recommendation Engine
### Phase 1 (Database + Engine) + Phase 2 (Backend API) + Phase 3 (Frontend) — Complete

This delivers the database, the recommendation/statistics/alert engine,
a full production REST API, and now a complete React + TypeScript + MUI
frontend on top of all of it. This is an end-to-end working system.

## What's included

```
database/
  01_schema_core.sql               -- branches, departments, users, surgeons,
                                       anaesthetists, assistants, surgery types,
                                       OT rooms, patients, item catalogs
  02_schema_transactions.sql       -- surgeries fact table, assistants/consumables/
                                       pharmacy junctions, collections, triggers
  03_schema_recommendation_audit.sql -- budget_recommendations, overrides,
                                       alert_thresholds, surgery_alerts, audit_log,
                                       surgery_status_history
  04_schema_views.sql              -- v_completed_surgeries + 5 materialized views
                                       for dashboards, with a refresh function
  05_schema_functions.sql          -- fn_similar_surgeries(): weighted similarity
                                       ranking, matches the spec's 7-level priority

engine/
  statistics.js           -- mean/median/mode/min/max/stddev/variance/percentile/
                              IQR/moving average/trend analysis/forecast
  outlierDetection.js     -- IQR fence + Z-score outlier flagging (configurable)
  similarity.js           -- JS mirror of fn_similar_surgeries, for in-memory
                              ranking, testing, and admin "what-if" weight tuning
  recommendationEngine.js -- composes the above into the full per-component +
                              overall budget recommendation
  alertEngine.js          -- threshold-based Green/Yellow/Red alert evaluation
  index.js                -- module entry point

tests/                    -- 25 unit/integration tests (node --test), all passing

backend/                  -- Phase 2: full REST API (Node/Express/Prisma/PostgreSQL)
  prisma/schema.prisma    -- Prisma models mirroring the SQL schema above
  src/config/             -- env, Prisma client, logger, Swagger
  src/middleware/         -- JWT auth, RBAC, validation, centralized error handling
  src/engine/             -- same engine as above, reused unchanged
  src/modules/            -- auth, masters, surgeries, recommendations, explorer,
                              benchmarks, dashboard, alerts, reports
  src/app.js, server.js   -- Express app + entry point
  See backend/README.md for full setup instructions and endpoint map.

frontend/                 -- Phase 3: full React + TypeScript + MUI app
  src/api/                -- typed API clients + JWT-refresh axios instance
  src/theme/              -- design tokens, light/dark MUI theme
  src/auth/               -- login, protected routes, auth context
  src/layout/             -- responsive sidebar/topbar shell
  src/components/         -- reusable KpiCard, DataTable, charts, filters, etc.
  src/features/           -- Dashboard, Surgery Budget + Recommendation Panel,
                              Explorer, Benchmarks, Cost Intelligence,
                              Alert Center, Reports
  See frontend/README.md for full setup instructions and screen map.
```

Run tests: `npm test` (uses Node's built-in test runner, no dependencies needed).

## Key design decisions worth knowing about

**Only `status = 'COMPLETED'` surgeries feed statistics.** This is enforced
at the database view level (`v_completed_surgeries`), not just in
application code, so no future query can accidentally include
draft/cancelled/pending/deleted cases in a benchmark.

**Recommendations never overwrite budget fields.** `budget_recommendations`
is a separate table — a snapshot/log of what the engine suggested. The
actual `surgeries.budget_*` columns are only ever written by the user (via
the API), and `recommendation_overrides` captures every case where the
user's entered value differs from the recommendation, with a mandatory
reason — this is what powers "recommendation acceptance rate" reporting.

**Outlier handling is "either IQR or Z-score flags it, excluded by
default, but toggleable."** `partitionByOutlier()` in `outlierDetection.js`
returns both clean and outlier sets with a reason attached, and
`generateRecommendation()` takes an `excludeOutliers` flag so Admins can
re-run with outliers included.

**Similarity weights are data, not hardcoded logic.** Both the SQL
function and the JS module take weights as parameters (spec: "Allow
future weighting of these parameters"), and `budget_recommendations.similarity_weights`
stores whatever weights were used for reproducibility.

**Materialized views, not live aggregation, for dashboards.** `mv_surgeon_stats`,
`mv_surgery_type_stats`, `mv_anaesthetist_stats`, `mv_ot_stats`, and
`mv_monthly_financials` are refreshed via `fn_refresh_benchmark_views()`
(intended to be called from a scheduled job or right after a surgery is
marked completed) rather than computed on every dashboard load — this is
what makes the "100,000+ surgeries, millions of transactions" performance
target realistic.

**Forecasting uses linear regression today, with an explicit ML seam.**
`statistics.trendAnalysis()` / `forecastNext()` are the baseline. Swapping
in a real model later just means replacing the implementation of
`forecastNext` behind the same signature — nothing upstream needs to change.

## Not yet built (next phase)

- Docker Compose (one-command spin-up of Postgres + backend + frontend)
- Formal FRS/TDD documents and ER diagram image
- Background job scheduler for materialized-view refresh (the API
  exposes `POST /benchmarks/refresh` for now — wire it to a cron/queue)
- Assistants/Consumables/Pharmacy line-item editor UI on the budget page
  (API endpoints exist; see `frontend/README.md` "Known simplifications")
- E2E test suite (Cypress/Playwright)

See `backend/README.md` and `frontend/README.md` for what each phase
delivered in full, including setup steps and how the pieces connect
end-to-end (auth → recommendation flow → override tracking → alerts).

Tell me which of these to build next, or if you'd like adjustments to
what's here first.
