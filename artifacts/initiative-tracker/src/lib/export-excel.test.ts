import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ExcelJS from "exceljs";
import { exportInitiativesToExcel } from "./export-excel";
import type { Initiative, Department } from "@workspace/api-client-react";

const departments: Department[] = [
  { id: 1, name: "Engineering", colorHex: "#3B82F6", createdAt: new Date().toISOString() } as Department,
];

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: 1,
    title: "Ship feature X",
    description: "A description",
    departmentId: 1,
    status: "in_progress",
    priority: "high",
    owner: "Alice",
    progress: 42,
    startDate: "2026-01-01",
    targetDate: "2026-03-01",
    quarterGoal: "Launch",
    quarterGoalTarget: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Initiative;
}

let capturedBuffer: ArrayBuffer | null = null;
let clickSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  capturedBuffer = null;
  clickSpy = vi.fn();

  vi.stubGlobal(
    "Blob",
    class {
      constructor(public parts: unknown[]) {
        capturedBuffer = parts[0] as ArrayBuffer;
      }
    },
  );

  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });

  const fakeLink = {
    href: "",
    download: "",
    click: clickSpy,
  };

  vi.stubGlobal("document", {
    createElement: vi.fn(() => fakeLink),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exportInitiativesToExcel", () => {
  it("produces a workbook with one row per initiative and correct header labels", async () => {
    const initiatives = [
      makeInitiative({ id: 1, title: "First", status: "planning", priority: "low" }),
      makeInitiative({ id: 2, title: "Second", status: "blocked", priority: "high" }),
    ];

    await exportInitiativesToExcel(initiatives, departments, "test.xlsx");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedBuffer).not.toBeNull();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(capturedBuffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Initiative Status");
    expect(sheet).toBeDefined();

    const headerRow = sheet!.getRow(1).values as unknown[];
    expect(headerRow).toContain("Title");
    expect(headerRow).toContain("Department");
    expect(headerRow).toContain("Status");

    expect(sheet!.rowCount).toBe(3); // header + 2 initiatives

    // Column order: title(1), department(2), status(3), priority(4), owner(5), progress(6),
    // startDate(7), targetDate(8), latestUpdateDate(9), latestUpdate(10),
    // quarterGoal(11), quarterGoalTarget(12), description(13)
    const firstDataRow = sheet!.getRow(2);
    expect(firstDataRow.getCell(1).value).toBe("First");
    expect(firstDataRow.getCell(3).value).toBe("Planning");
    expect(firstDataRow.getCell(2).value).toBe("Engineering");
  });

  it("falls back to 'Unknown' when the department cannot be found", async () => {
    const initiatives = [makeInitiative({ id: 1, departmentId: 999 })];

    await exportInitiativesToExcel(initiatives, departments, "test.xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(capturedBuffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Initiative Status");
    const row = sheet!.getRow(2);
    expect(row.getCell(2).value).toBe("Unknown");
  });

  it("includes the latest narrative update between Target Date and Quarter Goal", async () => {
    const initiatives = [makeInitiative({ id: 1 }), makeInitiative({ id: 2, title: "No updates" })];

    await exportInitiativesToExcel(initiatives, departments, "test.xlsx", undefined, {
      1: { content: "Vendor contract signed", createdAt: "2026-07-15T09:30:00.000Z" },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(capturedBuffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Initiative Status");

    const headerRow = sheet!.getRow(1).values as unknown[];
    expect(headerRow[8]).toBe("Target Date");
    expect(headerRow[9]).toBe("Latest Update Date");
    expect(headerRow[10]).toBe("Latest Update");
    expect(headerRow[11]).toBe("Quarter Goal");

    const rowWithUpdate = sheet!.getRow(2);
    expect(rowWithUpdate.getCell(10).value).toBe("Vendor contract signed");
    expect((rowWithUpdate.getCell(9).value as Date).toISOString().slice(0, 10)).toBe("2026-07-15");

    const rowWithoutUpdate = sheet!.getRow(3);
    expect(rowWithoutUpdate.getCell(9).value ?? "").toBe("");
    expect(rowWithoutUpdate.getCell(10).value ?? "").toBe("");
  });

  it("handles an empty initiatives list by producing only the header row", async () => {
    await exportInitiativesToExcel([], departments, "test.xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(capturedBuffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Initiative Status");
    expect(sheet!.rowCount).toBe(1);
  });
});
