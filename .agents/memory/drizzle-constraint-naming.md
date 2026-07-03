---
name: Drizzle unique constraint naming
description: Why hand-written SQL unique constraints break drizzle-kit push, and the naming fix
---

When adding a unique constraint via raw SQL (outside of drizzle-kit generate/push), name it
`<table>_<column>_unique` — e.g. `risk_categories_name_unique` — not a custom name like
`risk_categories_name_key` (Postgres's own default naming).

**Why:** Drizzle's schema-diffing in `drizzle-kit push` computes expected constraint names from
its own convention. If the live DB has a constraint with a different name for the same
column(s), push sees it as "missing expected constraint" + "extra unexpected constraint" and
tries to drop/recreate it — which can prompt for data-loss confirmation or fail outright, even
though the constraint is functionally identical.

**How to apply:** Whenever you manually create a unique/check/foreign-key constraint via SQL
migration (e.g. as part of a manual multi-step data migration before wiring up Drizzle schema),
rename it to match Drizzle's `<table>_<column(s)>_<type>` convention immediately, before running
`drizzle-kit push`, so subsequent pushes are no-ops for that constraint.
