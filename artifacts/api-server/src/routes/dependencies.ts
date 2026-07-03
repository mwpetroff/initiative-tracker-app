import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dependenciesTable } from "@workspace/db";
import {
  ListInitiativeDependenciesParams,
  CreateDependencyBody,
  UpdateDependencyParams,
  UpdateDependencyBody,
  DeleteDependencyParams,
  ListInitiativeDependenciesResponse,
  ListDependenciesResponse,
  CreateDependencyResponse,
  UpdateDependencyResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/initiatives/:id/dependencies", async (req, res): Promise<void> => {
  const params = ListInitiativeDependenciesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const dependencies = await db
    .select()
    .from(dependenciesTable)
    .where(eq(dependenciesTable.initiativeId, params.data.id));

  res.json(ListInitiativeDependenciesResponse.parse(dependencies));
});

router.get("/dependencies", async (_req, res): Promise<void> => {
  const dependencies = await db.select().from(dependenciesTable);
  res.json(ListDependenciesResponse.parse(dependencies));
});

router.post("/dependencies", async (req, res): Promise<void> => {
  const parsed = CreateDependencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dependency] = await db.insert(dependenciesTable).values(parsed.data).returning();

  res.status(201).json(CreateDependencyResponse.parse(dependency));
});

router.patch("/dependencies/:id", async (req, res): Promise<void> => {
  const params = UpdateDependencyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDependencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dependency] = await db
    .update(dependenciesTable)
    .set(parsed.data)
    .where(eq(dependenciesTable.id, params.data.id))
    .returning();

  if (!dependency) {
    res.status(404).json({ error: "Dependency not found" });
    return;
  }

  res.json(UpdateDependencyResponse.parse(dependency));
});

router.delete("/dependencies/:id", async (req, res): Promise<void> => {
  const params = DeleteDependencyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dependency] = await db
    .delete(dependenciesTable)
    .where(eq(dependenciesTable.id, params.data.id))
    .returning();

  if (!dependency) {
    res.status(404).json({ error: "Dependency not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
