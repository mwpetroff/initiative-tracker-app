import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, departmentsTable, initiativesTable, initiativeUpdatesTable } from "@workspace/db";

let departmentId: number;
let initiativeId: number;

beforeAll(async () => {
  const dept = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Updates Dept", colorHex: "#887766" });
  departmentId = dept.body.id;

  const initiative = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Contract test updates initiative",
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
  await db.delete(initiativeUpdatesTable).where(eq(initiativeUpdatesTable.initiativeId, initiativeId));
  await db.delete(initiativesTable).where(eq(initiativesTable.id, initiativeId));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, departmentId));
});

describe("initiative updates", () => {
  it("returns an empty list before any updates", async () => {
    const res = await request(app).get(`/api/initiatives/${initiativeId}/updates`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates an update with author and returns 201", async () => {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/updates`)
      .send({ content: "First update", author: "Test Author" });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe("First update");
    expect(res.body.author).toBe("Test Author");
    expect(res.body.initiativeId).toBe(initiativeId);
  });

  it("creates an update without author (null)", async () => {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/updates`)
      .send({ content: "Second update" });
    expect(res.status).toBe(201);
    expect(res.body.author).toBeNull();
  });

  it("lists updates most-recent-first", async () => {
    const res = await request(app).get(`/api/initiatives/${initiativeId}/updates`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe("Second update");
    expect(res.body[1].content).toBe("First update");
  });

  it("rejects empty content with 400", async () => {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/updates`)
      .send({ content: "" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when posting to a nonexistent initiative", async () => {
    const res = await request(app)
      .post("/api/initiatives/999999999/updates")
      .send({ content: "orphan" });
    expect(res.status).toBe(404);
  });

  it("deletes an update and returns 204", async () => {
    const list = await request(app).get(`/api/initiatives/${initiativeId}/updates`);
    const target = list.body[0];
    const res = await request(app).delete(`/api/initiative-updates/${target.id}`);
    expect(res.status).toBe(204);

    const after = await request(app).get(`/api/initiatives/${initiativeId}/updates`);
    expect(after.body).toHaveLength(1);
  });

  it("returns 404 when deleting a nonexistent update", async () => {
    const res = await request(app).delete("/api/initiative-updates/999999999");
    expect(res.status).toBe(404);
  });
});
