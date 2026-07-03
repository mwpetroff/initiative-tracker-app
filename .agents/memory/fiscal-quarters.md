---
name: Fiscal quarter calculation
description: How to correctly compute "current fiscal quarter" from a configurable anchor date, and a testing pitfall to avoid.
---

Fiscal quarters anchored to a custom start date (e.g. company setting "quarter start date") recur every 3 months from that date's month+day, not from calendar Jan 1. E.g. anchor April 1 produces quarters Apr1-Jun30, Jul1-Sep30, Oct1-Dec31, Jan1-Mar31 — NOT the standard calendar Q1-Q4.

**Why:** When manually reasoning about "what quarter is today in," it's easy to assume a Jan-start calendar quarter. This caused a false-positive bug report during e2e testing (expected "quarter starting April 1" when today's date was actually in the following quarter, July 1).

**How to apply:** When writing test plans or manually verifying "current quarter" logic, always compute the expected quarter using the actual anchor month/day + actual current date — don't assume standard calendar quarters or that "today" falls in the quarter matching the anchor month.
