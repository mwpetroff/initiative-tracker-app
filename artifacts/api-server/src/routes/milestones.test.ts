import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, departmentsTable, initiativesTable, milestonesTable } from "@workspace/db";

let departmentId: number;
let initiativeId: number;

beforeAll(async () => {
  const dept = await request(app)
    .post("/api/departments")
    .send({ name: "Contract Test Milestones Dept", colorHex: "#665544" });
  departmentId = dept.body.id;

  const initiative = await request(app)
    .post("/api/initiatives")
    .send({
      title: "Contract test milestones initiative",
      description: "desc",
      departmentId,
      status: "planning",
      priority: "low",
      owner: "owner",
      sponsor: "Sponsor Person",
      progress: 0,
      startDate: "2026-01-01",
      targetDate: "2026-06-01",
    });
  initiativeId = initiative.body.id;
});

afterAll(async () => {
  await db.delete(milestonesTable).where(eq(milestonesTable.initiativeId, initiativeId));
  await db.delete(initiativesTable).where(eq(initiativesTable.id, initiativeId));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, departmentId));
});

describe("milestones", () => {
  it("persists sponsor on the initiative", async () => {
    const res = await request(app).get(`/api/initiatives/${initiativeId}`);
    expect(res.status).toBe(200);
    expect(res.body.sponsor).toBe("Sponsor Person");
  });

  it("returns an empty list before any milestones", async () => {
    const res = await request(app).get(`/api/initiatives/${initiativeId}/milestones`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates a milestone and returns 201", async () => {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/milestones`)
      .send({
        title: "Kickoff",
        startDate: "2026-01-10",
        endDate: "2026-01-20",
        owner: "Alice",
        status: "planned",
        note: "First phase",
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Kickoff");
    expect(res.body.initiativeId).toBe(initiativeId);
    expect(res.body.startDate).toContain("2026-01-10");
    expect(res.body.endDate).toContain("2026-01-20");
    expect(res.body.status).toBe("planned");
    expect(res.body.note).toBe("First phase");
  });

  it("creates a milestone without a note (null)", async () => {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/milestones`)
      .send({
        title: "Phase two",
        startDate: "2026-02-01",
        endDate: "2026-02-15",
        owner: "Bob",
        status: "in_progress",
      });
    expect(res.status).toBe(201);
    expect(res.body.note).toBeNull();
  });

  it("rejects end date before start date with 400", async () => {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/milestones`)
      .send({
        title: "Bad dates",
        startDate: "2026-03-10",
        endDate: "2026-03-01",
        owner: "Carol",
        status: "planned",
      });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid status with 400", async () => {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/milestones`)
      .send({
        title: "Bad status",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
        owner: "Carol",
        status: "done",
      });
    expect(res.status).toBe(400);
  });

  it("returns 404 when posting to a nonexistent initiative", async () => {
    const res = await request(app)
      .post("/api/initiatives/999999999/milestones")
      .send({
        title: "Orphan",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        owner: "X",
        status: "planned",
      });
    expect(res.status).toBe(404);
  });

  it("lists milestones ordered by start date", async () => {
    const res = await request(app).get(`/api/initiatives/${initiativeId}/milestones`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe("Kickoff");
    expect(res.body[1].title).toBe("Phase two");
  });

  it("updates a milestone", async () => {
    const list = await request(app).get(`/api/initiatives/${initiativeId}/milestones`);
    const target = list.body[0];
    const res = await request(app)
      .patch(`/api/milestones/${target.id}`)
      .send({ status: "completed", note: "Done early" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.note).toBe("Done early");
    expect(res.body.title).toBe("Kickoff");
  });

  it("rejects a patch that moves end date before existing start date", async () => {
    const list = await request(app).get(`/api/initiatives/${initiativeId}/milestones`);
    const target = list.body[0];
    const res = await request(app)
      .patch(`/api/milestones/${target.id}`)
      .send({ endDate: "2026-01-05" });
    expect(res.status).toBe(400);
  });

  it("rejects a patch that moves start date after existing end date", async () => {
    const list = await request(app).get(`/api/initiatives/${initiativeId}/milestones`);
    const target = list.body[0];
    const res = await request(app)
      .patch(`/api/milestones/${target.id}`)
      .send({ startDate: "2026-05-01" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching a nonexistent milestone", async () => {
    const res = await request(app)
      .patch("/api/milestones/999999999")
      .send({ status: "completed" });
    expect(res.status).toBe(404);
  });

  it("deletes a milestone and returns 204", async () => {
    const list = await request(app).get(`/api/initiatives/${initiativeId}/milestones`);
    const target = list.body[1];
    const res = await request(app).delete(`/api/milestones/${target.id}`);
    expect(res.status).toBe(204);

    const after = await request(app).get(`/api/initiatives/${initiativeId}/milestones`);
    expect(after.body).toHaveLength(1);
  });

  it("returns 404 when deleting a nonexistent milestone", async () => {
    const res = await request(app).delete("/api/milestones/999999999");
    expect(res.status).toBe(404);
  });
});
