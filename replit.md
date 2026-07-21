# Initiative Tracker

A web app for tracking company initiatives across departments — status, priority, progress, cross-team dependencies, and quarterly goals — with a visual risk heatmap and Excel export for reporting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/initiative-tracker run dev` — run the frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm -r --filter "./artifacts/**" --if-present run test` — run all Vitest suites (api-server contract tests + frontend unit tests)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, wouter (routing), TanStack Query, react-hook-form + zod, shadcn/ui (Radix + Tailwind)
- Excel export: exceljs

## Where things live

- `artifacts/api-server` — Express API (`src/routes/*` — one file per resource: departments, initiatives, milestones, dependencies, risk-categories, insights, settings, health; registered in `src/routes/index.ts` under `/api`). Contract tests are colocated as `src/routes/*.test.ts`.
- `artifacts/initiative-tracker` — React + Vite frontend (the main web app, previewPath `/`)
  - `src/pages` — one file per route: dashboard, initiatives, heatmap, quarterly-goals, settings (hosts Departments & Risk Categories as tabs)
  - `src/components` — dialogs (initiative/department/risk-category/dependency forms, initiative detail), `milestone-section.tsx`, and shared UI primitives (`components/ui`)
  - `src/i18n/locales/{en,ja}.json` — all UI strings; a key-coverage test enforces EN/JA parity
- Shared workspace packages (`lib/`):
  - `lib/db` (`@workspace/db`) — Drizzle schema (`src/schema/*.ts`, one file per table) + client; `drizzle-kit push` for dev schema sync
  - `lib/api-spec` (`@workspace/api-spec`) — `openapi.yaml`, the single source of truth for the API contract; `run codegen` regenerates the two packages below
  - `lib/api-zod` (`@workspace/api-zod`) — generated Zod schemas, used by the server to validate params/bodies
  - `lib/api-client-react` (`@workspace/api-client-react`) — generated typed React Query hooks + TS types, used by the frontend
- **Change flow for any API change:** edit `lib/db` schema (+ `push`) → edit `openapi.yaml` → run codegen → implement/adjust the Express route (validate with `@workspace/api-zod`) → consume via generated hooks on the frontend → add/update contract tests and EN/JA i18n keys.

## Product

- **Bilingual (EN/日本語)** — full i18n via i18next: all pages, dialogs, toasts, validation messages, dates/quarters, and Excel export labels are translated. Language switcher lives in the sidebar (desktop) and header (mobile); persisted in localStorage and as a company-wide default in Settings. Lists (departments, risk categories, heatmap rows/columns, dropdowns) sort by the localized display name (`compareLocalized`/`sortByLocalizedName` in `src/lib/localized-name.ts`).
- **Department hierarchy** — departments can have one level of sub-departments (`parentId`). API enforces: parent must exist, no self-parent, max one level deep, and a department with children cannot itself get a parent (400 errors from `validateParent` in `routes/departments.ts`). UI shows children indented under parents; dashboard/filters aggregate parent + children.
- **Dashboard** — high-level summary of initiative status and department breakdowns (clickable — navigates to filtered Initiatives). Includes an "Overdue" stat card (initiatives past target date and not completed), a "High Risk Dependencies" card (excludes resolved dependencies), and a "Recent Activity" feed merging three sources — status changes from `initiative_history` ("old → new" badges), initiative creations, and posted narrative updates (120-char summary) — newest first, limit 10, filterable by department (grouped category/subcategory dropdown; picking a parent includes its subdepartments, matched by `departmentId`).
- **Initiatives** — full CRUD list with status/quarter/search filters, owner/department/priority/progress tracking, dependency management per initiative, an "Export to Excel" button that downloads a formatted `.xlsx` snapshot of current status, and a per-initiative "Status History" audit trail (see below). The list is paginated (9 per page) and search matches title/owner case-insensitively; filters/search reset pagination to page 1. Overdue initiatives get a red "overdue" badge and red due-date text (`isInitiativeOverdue` in `src/lib/initiative-filters.ts`, unit-tested; completed initiatives are never overdue, comparison is against local midnight today). The detail dialog shows Start and Target dates, then sections in this order: **Milestones**, **Updates** (narrative notes), **Dependencies**, **Status History**.
- **Sponsor field** — initiatives have an optional `sponsor` (nullable text) set in the create/edit form (trimmed to `null` when blank) and shown in the detail dialog header next to Owner.
- **Milestones** — lightweight milestones per initiative (`milestones` table: title, start/end date, owner, status `planned | in_progress | blocked | completed`, optional note; cascade delete with the initiative). API: `GET/POST /api/initiatives/:id/milestones`, `PATCH/DELETE /api/milestones/:id`; server enforces `endDate >= startDate` (PATCH considers the existing row when only one date is supplied) → 400. UI: "Milestones" section in the detail dialog (`milestone-section.tsx`) with inline add/edit/delete, client-side date-order validation, and status badges (blocked = red, completed = green). Note: initiative cards on the Initiatives page have no Edit button — editing happens via the detail dialog.
- **Initiative Updates** — dated narrative notes per initiative (`initiative_updates` table: content, optional author, timestamp; cascade delete with the initiative). API: `GET/POST /api/initiatives/:id/updates`, `DELETE /api/initiative-updates/:id`. Posted/deleted from the detail dialog.
- **Resolvable dependencies** — each dependency has a `resolved` boolean toggled from the detail dialog (green check to resolve, undo to reopen). Resolved dependencies stay listed (dimmed, green "Resolved" badge) but are excluded from the dashboard High Risk count and from the heatmap (cells *and* category columns).
- **Heatmap** — a department × dependency risk matrix; on mobile the Department column stays pinned (sticky) while scrolling horizontally through dependency columns. Clicking a populated cell opens a drill-down dialog listing that cell's dependencies (initiative title, risk-level badge, notes), sorted highest risk first — the heatmap API returns a `dependencies` array per cell.
- **Quarterly Goals** — initiatives viewed against the current fiscal quarter.
- **Settings** — tabbed page: General (fiscal quarter start date + company default language), Departments (CRUD, with parent selection), Risk Categories (CRUD). Old `/departments` and `/risk-categories` URLs redirect here with the correct tab pre-selected.

