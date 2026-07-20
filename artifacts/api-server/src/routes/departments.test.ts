import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, departmentsTable, initiativesTable, dependenciesTable } from "@workspace/db";

const createdDepartmentIds: number[] = [];
const createdInitiativeIds: number[] = [];
const createdDependencyIds: number[] = [];

async function createDepartment(name: string) {
  const res = await request(app).post("/api/departments").send({ name, colorHex: "#123456" });
  createdDepartmentIds.push(res.body.id);
  return res.body as { id: number; name: string };
}

afterAll(async () => {
  if (createdDependencyIds.length > 0) {
    for (const id of createdDependencyIds) {
      await db.delete(dependenciesTable).where(eq(dependenciesTable.id, id));
    }
  }
  if (createdInitiativeIds.length > 0) {
    for (const id of createdInitiativeIds) {
      await db.delete(initiativesTable).where(eq(initiativesTable.id, id));
    }
  }
  for (const id of createdDepartmentIds) {
    await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  }
});

describe("department hierarchy constraints", () => {
  it("creates a sub-department under a top-level parent", async () => {
    const parent = await createDepartment("Contract Test Hierarchy Parent");
    const res = await request(app)
      .post("/api/departments")
      .send({ name: "Contract Test Hierarchy Child", colorHex: "#123456", parentId: parent.id });
    createdDepartmentIds.unshift(res.body.id);
    expect(res.status).toBe(201);
    expect(res.body.parentId).toBe(parent.id);
  });

  it("rejects a nonexistent parent with 400", async () => {
    const res = await request(app)
      .post("/api/departments")
      .send({ name: "Contract Test Hierarchy Orphan", colorHex: "#123456", parentId: 999999999 });
    if (res.body?.id) createdDepartmentIds.push(res.body.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parent department not found/i);
  });

  it("rejects nesting more than one level deep with 400", async () => {
    const parent = await createDepartment("Contract Test Hierarchy L1");
    const childRes = await request(app)
      .post("/api/departments")
      .send({ name: "Contract Test Hierarchy L2", colorHex: "#123456", parentId: parent.id });
    createdDepartmentIds.unshift(childRes.body.id);

    const res = await request(app)
      .post("/api/departments")
      .send({ name: "Contract Test Hierarchy L3", colorHex: "#123456", parentId: childRes.body.id });
    if (res.body?.id) createdDepartmentIds.unshift(res.body.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/one level deep/i);
  });

  it("rejects a department becoming its own parent with 400", async () => {
    const dept = await createDepartment("Contract Test Hierarchy Self");
    const res = await request(app)
      .patch(`/api/departments/${dept.id}`)
      .send({ parentId: dept.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own parent/i);
  });

  it("rejects giving a parent to a department that has sub-departments with 400", async () => {
    const parent = await createDepartment("Contract Test Hierarchy Busy Parent");
    const childRes = await request(app)
      .post("/api/departments")
      .send({ name: "Contract Test Hierarchy Busy Child", colorHex: "#123456", parentId: parent.id });
    createdDepartmentIds.unshift(childRes.body.id);
    const other = await createDepartment("Contract Test Hierarchy Other Top");

    const res = await request(app)
      .patch(`/api/departments/${parent.id}`)
      .send({ parentId: other.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sub-departments/i);
  });
});

describe("POST /api/departments", () => {
  it("creates a department", async () => {
    const res = await request(app)
      .post("/api/departments")
      .send({ name: "Test Dept Contract A", colorHex: "#AABBCC" });
    createdDepartmentIds.push(res.body.id);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Dept Contract A");
    expect(res.body.colorHex).toBe("#AABBCC");
  });

  it("rejects an invalid body with 400", async () => {
    const res = await request(app).post("/api/departments").send({ name: "" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/departments/:id", () => {
  it("deletes a department that is not referenced by anything", async () => {
    const dept = await createDepartment("Test Dept Contract Unused");
    const res = await request(app).delete(`/api/departments/${dept.id}`);
    expect(res.status).toBe(204);
    createdDepartmentIds.splice(createdDepartmentIds.indexOf(dept.id), 1);
  });

  it("returns 404 for a department that does not exist", async () => {
    const res = await request(app).delete("/api/departments/999999999");
    expect(res.status).toBe(404);
  });

  it("returns 409 and does not cascade-delete when the department has initiatives", async () => {
    const dept = await createDepartment("Test Dept Contract In-Use Initiative");

    const initiativeRes = await request(app)
      .post("/api/initiatives")
      .send({
        title: "Contract test initiative",
        description: "desc",
        departmentId: dept.id,
        status: "planning",
        priority: "low",
        owner: "owner",
        progress: 0,
        startDate: "2026-01-01",
        targetDate: "2026-02-01",
      });
    expect(initiativeRes.status).toBe(201);
    createdInitiativeIds.push(initiativeRes.body.id);

    const deleteRes = await request(app).delete(`/api/departments/${dept.id}`);
    expect(deleteRes.status).toBe(409);

    const stillThere = await db
      .select()
      .from(initiativesTable)
      .where(eq(initiativesTable.id, initiativeRes.body.id));
    expect(stillThere).toHaveLength(1);

    const deptStillThere = await db.select().from(departmentsTable).where(eq(departmentsTable.id, dept.id));
    expect(deptStillThere).toHaveLength(1);
  });

  it("returns 409 and does not cascade-delete when the department is referenced by a dependency", async () => {
    const dept = await createDepartment("Test Dept Contract In-Use Dependency");
    const otherDept = await createDepartment("Test Dept Contract Dependency Owner");

    const initiativeRes = await request(app)
      .post("/api/initiatives")
      .send({
        title: "Contract test initiative for dependency",
        description: "desc",
        departmentId: otherDept.id,
        status: "planning",
        priority: "low",
        owner: "owner",
        progress: 0,
        startDate: "2026-01-01",
        targetDate: "2026-02-01",
      });
    createdInitiativeIds.push(initiativeRes.body.id);

    const dependencyRes = await request(app)
      .post("/api/dependencies")
      .send({
        initiativeId: initiativeRes.body.id,
        dependsOnDepartmentId: dept.id,
        riskLevel: "medium",
        notes: "",
      });
    expect(dependencyRes.status).toBe(201);
    createdDependencyIds.push(dependencyRes.body.id);

    const deleteRes = await request(app).delete(`/api/departments/${dept.id}`);
    expect(deleteRes.status).toBe(409);

    const deptStillThere = await db.select().from(departmentsTable).where(eq(departmentsTable.id, dept.id));
    expect(deptStillThere).toHaveLength(1);

    const dependencyStillThere = await db
      .select()
      .from(dependenciesTable)
      .where(eq(dependenciesTable.id, dependencyRes.body.id));
    expect(dependencyStillThere).toHaveLength(1);
  });
});
