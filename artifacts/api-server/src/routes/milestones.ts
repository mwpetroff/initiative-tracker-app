import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, initiativesTable, milestonesTable } from "@workspace/db";
import {
  ListMilestonesParams,
  ListMilestonesResponse,
  CreateMilestoneParams,
  CreateMilestoneBody,
  CreateMilestoneResponse,
  UpdateMilestoneParams,
  UpdateMilestoneBody,
  UpdateMilestoneResponse,
  DeleteMilestoneParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

router.get("/initiatives/:id/milestones", async (req, res): Promise<void> => {
  const params = ListMilestonesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.initiativeId, params.data.id))
    .orderBy(asc(milestonesTable.startDate), asc(milestonesTable.id));

  res.json(ListMilestonesResponse.parse(milestones));
});

router.post("/initiatives/:id/milestones", async (req, res): Promise<void> => {
  const params = CreateMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.endDate < parsed.data.startDate) {
    res.status(400).json({ error: "End date must be on or after the start date" });
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

  const [milestone] = await db
    .insert(milestonesTable)
    .values({
      initiativeId: params.data.id,
      title: parsed.data.title,
      startDate: toDateString(parsed.data.startDate),
      endDate: toDateString(parsed.data.endDate),
      owner: parsed.data.owner,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
    })
    .returning();

  res.status(201).json(CreateMilestoneResponse.parse(milestone));
});

router.patch("/milestones/:id", async (req, res): Promise<void> => {
  const params = UpdateMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }

  const nextStart =
    parsed.data.startDate !== undefined ? toDateString(parsed.data.startDate) : existing.startDate;
  const nextEnd =
    parsed.data.endDate !== undefined ? toDateString(parsed.data.endDate) : existing.endDate;

  if (nextEnd < nextStart) {
    res.status(400).json({ error: "End date must be on or after the start date" });
    return;
  }

  const { startDate, endDate, note, ...rest } = parsed.data;
  const updateValues: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (startDate !== undefined) updateValues.startDate = nextStart;
  if (endDate !== undefined) updateValues.endDate = nextEnd;
  if (note !== undefined) updateValues.note = note;

  const [milestone] = await db
    .update(milestonesTable)
    .set(updateValues)
    .where(eq(milestonesTable.id, params.data.id))
    .returning();

  res.json(UpdateMilestoneResponse.parse(milestone));
});

router.delete("/milestones/:id", async (req, res): Promise<void> => {
  const params = DeleteMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [milestone] = await db
    .delete(milestonesTable)
    .where(eq(milestonesTable.id, params.data.id))
    .returning();

  if (!milestone) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
