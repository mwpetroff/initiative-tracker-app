import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, departmentsTable, initiativesTable, initiativeHistoryTable } from "@workspace/db";

let departmentId: number;
let initiativeId: number;

beforeAll(async () => {
  const dept = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test History Dept", colorHex: "#998877" });
  departmentId = dept.body.id;

  const initiative = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Contract test history initiative",
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
});

afterAll(async () => {
  await db.delete(initiativeHistoryTable).where(eq(initiativeHistoryTable.initiativeId, initiativeId));
  await db.delete(initiativesTable).where(eq(initiativesTable.id, initiativeId));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, departmentId));
});

describe("GET /api/initiatives/:id/history", () => {
  it("returns an empty list before any status change", async () => {
    const res = await request(app).get(`/api/initiatives/${initiativeId}/history`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("records a history entry when status changes via PATCH", async () => {
    const res = await request(app).patch(`/api/initiatives/${initiativeId}`).send({ status: "in_progress" });
    expect(res.status).toBe(200);

    const history = await request(app).get(`/api/initiatives/${initiativeId}/history`);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].oldStatus).toBe("planning");
    expect(history.body[0].newStatus).toBe("in_progress");
  });

  it("does not record a history entry for non-status updates", async () => {
    await request(app).patch(`/api/initiatives/${initiativeId}`).send({ progress: 75 });

    const history = await request(app).get(`/api/initiatives/${initiativeId}/history`);
    expect(history.body).toHaveLength(1);
  });

  it("does not record a history entry when status is set to the same value", async () => {
    await request(app).patch(`/api/initiatives/${initiativeId}`).send({ status: "in_progress" });

    const history = await request(app).get(`/api/initiatives/${initiativeId}/history`);
    expect(history.body).toHaveLength(1);
  });

  it("orders entries most-recent-first across multiple status changes", async () => {
    await request(app).patch(`/api/initiatives/${initiativeId}`).send({ status: "blocked" });
    await request(app).patch(`/api/initiatives/${initiativeId}`).send({ status: "completed" });

    const history = await request(app).get(`/api/initiatives/${initiativeId}/history`);
    expect(history.body).toHaveLength(3);
    expect(history.body[0].oldStatus).toBe("blocked");
    expect(history.body[0].newStatus).toBe("completed");
    expect(history.body[2].oldStatus).toBe("planning");
    expect(history.body[2].newStatus).toBe("in_progress");
  });

  it("returns an empty list for a nonexistent initiative rather than an error", async () => {
    const res = await request(app).get("/api/initiatives/999999999/history");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
