import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, departmentsTable, initiativesTable } from "@workspace/db";

const createdInitiativeIds: number[] = [];
let departmentId: number;
let otherDepartmentId: number;

beforeAll(async () => {
  const dept = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Initiatives Dept", colorHex: "#334455" });
  departmentId = dept.body.id;

  const otherDept = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Initiatives Dept B", colorHex: "#556677" });
  otherDepartmentId = otherDept.body.id;
});

afterAll(async () => {
  for (const id of createdInitiativeIds) {
    await db.delete(initiativesTable).where(eq(initiativesTable.id, id));
  }
  await db.delete(departmentsTable).where(eq(departmentsTable.id, departmentId));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, otherDepartmentId));
});

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Contract test initiative",
    description: "desc",
    departmentId,
    status: "planning",
    priority: "low",
    owner: "owner",
    progress: 0,
    startDate: "2026-01-01",
    targetDate: "2026-02-01",
    ...overrides,
  };
}

describe("POST /api/initiatives", () => {
  it("creates an initiative", async () => {
    const res = await request(app).post("/api/initiatives").send(basePayload());
    createdInitiativeIds.push(res.body.id);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Contract test initiative");
    expect(res.body.departmentId).toBe(departmentId);
  });

  it("rejects an invalid body with 400", async () => {
    const res = await request(app).post("/api/initiatives").send({ title: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/initiatives", () => {
  it("filters by departmentId", async () => {
    const a = await request(app).post("/api/initiatives").send(basePayload({ title: "Filter A" }));
    const b = await request(app)
      .post("/api/initiatives")
      .send(basePayload({ title: "Filter B", departmentId: otherDepartmentId }));
    createdInitiativeIds.push(a.body.id, b.body.id);

    const res = await request(app).get("/api/initiatives").query({ departmentId });
    const ids = res.body.map((i: { id: number }) => i.id);
    expect(ids).toContain(a.body.id);
    expect(ids).not.toContain(b.body.id);
  });

  it("filters by status", async () => {
    const blocked = await request(app)
      .post("/api/initiatives")
      .send(basePayload({ title: "Blocked one", status: "blocked" }));
    createdInitiativeIds.push(blocked.body.id);

    const res = await request(app).get("/api/initiatives").query({ status: "blocked" });
    const ids = res.body.map((i: { id: number }) => i.id);
    expect(ids).toContain(blocked.body.id);
    expect(res.body.every((i: { status: string }) => i.status === "blocked")).toBe(true);
  });

  it("rejects an invalid status filter with 400", async () => {
    const res = await request(app).get("/api/initiatives").query({ status: "not-a-real-status" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/initiatives/:id", () => {
  it("updates an initiative", async () => {
    const created = await request(app).post("/api/initiatives").send(basePayload());
    createdInitiativeIds.push(created.body.id);

    const res = await request(app)
      .patch(`/api/initiatives/${created.body.id}`)
      .send({ status: "in_progress", progress: 50 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
    expect(res.body.progress).toBe(50);
  });

  it("returns 404 when updating a nonexistent initiative", async () => {
    const res = await request(app).patch("/api/initiatives/999999999").send({ progress: 10 });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/initiatives/:id", () => {
  it("deletes an initiative", async () => {
    const created = await request(app).post("/api/initiatives").send(basePayload());
    const res = await request(app).delete(`/api/initiatives/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  it("returns 404 for a nonexistent initiative", async () => {
    const res = await request(app).delete("/api/initiatives/999999999");
    expect(res.status).toBe(404);
  });
});
