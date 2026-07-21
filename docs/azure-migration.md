# Hosting the Initiative Tracker on Microsoft Azure with Azure SQL Database

This document describes how to migrate the Initiative Tracker from its current Replit
environment (Node.js/Express API + React/Vite frontend + PostgreSQL) to Microsoft Azure,
using **Azure SQL Database** as the data store.

## 1. Current Architecture

| Layer | Technology | Where it lives today |
|---|---|---|
| Frontend | React 18 + Vite, TanStack Query, i18next (EN/JA) | `artifacts/initiative-tracker` |
| API | Node.js + Express, Zod validation, pino logging | `artifacts/api-server` |
| Contract | OpenAPI spec → Orval-generated client + Zod schemas | `lib/api-spec`, `lib/api-client-react`, `lib/api-zod` |
| ORM / schema | Drizzle ORM (`drizzle-orm/node-postgres`) | `lib/db` |
| Database | PostgreSQL (Replit-managed, `DATABASE_URL`) | Replit |

## 2. Target Azure Architecture

```
Browser
   │
   ▼
Azure Static Web Apps  ──(linked /api backend)──►  Azure App Service (Node.js API)
   (React/Vite build)                                     │
                                                          ▼
                                              Azure SQL Database (serverless tier)
                                                          ▲
                        Azure Key Vault ── secrets ───────┘
                        Application Insights ── logs/metrics for both apps
```

### Recommended services

| Concern | Azure service | Notes |
|---|---|---|
| Frontend hosting | **Azure Static Web Apps** (Standard) | Global CDN, free TLS, custom domains; alternatively serve the built SPA from App Service. |
| API hosting | **Azure App Service** (Linux, Node 20 LTS, B1/P0v3) | Or Azure Container Apps if containerizing. |
| Database | **Azure SQL Database** (General Purpose, serverless) | Auto-pause and per-second billing fit an internal tracker's usage pattern. |
| Secrets | **Azure Key Vault** + App Service Key Vault references | Replaces Replit secrets. |
| Identity | **Microsoft Entra ID (managed identity)** | App Service connects to SQL without passwords. |
| Observability | **Application Insights** | Wire pino to console; App Service log stream + auto-instrumentation. |
| CI/CD | **GitHub Actions** | Repo is already on GitHub (`mwpetroff/initiative-tracker-app`). |

## 3. Database Migration: PostgreSQL → Azure SQL (T-SQL)

This is the largest work item. Azure SQL is SQL Server, not PostgreSQL, so both the
schema dialect and the ORM driver must change.

### 3.1 Keep Drizzle, switch dialects

Drizzle ORM supports SQL Server via community adapters only; the mature paths are:

- **Option A (recommended): stay on PostgreSQL semantics with the `node-mssql` rewrite.**
  Rewrite `lib/db` to use `drizzle-orm` with the `mssql` driver is *not* officially
  supported — so in practice choose one of:
  - **Option A1: Azure Database for PostgreSQL – Flexible Server.** Zero code changes
    (`DATABASE_URL` swap only). Choose this if "Azure hosting" is the hard requirement
    and "Azure SQL" is negotiable.
  - **Option A2: Prisma or TypeORM with the `sqlserver` provider.** Both officially
    support Azure SQL. Port `lib/db/src/schema/*` (7 tables) to the new ORM's schema
    format and regenerate migrations.
- **Option B: raw `mssql` (tedious) driver + hand-written queries.** Not recommended;
  the codebase currently leans on Drizzle's type inference.

> **Recommendation:** if Azure SQL is mandatory, use **Prisma + `sqlserver`**. The
> route handlers only use straightforward CRUD, joins, and one transaction
> (status-history insert), all of which Prisma supports on SQL Server.

### 3.2 Schema translation notes (PostgreSQL → T-SQL)

| PostgreSQL construct in `lib/db` | Azure SQL equivalent |
|---|---|
| `serial` primary keys | `INT IDENTITY(1,1)` |
| `timestamp with time zone` | `datetimeoffset` |
| `boolean` (e.g. `dependencies.resolved`) | `BIT` |
| `text` | `NVARCHAR(MAX)` (use `NVARCHAR(n)` where bounded) — **must be `N`-prefixed types to preserve Japanese text** |
| `ON DELETE CASCADE` FKs (initiative → updates/history/dependencies) | Supported as-is |
| Unique constraints (`<table>_<column>_unique`) | Supported; keep the same names |
| `now()` defaults | `SYSDATETIMEOFFSET()` |

**Important:** all string columns must be `NVARCHAR`, and inserts must use Unicode
parameters — the app is bilingual and stores Japanese department names, initiative
titles, and narrative updates.

### 3.3 Data migration

1. Freeze writes; export data from PostgreSQL (`pg_dump --data-only --column-inserts`
   or CSV per table via `\copy`).
2. Create the Azure SQL schema via the new ORM's migration tool
   (`prisma migrate deploy`).
3. Load data in FK order (departments → risk_categories → settings → initiatives →
   dependencies → initiative_history → initiative_updates) using `bcp`,
   Azure Data Studio import, or a one-off Node script; enable `SET IDENTITY_INSERT`
   per table so existing IDs (and FK references) are preserved.
4. Reseed identities: `DBCC CHECKIDENT ('dbo.initiatives', RESEED)` for each table.
5. Validate row counts and spot-check Japanese text round-trips correctly.

