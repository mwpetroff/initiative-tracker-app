---
name: Drizzle wraps pg error codes under err.cause
description: How to correctly detect Postgres error codes (unique/FK violations) when using drizzle-orm
---

When drizzle-orm throws on a constraint violation, it wraps the underlying `pg` error in a `DrizzleQueryError`. The real Postgres error code (e.g. `23505` unique violation, `23503` foreign key violation) lives at `err.cause.code`, not `err.code` on the thrown error itself.

**Why:** A shared `isUniqueViolation`/`isForeignKeyViolation` helper that only checked `err.code` silently always returned `false`, so routes fell through to a generic 500 instead of returning 409. This only surfaces when the check runs against a real drizzle-thrown error (e.g. in a contract test hitting a real unique constraint) — code review alone won't catch it.

**How to apply:** Any helper that inspects a caught DB error's `.code` must check both `err.code` and `err.cause?.code` (fall back to cause if the direct code is absent). Verify with an actual integration/contract test that triggers the DB constraint — don't trust a unit test that mocks the error shape.
