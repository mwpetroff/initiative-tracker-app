import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, riskCategoriesTable, dependenciesTable } from "@workspace/db";
import { isUniqueViolation } from "../lib/db-errors";
import {
  CreateRiskCategoryBody,
  UpdateRiskCategoryParams,
  UpdateRiskCategoryBody,
  DeleteRiskCategoryParams,
  ListRiskCategoriesResponse,
  CreateRiskCategoryResponse,
  UpdateRiskCategoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/risk-categories", async (_req, res): Promise<void> => {
  const riskCategories = await db.select().from(riskCategoriesTable).orderBy(riskCategoriesTable.name);
  res.json(ListRiskCategoriesResponse.parse(riskCategories));
});

router.post("/risk-categories", async (req, res): Promise<void> => {
  const parsed = CreateRiskCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [riskCategory] = await db.insert(riskCategoriesTable).values(parsed.data).returning();
    res.status(201).json(CreateRiskCategoryResponse.parse(riskCategory));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A risk category with this name already exists" });
      return;
    }
    throw err;
  }
});

router.patch("/risk-categories/:id", async (req, res): Promise<void> => {
  const params = UpdateRiskCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRiskCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [riskCategory] = await db
      .update(riskCategoriesTable)
      .set(parsed.data)
      .where(eq(riskCategoriesTable.id, params.data.id))
      .returning();

    if (!riskCategory) {
      res.status(404).json({ error: "Risk category not found" });
      return;
    }

    res.json(UpdateRiskCategoryResponse.parse(riskCategory));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A risk category with this name already exists" });
      return;
    }
    throw err;
  }
});

router.delete("/risk-categories/:id", async (req, res): Promise<void> => {
  const params = DeleteRiskCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [inUseDependency] = await db
    .select({ id: dependenciesTable.id })
    .from(dependenciesTable)
    .where(eq(dependenciesTable.dependsOnRiskCategoryId, params.data.id))
    .limit(1);

  if (inUseDependency) {
    res.status(409).json({ error: "This risk category is in use by one or more dependencies and cannot be deleted" });
    return;
  }

  const [riskCategory] = await db
    .delete(riskCategoriesTable)
    .where(eq(riskCategoriesTable.id, params.data.id))
    .returning();

  if (!riskCategory) {
    res.status(404).json({ error: "Risk category not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
