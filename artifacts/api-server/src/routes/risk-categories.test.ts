import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, riskCategoriesTable, dependenciesTable, initiativesTable, departmentsTable } from "@workspace/db";

const createdRiskCategoryIds: number[] = [];
const createdDependencyIds: number[] = [];
const createdInitiativeIds: number[] = [];
const createdDepartmentIds: number[] = [];

afterAll(async () => {
  for (const id of createdDependencyIds) {
    await db.delete(dependenciesTable).where(eq(dependenciesTable.id, id));
  }
  for (const id of createdInitiativeIds) {
    await db.delete(initiativesTable).where(eq(initiativesTable.id, id));
  }
  for (const id of createdRiskCategoryIds) {
    await db.delete(riskCategoriesTable).where(eq(riskCategoriesTable.id, id));
  }
  for (const id of createdDepartmentIds) {
    await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  }
});

describe("POST /api/risk-categories", () => {
  it("creates a risk category", async () => {
    const res = await request(app).post("/api/risk-categories").send({ name: "Contract Test Category A" });
    createdRiskCategoryIds.push(res.body.id);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Contract Test Category A");
  });

  it("returns 409 for a duplicate name via the shared unique-violation handler", async () => {
    const first = await request(app).post("/api/risk-categories").send({ name: "Contract Test Duplicate" });
    createdRiskCategoryIds.push(first.body.id);

    const second = await request(app).post("/api/risk-categories").send({ name: "Contract Test Duplicate" });
    expect(second.status).toBe(409);
  });

  it("rejects an empty name with 400", async () => {
    const res = await request(app).post("/api/risk-categories").send({ name: "" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/risk-categories/:id", () => {
  it("deletes an unused risk category", async () => {
    const created = await request(app).post("/api/risk-categories").send({ name: "Contract Test Unused" });
    const res = await request(app).delete(`/api/risk-categories/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  it("returns 409 when the risk category is referenced by a dependency", async () => {
    const category = await request(app).post("/api/risk-categories").send({ name: "Contract Test In-Use" });
    createdRiskCategoryIds.push(category.body.id);

    const dept = await request(app)
      .post("/api/departments")
      .send({ name: "Contract Test RC Owner Dept", colorHex: "#112233" });
    createdDepartmentIds.push(dept.body.id);

    const initiative = await request(app)
      .post("/api/initiatives")
      .send({
        title: "Contract test initiative for risk category",
        description: "desc",
        departmentId: dept.body.id,
        status: "planning",
        priority: "low",
        owner: "owner",
        progress: 0,
        startDate: "2026-01-01",
        targetDate: "2026-02-01",
      });
    createdInitiativeIds.push(initiative.body.id);

    const dependency = await request(app)
      .post("/api/dependencies")
      .send({
        initiativeId: initiative.body.id,
        dependsOnRiskCategoryId: category.body.id,
        riskLevel: "high",
        notes: "",
      });
    createdDependencyIds.push(dependency.body.id);

    const deleteRes = await request(app).delete(`/api/risk-categories/${category.body.id}`);
    expect(deleteRes.status).toBe(409);

    const stillThere = await db
      .select()
      .from(riskCategoriesTable)
      .where(eq(riskCategoriesTable.id, category.body.id));
    expect(stillThere).toHaveLength(1);
  });

  it("returns 404 for a risk category that does not exist", async () => {
    const res = await request(app).delete("/api/risk-categories/999999999");
    expect(res.status).toBe(404);
  });
});
