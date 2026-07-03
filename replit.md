# Initiative Tracker

A web app for tracking company initiatives across departments — status, priority, progress, cross-team dependencies, and quarterly goals — with a visual risk heatmap and Excel export for reporting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/initiative-tracker run dev` — run the frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
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

- `artifacts/api-server` — Express API (routes, business logic)
- `artifacts/initiative-tracker` — React + Vite frontend (the main web app, previewPath `/`)
  - `src/pages` — one file per route: dashboard, initiatives, heatmap, quarterly-goals, settings (hosts Departments & Risk Categories as tabs)
  - `src/components` — dialogs (initiative/department/risk-category/dependency forms) and shared UI primitives (`components/ui`)
- Shared DB schema and API contracts live in workspace packages consumed via Orval-generated hooks (`@workspace/api-client-react`)

## Product

- **Dashboard** — high-level summary of initiative status and department breakdowns.
- **Initiatives** — full CRUD list with status/quarter filters, owner/department/priority/progress tracking, dependency management per initiative, and an "Export to Excel" button that downloads a formatted `.xlsx` snapshot of current status.
- **Heatmap** — a department × dependency risk matrix; on mobile the Department column stays pinned (sticky) while scrolling horizontally through dependency columns.
- **Quarterly Goals** — initiatives viewed against the current fiscal quarter.
- **Settings** — tabbed page: General (fiscal quarter start date), Departments (CRUD), Risk Categories (CRUD). Old `/departments` and `/risk-categories` URLs redirect here with the correct tab pre-selected.

## Architecture decisions

- **Fiscal quarters are anchor-based, not calendar Q1–Q4.** Quarters recur every 3 months from a configurable start date (month + day) stored in Settings — always verify "current quarter" against that anchor, not an assumed Jan-start calendar.
- **Mobile dialog handling is centralized.** The shared `DialogContent` component uses `max-h-[90dvh]` (dynamic viewport height, not `vh`) plus `overflow-y-auto overscroll-contain` so every dialog in the app scrolls correctly on mobile without per-dialog overrides. Multi-column form grids collapse to a single column below `sm`.
- **409 Conflict on delete-while-referenced.** Deleting a Department or Risk Category that's still referenced by a dependency returns 409 instead of silently cascading or failing generically.
- **Hand-written SQL unique constraints must follow Drizzle's naming convention** (`<table>_<column>_unique`) or `drizzle-kit push` will treat it as a schema diff.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/initiative-tracker run typecheck` after touching dialog/form layouts — several mobile-layout bugs were only visible via mobile-viewport screenshots or e2e tests, not typecheck alone.
- When adding a new lookup table (like Departments/Risk Categories) that can be referenced elsewhere, add delete-protection (409) before wiring up the delete button.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
