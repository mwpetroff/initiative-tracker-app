import { describe, it, expect } from "vitest";
import { getFiscalQuarter, formatDateRange } from "./quarter";

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

describe("getFiscalQuarter", () => {
  it("returns Q1 when reference is exactly on the anchor date", () => {
    const anchor = utc(2026, 0, 1);
    const result = getFiscalQuarter(anchor, utc(2026, 0, 1));
    expect(result.quarterNumber).toBe(1);
    expect(result.year).toBe(2026);
    expect(result.startDate).toEqual(utc(2026, 0, 1));
    expect(result.endDate).toEqual(utc(2026, 2, 31));
  });

  it("returns Q2 for a reference 3 months after the anchor", () => {
    const anchor = utc(2026, 0, 1);
    const result = getFiscalQuarter(anchor, utc(2026, 3, 15));
    expect(result.quarterNumber).toBe(2);
    expect(result.year).toBe(2026);
    expect(result.startDate).toEqual(utc(2026, 3, 1));
    expect(result.endDate).toEqual(utc(2026, 5, 30));
  });

  it("returns Q4 for a reference just before the next anchor rollover", () => {
    const anchor = utc(2026, 0, 1);
    const result = getFiscalQuarter(anchor, utc(2026, 11, 31));
    expect(result.quarterNumber).toBe(4);
    expect(result.year).toBe(2026);
    expect(result.startDate).toEqual(utc(2026, 9, 1));
    expect(result.endDate).toEqual(utc(2026, 11, 31));
  });

  it("rolls over into the prior fiscal year when reference is before this year's anchor", () => {
    const anchor = utc(2026, 3, 1); // April 1 fiscal year start
    const result = getFiscalQuarter(anchor, utc(2026, 1, 15)); // Feb 15, 2026 — before this year's anchor
    // The reference falls in the fiscal year that started April 1, 2025, in its Q4
    // (Jan 1 – Mar 31, 2026), so the reported `year` reflects the quarter's start year.
    expect(result.quarterNumber).toBe(4);
    expect(result.startDate).toEqual(utc(2026, 0, 1));
    expect(result.endDate).toEqual(utc(2026, 2, 31));
    expect(result.year).toBe(2026);
  });

  it("handles a non-January anchor mid-year correctly", () => {
    const anchor = utc(2025, 6, 1); // July 1 fiscal year start
    const result = getFiscalQuarter(anchor, utc(2026, 6, 1)); // exactly one year later
    expect(result.quarterNumber).toBe(1);
    expect(result.year).toBe(2026);
    expect(result.startDate).toEqual(utc(2026, 6, 1));
  });

  it("handles a leap-day anchor without throwing and produces a valid range", () => {
    const anchor = utc(2024, 1, 29); // Feb 29 leap day anchor
    const result = getFiscalQuarter(anchor, utc(2026, 1, 15));
    expect(result.startDate.getTime()).toBeLessThanOrEqual(result.endDate.getTime());
    expect(result.quarterNumber).toBeGreaterThanOrEqual(1);
    expect(result.quarterNumber).toBeLessThanOrEqual(4);
  });

  it("defaults reference to now when not provided", () => {
    const anchor = utc(2026, 0, 1);
    const result = getFiscalQuarter(anchor);
    expect(result.quarterNumber).toBeGreaterThanOrEqual(1);
    expect(result.quarterNumber).toBeLessThanOrEqual(4);
  });
});

describe("formatDateRange", () => {
  it("formats a range within the same year", () => {
    const start = utc(2026, 0, 1);
    const end = utc(2026, 2, 31);
    expect(formatDateRange(start, end)).toBe("Jan 1 – Mar 31, 2026");
  });

  it("formats a range spanning a year boundary", () => {
    const start = utc(2025, 11, 1);
    const end = utc(2026, 1, 28);
    expect(formatDateRange(start, end)).toBe("Dec 1 – Feb 28, 2026");
  });
});
