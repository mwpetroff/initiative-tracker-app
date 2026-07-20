import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import {
  db,
  departmentsTable,
  initiativesTable,
  dependenciesTable,
  riskCategoriesTable,
  initiativeHistoryTable,
} from "@workspace/db";

let deptA: number;
let deptB: number;
let deptC: number;
let historyInitiativeId: number;
let riskCategoryId: number;
const initiativeIds: number[] = [];
const dependencyIds: number[] = [];

beforeAll(async () => {
  const a = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Insights Dept A", colorHex: "#111111" });
  deptA = a.body.id;

  const b = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Insights Dept B", colorHex: "#222222" });
  deptB = b.body.id;

  const category = await request(app)
    .post("/api/risk-categories")
    .send({ name: "Contract Test Insights Category" });
  riskCategoryId = category.body.id;

  const planning = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Insights planning initiative",
      description: "desc",
      departmentId: deptA,
      status: "planning",
      priority: "low",
      owner: "owner",
      progress: 0,
      startDate: "2026-01-01",
      targetDate: "2026-02-01",
    });
  const blocked = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Insights blocked initiative",
      description: "desc",
      departmentId: deptA,
      status: "blocked",
      priority: "high",
      owner: "owner",
      progress: 20,
      startDate: "2026-01-01",
      targetDate: "2026-02-01",
    });
  const inProgress = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Insights in-progress initiative",
      description: "desc",
      departmentId: deptB,
      status: "in_progress",
      priority: "medium",
      owner: "owner",
      progress: 50,
      startDate: "2026-01-01",
      targetDate: "2026-02-01",
    });
  initiativeIds.push(planning.body.id, blocked.body.id, inProgress.body.id);

  const highRiskDep = await request(app)
    .post("/api/dependencies")
    .send({ initiativeId: blocked.body.id, dependsOnDepartmentId: deptB, riskLevel: "high", notes: "" });
  const lowRiskDep = await request(app)
    .post("/api/dependencies")
    .send({
      initiativeId: inProgress.body.id,
      dependsOnRiskCategoryId: riskCategoryId,
      riskLevel: "low",
      notes: "",
    });
  dependencyIds.push(highRiskDep.body.id, lowRiskDep.body.id);

  const c = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Insights Dept C", colorHex: "#333333" });
  deptC = c.body.id;

  const historyInitiative = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Insights history initiative",
      description: "desc",
      departmentId: deptC,
      status: "planning",
      priority: "low",
      owner: "owner",
      progress: 0,
      startDate: "2026-01-01",
      targetDate: "2026-02-01",
    });
  historyInitiativeId = historyInitiative.body.id;
  await request(app).patch(`/api/initiatives/${historyInitiativeId}`).send({ status: "in_progress" });
});

afterAll(async () => {
  for (const id of dependencyIds) {
    await db.delete(dependenciesTable).where(eq(dependenciesTable.id, id));
  }
  await db.delete(initiativeHistoryTable).where(eq(initiativeHistoryTable.initiativeId, historyInitiativeId));
  await db.delete(initiativesTable).where(eq(initiativesTable.id, historyInitiativeId));
  for (const id of initiativeIds) {
    await db.delete(initiativesTable).where(eq(initiativesTable.id, id));
  }
  await db.delete(riskCategoriesTable).where(eq(riskCategoriesTable.id, riskCategoryId));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, deptA));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, deptB));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, deptC));
});

describe("GET /api/insights/dashboard", () => {
  it("aggregates counts and department breakdowns correctly", async () => {
    const res = await request(app).get("/api/insights/dashboard");
    expect(res.status).toBe(200);

    expect(res.body.totalInitiatives).toBeGreaterThanOrEqual(3);
    expect(res.body.blockedInitiatives).toBeGreaterThanOrEqual(1);
    expect(res.body.activeInitiatives).toBeGreaterThanOrEqual(1);
    expect(res.body.highRiskDependencies).toBeGreaterThanOrEqual(1);

    const breakdownA = res.body.departmentBreakdown.find((d: { departmentId: number }) => d.departmentId === deptA);
    expect(breakdownA.total).toBe(2);
    expect(breakdownA.planning).toBe(1);
    expect(breakdownA.blocked).toBe(1);

    const breakdownB = res.body.departmentBreakdown.find((d: { departmentId: number }) => d.departmentId === deptB);
    expect(breakdownB.total).toBe(1);
    expect(breakdownB.inProgress).toBe(1);
  });

  it("counts overdue initiatives (past target date, not completed)", async () => {
    const res = await request(app).get("/api/insights/dashboard");
    expect(res.body.overdueInitiatives).toBeGreaterThanOrEqual(3);
  });

  it("returns recent activity entries from status-change history", async () => {
    const res = await request(app).get("/api/insights/dashboard");
    const entry = res.body.recentActivity.find(
      (a: { initiativeId: number }) => a.initiativeId === historyInitiativeId,
    );
    expect(entry).toBeDefined();
    expect(entry.title).toBe("Insights history initiative");
    expect(entry.departmentName).toBe("Contract Test Insights Dept C");
    expect(entry.oldStatus).toBe("planning");
    expect(entry.newStatus).toBe("in_progress");
    expect(typeof entry.changedAt).toBe("string");
  });
});

