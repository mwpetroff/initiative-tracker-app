import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, departmentsTable, initiativesTable, dependenciesTable } from "@workspace/db";
import {
  CreateDepartmentBody,
  UpdateDepartmentParams,
  UpdateDepartmentBody,
  DeleteDepartmentParams,
  ListDepartmentsResponse,
  CreateDepartmentResponse,
  UpdateDepartmentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/departments", async (_req, res): Promise<void> => {
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  res.json(ListDepartmentsResponse.parse(departments));
});

router.post("/departments", async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [department] = await db.insert(departmentsTable).values(parsed.data).returning();

  res.status(201).json(CreateDepartmentResponse.parse(department));
});

router.patch("/departments/:id", async (req, res): Promise<void> => {
  const params = UpdateDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [department] = await db
    .update(departmentsTable)
    .set(parsed.data)
    .where(eq(departmentsTable.id, params.data.id))
    .returning();

  if (!department) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  res.json(UpdateDepartmentResponse.parse(department));
});

router.delete("/departments/:id", async (req, res): Promise<void> => {
  const params = DeleteDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [inUseInitiative] = await db
    .select({ id: initiativesTable.id })
    .from(initiativesTable)
    .where(eq(initiativesTable.departmentId, params.data.id))
    .limit(1);

  if (inUseInitiative) {
    res
      .status(409)
      .json({ error: "This department is in use by one or more initiatives and cannot be deleted" });
    return;
  }

  const [inUseDependency] = await db
    .select({ id: dependenciesTable.id })
    .from(dependenciesTable)
    .where(eq(dependenciesTable.dependsOnDepartmentId, params.data.id))
    .limit(1);

  if (inUseDependency) {
    res
      .status(409)
      .json({ error: "This department is in use by one or more dependencies and cannot be deleted" });
    return;
  }

  const [department] = await db
    .delete(departmentsTable)
    .where(eq(departmentsTable.id, params.data.id))
    .returning();

  if (!department) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
