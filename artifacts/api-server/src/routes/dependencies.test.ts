import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, departmentsTable, initiativesTable, dependenciesTable } from "@workspace/db";

const createdDependencyIds: number[] = [];
let departmentId: number;
let initiativeId: number;
let otherInitiativeId: number;

beforeAll(async () => {
  const dept = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Dependencies Dept", colorHex: "#667788" });
  departmentId = dept.body.id;

  const initiative = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Contract test dependency host",
      description: "desc",
      departmentId,
      status: "planning",
      priority: "low",
      owner: "owner",
      progress: 0,
      startDate: "2026-01-01",
      targetDate: "2026-02-01",
    });
  initiativeId = initiative.body.id;

  const otherInitiative = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Contract test dependency host B",
      description: "desc",
      departmentId,
      status: "planning",
      priority: "low",
      owner: "owner",
      progress: 0,
      startDate: "2026-01-01",
      targetDate: "2026-02-01",
    });
  otherInitiativeId = otherInitiative.body.id;
});

afterAll(async () => {
  for (const id of createdDependencyIds) {
    await db.delete(dependenciesTable).where(eq(dependenciesTable.id, id));
  }
  await db.delete(initiativesTable).where(eq(initiativesTable.id, initiativeId));
  await db.delete(initiativesTable).where(eq(initiativesTable.id, otherInitiativeId));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, departmentId));
});

describe("POST /api/dependencies", () => {
  it("creates a dependency", async () => {
    const res = await request(app)
      .post("/api/dependencies")
      .send({ initiativeId, dependsOnDepartmentId: departmentId, riskLevel: "low", notes: "" });
    createdDependencyIds.push(res.body.id);
    expect(res.status).toBe(201);
    expect(res.body.initiativeId).toBe(initiativeId);
  });

  it("rejects an invalid body with 400", async () => {
    const res = await request(app).post("/api/dependencies").send({ riskLevel: "not-a-level" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/initiatives/:id/dependencies", () => {
  it("only returns dependencies scoped to that initiative", async () => {
    const a = await request(app)
      .post("/api/dependencies")
      .send({ initiativeId, dependsOnDepartmentId: departmentId, riskLevel: "medium", notes: "" });
    const b = await request(app)
      .post("/api/dependencies")
      .send({ initiativeId: otherInitiativeId, dependsOnDepartmentId: departmentId, riskLevel: "medium", notes: "" });
    createdDependencyIds.push(a.body.id, b.body.id);

    const res = await request(app).get(`/api/initiatives/${initiativeId}/dependencies`);
    const ids = res.body.map((d: { id: number }) => d.id);
    expect(ids).toContain(a.body.id);
    expect(ids).not.toContain(b.body.id);
  });
});

describe("PATCH /api/dependencies/:id", () => {
  it("updates a dependency", async () => {
    const created = await request(app)
      .post("/api/dependencies")
      .send({ initiativeId, dependsOnDepartmentId: departmentId, riskLevel: "low", notes: "" });
    createdDependencyIds.push(created.body.id);

    const res = await request(app)
      .patch(`/api/dependencies/${created.body.id}`)
      .send({ riskLevel: "critical", notes: "updated" });
    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("critical");
    expect(res.body.notes).toBe("updated");
  });

  it("returns 404 when updating a nonexistent dependency", async () => {
    const res = await request(app).patch("/api/dependencies/999999999").send({ notes: "x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/dependencies/:id", () => {
  it("deletes a dependency", async () => {
    const created = await request(app)
      .post("/api/dependencies")
      .send({ initiativeId, dependsOnDepartmentId: departmentId, riskLevel: "low", notes: "" });
    const res = await request(app).delete(`/api/dependencies/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  it("returns 404 for a nonexistent dependency", async () => {
    const res = await request(app).delete("/api/dependencies/999999999");
    expect(res.status).toBe(404);
  });
});
