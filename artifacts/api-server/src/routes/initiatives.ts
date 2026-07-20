import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, initiativesTable, initiativeHistoryTable, initiativeUpdatesTable } from "@workspace/db";
import {
  ListInitiativeUpdatesParams,
  ListInitiativeUpdatesResponse,
  CreateInitiativeUpdateParams,
  CreateInitiativeUpdateBody,
  CreateInitiativeUpdateResponse,
  DeleteInitiativeUpdateParams,
  ListInitiativesQueryParams,
  CreateInitiativeBody,
  GetInitiativeParams,
  UpdateInitiativeParams,
  UpdateInitiativeBody,
  DeleteInitiativeParams,
  ListInitiativesResponse,
  CreateInitiativeResponse,
  GetInitiativeResponse,
  UpdateInitiativeResponse,
  ListInitiativeHistoryParams,
  ListInitiativeHistoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

router.get("/initiatives", async (req, res): Promise<void> => {
  const query = ListInitiativesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.departmentId !== undefined) {
    conditions.push(eq(initiativesTable.departmentId, query.data.departmentId));
  }
  if (query.data.status !== undefined) {
    conditions.push(eq(initiativesTable.status, query.data.status));
  }

  const initiatives = await db
    .select()
    .from(initiativesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(initiativesTable.updatedAt);

  res.json(ListInitiativesResponse.parse(initiatives));
});

router.post("/initiatives", async (req, res): Promise<void> => {
  const parsed = CreateInitiativeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [initiative] = await db
    .insert(initiativesTable)
    .values({
      ...parsed.data,
      startDate: toDateString(parsed.data.startDate),
      targetDate: toDateString(parsed.data.targetDate),
    })
    .returning();

  res.status(201).json(CreateInitiativeResponse.parse(initiative));
});

router.get("/initiatives/:id", async (req, res): Promise<void> => {
  const params = GetInitiativeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [initiative] = await db
    .select()
    .from(initiativesTable)
    .where(eq(initiativesTable.id, params.data.id));

  if (!initiative) {
    res.status(404).json({ error: "Initiative not found" });
    return;
  }

  res.json(GetInitiativeResponse.parse(initiative));
});

router.patch("/initiatives/:id", async (req, res): Promise<void> => {
  const params = UpdateInitiativeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInitiativeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { startDate, targetDate, ...rest } = parsed.data;
  const updateValues: Record<string, unknown> = { ...rest };
  if (startDate !== undefined) {
    updateValues.startDate = toDateString(startDate);
  }
  if (targetDate !== undefined) {
    updateValues.targetDate = toDateString(targetDate);
  }

  const initiative = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(initiativesTable).where(eq(initiativesTable.id, params.data.id));

    if (!existing) {
      return undefined;
    }

    const [updated] = await tx
      .update(initiativesTable)
      .set(updateValues)
      .where(eq(initiativesTable.id, params.data.id))
      .returning();

    if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
      await tx.insert(initiativeHistoryTable).values({
        initiativeId: params.data.id,
        oldStatus: existing.status,
        newStatus: parsed.data.status,
      });
    }

    return updated;
  });

  if (!initiative) {
    res.status(404).json({ error: "Initiative not found" });
    return;
  }

  res.json(UpdateInitiativeResponse.parse(initiative));
});

router.get("/initiatives/:id/history", async (req, res): Promise<void> => {
  const params = ListInitiativeHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const history = await db
    .select()
    .from(initiativeHistoryTable)
    .where(eq(initiativeHistoryTable.initiativeId, params.data.id))
    .orderBy(desc(initiativeHistoryTable.changedAt));

  res.json(ListInitiativeHistoryResponse.parse(history));
});

router.get("/initiatives/:id/updates", async (req, res): Promise<void> => {
  const params = ListInitiativeUpdatesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const updates = await db
    .select()
    .from(initiativeUpdatesTable)
    .where(eq(initiativeUpdatesTable.initiativeId, params.data.id))
    .orderBy(desc(initiativeUpdatesTable.createdAt));

  res.json(ListInitiativeUpdatesResponse.parse(updates));
});

router.post("/initiatives/:id/updates", async (req, res): Promise<void> => {
  const params = CreateInitiativeUpdateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateInitiativeUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [initiative] = await db
    .select({ id: initiativesTable.id })
    .from(initiativesTable)
    .where(eq(initiativesTable.id, params.data.id));

  if (!initiative) {
    res.status(404).json({ error: "Initiative not found" });
    return;
  }

  const [update] = await db
    .insert(initiativeUpdatesTable)
    .values({
      initiativeId: params.data.id,
      content: parsed.data.content,
      author: parsed.data.author ?? null,
    })
    .returning();

  res.status(201).json(CreateInitiativeUpdateResponse.parse(update));
});

router.delete("/initiative-updates/:id", async (req, res): Promise<void> => {
  const params = DeleteInitiativeUpdateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [update] = await db
    .delete(initiativeUpdatesTable)
    .where(eq(initiativeUpdatesTable.id, params.data.id))
    .returning();

  if (!update) {
    res.status(404).json({ error: "Update not found" });
    return;
  }

  res.sendStatus(204);
});

router.delete("/initiatives/:id", async (req, res): Promise<void> => {
  const params = DeleteInitiativeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [initiative] = await db
    .delete(initiativesTable)
    .where(eq(initiativesTable.id, params.data.id))
    .returning();

  if (!initiative) {
    res.status(404).json({ error: "Initiative not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
