# Surgery Cost Intelligence — Frontend (Phase 3)

React + TypeScript + Material UI frontend for the Hospital Surgery Cost
Intelligence & Recommendation Engine, built on top of the Phase 2 REST API.

## Stack

- **React 18 + TypeScript + Vite**
- **Material UI v5** — component library, light/dark theme
- **TanStack Query** — server state, caching, refetching
- **TanStack Table** — sortable/paginated data tables
- **Recharts** — trend lines, bar comparisons, donut breakdowns
- **React Router v6** — routing, protected routes, role gating
- **Axios** — API client with automatic JWT refresh-on-401

## Design direction

A "clinical precision" visual language: deep slate-blue navigation,
a teal accent reserved for positive financial signals, and amber/red used
*only* for the alert severity system (never reused elsewhere, so color
always means alert). Tabular numerals (IBM Plex Mono) on every currency
figure so costs align at a glance in tables and cards. The signature
element is the **Recommendation Panel's confidence meter** — a sample-size-driven
visual bar that tells a Finance user at a glance whether a recommendation
rests on 40 similar cases or 2, something no other hospital ERP surfaces
this directly.

See `src/theme/tokens.ts` for the full palette/typography token set.

## Folder structure

```
frontend/src/
  api/            -- typed API clients (auth, surgeries, recommendations,
                     explorer, benchmarks, dashboard, alerts, reports, masters)
                     + client.ts (axios instance with JWT refresh interceptor)
  theme/          -- design tokens, MUI theme (light/dark), dark-mode context
  auth/           -- AuthContext, ProtectedRoute, LoginPage
  layout/         -- AppLayout (responsive shell), Sidebar, Topbar, nav config
  components/
    common/       -- KpiCard, DataTable, FilterBar, StatusChip/SeverityChip,
                     PageHeader, SectionCard, ExportMenu, ConfirmDialog,
                     AsyncStates (loading/empty/error)
    charts/       -- TrendLineChart, BarComparisonChart, DonutBreakdownChart,
                     MiniSparkline (all Recharts, theme-aware)
  hooks/          -- useMasterData (cached surgeon/type/anaesthetist/etc lookups)
  features/
    dashboard/          -- Hospital Dashboard (screen 1)
    surgeryBudget/       -- Surgery list + budget form + Recommendation Panel (screens 2-3)
    explorer/             -- Similar Surgery Explorer + compare drawer (screen 4)
    benchmarks/            -- Benchmark Dashboard, 4 tabs (screen 5)
    costIntelligence/       -- Cost Intelligence Dashboard (screen 6)
    alerts/                   -- Alert Center + threshold config (screen 7)
    reports/                    -- Reports / export center (screen 8)
  App.tsx, main.tsx              -- routes, providers
```

Charts (9) and Filters (10) aren't separate screens — they're the reusable
`components/charts/*` and `components/common/FilterBar` used throughout
screens 1, 5, 6. Responsive Layout (11) is `layout/AppLayout.tsx` (persistent
sidebar ≥900px, temporary drawer below). Dark Mode (12) is
`theme/ThemeModeContext.tsx`, toggled from the top bar, persisted to
`localStorage`.

## Setup & run

Requires the Phase 2 backend running first (see `../backend/README.md`).

```bash
cd frontend
cp .env.example .env.local     # point VITE_API_BASE_URL at your backend
npm install
npm run dev
```

Opens on **http://localhost:5173**. Log in with the seeded admin
(`admin` / `Admin@12345`, or whatever you changed it to).

`vite.config.ts` also proxies `/api` to `http://localhost:4000` by default,
so if you'd rather not set `VITE_API_BASE_URL` at all, requests to `/api/v1/...`
will reach the backend automatically during `npm run dev`.

### Production build

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally to sanity-check it
```

## How the pieces fit together

- **Auth**: `AuthContext` bootstraps from a stored access token on load
  (`GET /auth/me`), and `client.ts`'s response interceptor automatically
  calls `/auth/refresh` on a 401 and retries the original request once —
  the rest of the app never has to think about token expiry.
- **Recommendation flow**: `SurgeryBudgetPage` calls `/recommendations/preview`
  (new surgery) or `/recommendations/surgery/:id` (existing surgery) whenever
  surgeon + surgery type are selected, and renders the result through
  `RecommendationPanel`. "Apply all" or per-field "Apply" buttons write
  straight into the budget form state — nothing is saved until the user
  clicks Save.
- **Override reasons**: if `PUT /surgeries/:id` returns a 400 with
  `details.field` (backend detected a budget value differs from the last
  recommendation), the page opens `OverrideReasonDialog`, captures a reason,
  and resubmits with `overrideReasons.<field>` — matching the backend's
  override-tracking contract exactly.
- **Outlier toggle**: the switch in `RecommendationPanel` flips
  `excludeOutliers`, which is part of the React Query key, so toggling it
  refetches the recommendation with/without outliers automatically.
- **Alerts**: the bell icon in the top bar polls
  `GET /alerts?isAcknowledged=false&severity=RED` every 60s for a live badge count.

## Known simplifications (documented, not hidden)

- The Reports page's "Print" affordance opens the exported PDF via the
  browser rather than a dedicated print stylesheet — matching the backend's
  actual `/reports/dashboard.pdf` capability rather than promising a feature
  the API doesn't have.
- Assistants/consumables/pharmacy line-item editing (spec: "Assistants",
  "Consumables" as sub-entities of a surgery) is wired in the API layer
  (`surgeries.api.ts`) but not yet given its own UI section on the budget
  page — the backend endpoints (`POST /surgeries/:id/assistants` etc.) are
  ready to wire up next.
- No offline/service-worker support; this is an internal ERP tool assumed
  to run on the hospital network.

## Not yet built

- Assistants/Consumables/Pharmacy line-item editor UI (see above)
- Dedicated print stylesheet (separate from the PDF export)
- E2E tests (Cypress/Playwright) against a running backend
