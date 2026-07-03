---
name: Dev-DB contract test residue
description: Contract tests run against the real dev Postgres; leftover rows can pollute UI features that surface "latest" data.
---

Contract tests (Supertest) run against the same dev database the user sees. Earlier test versions that lacked full cleanup left orphan initiatives/departments/history rows, which surfaced as junk entries in the dashboard's "Recent Activity" feed (which shows the newest history rows globally).

**Why:** Any feature that displays "most recent N rows" across the whole table will show test residue first, since test rows are the newest writes.

**How to apply:** After adding tests that create rows (especially history/audit rows), verify `afterAll` deletes everything they insert — including side-effect rows like `initiative_history` created by PATCH status changes (FK requires deleting history before the initiative). When a "recent activity"-style feed shows odd entries, check for leftover rows named like "Contract Test..." and delete them from the dev DB.