describe("GET /api/insights/heatmap", () => {
  it("builds columns for departments and used risk categories only", async () => {
    const res = await request(app).get("/api/insights/heatmap");
    expect(res.status).toBe(200);

    const columnKeys = res.body.columns.map((c: { key: string }) => c.key);
    expect(columnKeys).toContain(`dept-${deptA}`);
    expect(columnKeys).toContain(`dept-${deptB}`);
    expect(columnKeys).toContain(`cat-${riskCategoryId}`);
  });

  it("computes cell risk scores from dependency risk levels", async () => {
    const res = await request(app).get("/api/insights/heatmap");
    const blockedInitiativeRow = res.body.cells.find(
      (c: { rowDepartmentId: number; columnKey: string }) =>
        c.rowDepartmentId === deptA && c.columnKey === `dept-${deptB}`,
    );
    expect(blockedInitiativeRow).toBeDefined();
    expect(blockedInitiativeRow.maxRiskLevel).toBe("high");
    expect(blockedInitiativeRow.dependencyCount).toBe(1);
  });

  it("includes per-cell dependency details for drill-down", async () => {
    const res = await request(app).get("/api/insights/heatmap");
    const cell = res.body.cells.find(
      (c: { rowDepartmentId: number; columnKey: string }) =>
        c.rowDepartmentId === deptA && c.columnKey === `dept-${deptB}`,
    );
    expect(cell.dependencies).toHaveLength(1);
    expect(cell.dependencies[0]).toMatchObject({
      dependencyId: dependencyIds[0],
      initiativeTitle: "Insights blocked initiative",
      riskLevel: "high",
      notes: "",
    });
  });

  it("excludes resolved dependencies from cells and drops category columns used only by resolved deps", async () => {
    await request(app).patch(`/api/dependencies/${dependencyIds[1]}`).send({ resolved: true });

    const res = await request(app).get("/api/insights/heatmap");
    const columnKeys = res.body.columns.map((c: { key: string }) => c.key);
    expect(columnKeys).not.toContain(`cat-${riskCategoryId}`);
    const cell = res.body.cells.find(
      (c: { columnKey: string }) => c.columnKey === `cat-${riskCategoryId}`,
    );
    expect(cell).toBeUndefined();

    await request(app).patch(`/api/dependencies/${dependencyIds[1]}`).send({ resolved: false });
  });

  it("filters dependencies by initiative status when status param is set", async () => {
    const res = await request(app).get("/api/insights/heatmap?status=blocked");
    expect(res.status).toBe(200);

    const blockedCell = res.body.cells.find(
      (c: { rowDepartmentId: number; columnKey: string }) =>
        c.rowDepartmentId === deptA && c.columnKey === `dept-${deptB}`,
    );
    expect(blockedCell).toBeDefined();
    expect(blockedCell.dependencies[0].initiativeTitle).toBe("Insights blocked initiative");

    const nonBlockedCell = res.body.cells.find(
      (c: { rowDepartmentId: number; columnKey: string }) =>
        c.rowDepartmentId === deptB && c.columnKey === `cat-${riskCategoryId}`,
    );
    expect(nonBlockedCell).toBeUndefined();

    const columnKeys = res.body.columns.map((c: { key: string }) => c.key);
    expect(columnKeys).not.toContain(`cat-${riskCategoryId}`);
  });

  it("excludes resolved high-risk dependencies from the dashboard count", async () => {
    const before = await request(app).get("/api/insights/dashboard");
    await request(app).patch(`/api/dependencies/${dependencyIds[0]}`).send({ resolved: true });
    const after = await request(app).get("/api/insights/dashboard");
    expect(after.body.highRiskDependencies).toBe(before.body.highRiskDependencies - 1);
    await request(app).patch(`/api/dependencies/${dependencyIds[0]}`).send({ resolved: false });
  });
});
