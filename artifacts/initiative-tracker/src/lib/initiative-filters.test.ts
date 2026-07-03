import { describe, it, expect } from "vitest";
import { filterInitiatives, paginate } from "./initiative-filters";
import type { Initiative } from "@workspace/api-client-react";

function makeInitiative(overrides: Partial<Initiative>): Initiative {
  return {
    id: 1,
    title: "Untitled",
    description: "",
    departmentId: 1,
    status: "planning",
    priority: "medium",
    owner: "Alice",
    progress: 0,
    startDate: "2026-01-01",
    targetDate: "2026-01-01",
    quarterGoal: null,
    quarterGoalTarget: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Initiative;
}

describe("filterInitiatives", () => {
  const initiatives = [
    makeInitiative({ id: 1, title: "Launch mobile app", owner: "Alice", status: "planning" }),
    makeInitiative({ id: 2, title: "Migrate database", owner: "Bob", status: "blocked" }),
    makeInitiative({ id: 3, title: "Redesign onboarding", owner: "Carol", status: "planning" }),
  ];
  const getQuarterKey = (initiative: Initiative) => (initiative.id === 1 ? "Q1-2026" : "Q2-2026");

  it("returns all initiatives when no filters are applied", () => {
    const result = filterInitiatives(initiatives, {
      statusFilter: "all",
      quarterFilter: "all",
      searchQuery: "",
      getQuarterKey,
    });
    expect(result).toHaveLength(3);
  });

  it("filters by status", () => {
    const result = filterInitiatives(initiatives, {
      statusFilter: "blocked",
      quarterFilter: "all",
      searchQuery: "",
      getQuarterKey,
    });
    expect(result.map((i) => i.id)).toEqual([2]);
  });

  it("filters by quarter", () => {
    const result = filterInitiatives(initiatives, {
      statusFilter: "all",
      quarterFilter: "Q1-2026",
      searchQuery: "",
      getQuarterKey,
    });
    expect(result.map((i) => i.id)).toEqual([1]);
  });

  it("filters by case-insensitive search across title and owner", () => {
    const byTitle = filterInitiatives(initiatives, {
      statusFilter: "all",
      quarterFilter: "all",
      searchQuery: "database",
      getQuarterKey,
    });
    expect(byTitle.map((i) => i.id)).toEqual([2]);

    const byOwner = filterInitiatives(initiatives, {
      statusFilter: "all",
      quarterFilter: "all",
      searchQuery: "carol",
      getQuarterKey,
    });
    expect(byOwner.map((i) => i.id)).toEqual([3]);
  });

  it("combines status, quarter, and search filters", () => {
    const result = filterInitiatives(initiatives, {
      statusFilter: "planning",
      quarterFilter: "Q2-2026",
      searchQuery: "redesign",
      getQuarterKey,
    });
    expect(result.map((i) => i.id)).toEqual([3]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterInitiatives(initiatives, {
      statusFilter: "all",
      quarterFilter: "all",
      searchQuery: "nonexistent",
      getQuarterKey,
    });
    expect(result).toHaveLength(0);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("returns the first page by default slice", () => {
    const result = paginate(items, 1, 9);
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(1);
    expect(result.totalItems).toBe(25);
  });

  it("returns the correct slice for a middle page", () => {
    const result = paginate(items, 2, 9);
    expect(result.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(result.currentPage).toBe(2);
  });

  it("returns the remainder on the last page", () => {
    const result = paginate(items, 3, 9);
    expect(result.items).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(result.currentPage).toBe(3);
  });

  it("clamps a page number above the total to the last page", () => {
    const result = paginate(items, 99, 9);
    expect(result.currentPage).toBe(3);
    expect(result.items).toEqual([19, 20, 21, 22, 23, 24, 25]);
  });

  it("clamps a page number below 1 to the first page", () => {
    const result = paginate(items, 0, 9);
    expect(result.currentPage).toBe(1);
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("always returns at least one page for an empty list", () => {
    const result = paginate([] as number[], 1, 9);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.items).toEqual([]);
  });
});