## Architecture decisions

- **Fiscal quarters are anchor-based, not calendar Q1–Q4.** Quarters recur every 3 months from a configurable start date (month + day) stored in Settings — always verify "current quarter" against that anchor, not an assumed Jan-start calendar.
- **Mobile dialog handling is centralized.** The shared `DialogContent` component uses `max-h-[90dvh]` (dynamic viewport height, not `vh`) plus `overflow-y-auto overscroll-contain` so every dialog in the app scrolls correctly on mobile without per-dialog overrides. Multi-column form grids collapse to a single column below `sm`. (Known exception: the initiative detail dialog additionally caps itself at `max-h-[85vh]` because of its long content.)
- **409 Conflict on delete-while-referenced.** Deleting a Department or Risk Category that's still referenced by a dependency returns 409 instead of silently cascading or failing generically.
- **Hand-written SQL unique constraints must follow Drizzle's naming convention** (`<table>_<column>_unique`) or `drizzle-kit push` will treat it as a schema diff.
- **Centralized DB error handling.** `artifacts/api-server/src/lib/db-errors.ts` exposes `isUniqueViolation`/`isForeignKeyViolation`, used by a shared Express error-handling middleware in `app.ts` as the generic fallback. drizzle-orm wraps the underlying pg error, so the real error code is at `err.cause.code` (not `err.code`) — the helper checks both. Intentional exception: `risk-categories.ts` catches unique violations at the route level to return a specific, user-friendly 409 message; the middleware remains the safety net for everything else.
- **Settings is a hardened singleton.** `getOrCreateSettings()` uses a fixed id (`SINGLETON_ID = 1`) with `onConflictDoNothing` upsert instead of select-then-insert, so concurrent first-access requests can't create duplicate rows.
- **Test suite.** Vitest + Supertest contract tests in `artifacts/api-server/src/routes/*.test.ts` run against the real dev Postgres DB (no mocks/containers) using distinctive "Contract Test..." names and explicit FK-safe cleanup in `afterAll`. Frontend unit tests (`src/lib/*.test.ts`) and component tests (`src/components/*.test.tsx`, jsdom + Testing Library) live under `artifacts/initiative-tracker/src`.
- **Consistent loading/error UI.** `src/components/page-state.tsx` provides `PageLoading`, `PageError`, `CardSkeletonGrid`, and `InlineLoading` — used across all pages/dialogs instead of ad-hoc spinners or plain error text, so loading/error states look and behave the same everywhere.
- **Status history / audit trail.** `initiative_history` table (`lib/db/src/schema/initiative-history.ts`) records `oldStatus`/`newStatus`/`changedAt` whenever `PATCH /api/initiatives/:id` actually changes the `status` field (inserted inside the same `db.transaction()` as the update; no entry on same-value or non-status updates). Exposed via `GET /api/initiatives/:id/history` (newest first) and shown in the Initiative Detail dialog's "Status History" section.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Sample data seeding: the API server seeds the database from `artifacts/api-server/src/seed/seed-data.json` at startup, but only if the `seed_state` table is empty (one-time bootstrap; this is how production gets test data after publishing). Set `FORCE_RESEED=true` to wipe all data and reload the sample dataset — destructive, off by default. To refresh the snapshot, re-export from the dev DB into that JSON file.
- Always run `pnpm --filter @workspace/initiative-tracker run typecheck` after touching dialog/form layouts — several mobile-layout bugs were only visible via mobile-viewport screenshots or e2e tests, not typecheck alone.
- When adding a new lookup table (like Departments/Risk Categories) that can be referenced elsewhere, add delete-protection (409) before wiring up the delete button.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