### 3.4 Behavioral differences to re-verify

- **Error codes:** the API maps PostgreSQL error codes (`23505` unique violation,
  `23503` FK violation, surfaced at `err.cause.code`) to HTTP 409. SQL Server raises
  error numbers **2627/2601** (unique) and **547** (FK) instead — update
  `artifacts/api-server/src/lib/db-errors.ts` and re-run the contract tests.
- **Case-insensitive matching:** Azure SQL default collation is case-insensitive
  (unlike PostgreSQL). Review name-uniqueness expectations and the contract tests.
- **`returning()` clauses:** Drizzle's `.returning()` becomes Prisma's returned
  entity (or T-SQL `OUTPUT INSERTED.*`).
- **Ordering of Japanese text** is done client-side (`Intl.Collator`), so no DB
  collation work is needed for sorting.

## 4. API Changes (`artifacts/api-server`)

1. **Configuration:** replace `DATABASE_URL` (single connection string) with either an
   Azure SQL connection string in Key Vault or, preferably, **managed identity**
   authentication (`Authentication=Active Directory Default` via
   `@azure/identity` + `mssql`/Prisma's `sqlserver` connector).
2. **Port binding:** App Service injects `PORT` (or `WEBSITES_PORT`); the server
   already reads `process.env.PORT` — verify only.
3. **CORS:** today CORS is wide open for the Replit preview. On Azure, either
   serve the SPA and API from the same origin (Static Web Apps *linked backend*
   makes `/api/*` same-origin, so CORS can be removed) or restrict `cors()` to the
   Static Web App hostname.
4. **Logging:** pino already writes structured JSON to stdout; App Service +
   Application Insights collect it. Remove the pino-pretty dev transport in
   production builds (already gated by `NODE_ENV`).
5. **Health endpoint:** `GET /healthz` already exists (`artifacts/api-server/src/routes/health.ts`) — point App Service health checks at it.

## 5. Frontend Changes (`artifacts/initiative-tracker`)

1. **Base URL:** the Orval client's `setBaseUrl(...)` currently points at the
   Replit path-based proxy. On Azure set it to `/api` (same origin via Static Web
   Apps linked backend) driven by `import.meta.env.VITE_API_BASE_URL`.
2. **Build:** `pnpm --filter @workspace/initiative-tracker build` produces static
   assets (`dist/`) that Static Web Apps deploys directly.
3. **SPA fallback:** add `staticwebapp.config.json` with a navigation fallback to
   `index.html` so client-side routes (wouter) deep-link correctly.

## 6. CI/CD with GitHub Actions

The repository already lives on GitHub, so wire two workflows:

```yaml
# .github/workflows/deploy.yml (sketch)
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r test          # api contract tests need a SQL instance (see note)
  deploy-api:
    needs: test
    steps:
      - uses: azure/webapps-deploy@v3   # deploys artifacts/api-server build output
  deploy-web:
    needs: test
    steps:
      - uses: Azure/static-web-apps-deploy@v1  # deploys artifacts/initiative-tracker/dist
```

> **Testing note:** the contract tests currently run against a live PostgreSQL dev
> database. In CI, run them against a SQL Server service container
> (`mcr.microsoft.com/mssql/server:2022-latest`) after the ORM migration, or an
> Azure SQL dev database.

Store deployment credentials as GitHub OIDC federated credentials (no long-lived
publish profiles).

## 7. Security & Operations Checklist

- [ ] Azure SQL firewall: allow only Azure services / App Service outbound IPs, or use Private Endpoint + VNet integration.
- [ ] Managed identity for App Service → SQL (no passwords in config).
- [ ] Key Vault references for any remaining secrets.
- [ ] Enable Azure SQL automated backups (default PITR 7–35 days) and geo-redundancy if required.
- [ ] Application Insights alerts on 5xx rate and response time.
- [ ] Custom domain + TLS on Static Web Apps.
- [ ] Add authentication (e.g. Entra ID via Static Web Apps built-in auth) — the app currently has no login and would otherwise be public.

## 8. Suggested Migration Order

1. Stand up Azure SQL (serverless) + Key Vault + App Service + Static Web App (IaC via Bicep or Terraform).
2. Port `lib/db` to Prisma `sqlserver`; update `db-errors.ts` for SQL Server error numbers; run the full API contract test suite (`pnpm --filter @workspace/api-server test`) against a local SQL Server container.
3. Migrate data (Section 3.3) into a staging Azure SQL database and re-run tests against it.
4. Deploy API to App Service; smoke-test with `curl` against `/api/*`.
5. Deploy frontend to Static Web Apps with linked backend; verify EN/JA flows end-to-end.
6. Set up GitHub Actions deployment, cut over DNS, freeze + re-sync production data, go live.

### Effort estimate

| Work item | Rough effort |
|---|---|
| ORM port (Drizzle → Prisma/sqlserver) + error-code mapping | 2–3 days |
| Data migration scripts + validation | 1 day |
| Azure infrastructure (Bicep/Terraform) | 1–2 days |
| CI/CD pipelines | 0.5–1 day |
| Auth (Entra ID) if required | 1–2 days |

**Alternative:** if the goal is simply "run on Azure," using **Azure Database for
PostgreSQL – Flexible Server** instead of Azure SQL reduces the whole migration to
hosting + configuration (no ORM or SQL dialect changes) — roughly 2 days total.
