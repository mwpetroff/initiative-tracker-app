import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, SINGLETON_ID } from "@workspace/db";
import { UpdateSettingsBody, GetSettingsResponse, UpdateSettingsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_QUARTER_START_DATE = "2026-01-01";

async function getOrCreateSettings() {
  // Upsert on the fixed singleton id so concurrent first-access calls converge
  // on a single row instead of racing to insert duplicates (see schema comment).
  const [settings] = await db
    .insert(settingsTable)
    .values({ id: SINGLETON_ID, quarterStartDate: DEFAULT_QUARTER_START_DATE })
    .onConflictDoNothing({ target: settingsTable.id })
    .returning();

  if (settings) {
    return settings;
  }

  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.id, SINGLETON_ID));
  return existing;
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(GetSettingsResponse.parse(settings));
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await getOrCreateSettings();

  const [updated] = await db
    .update(settingsTable)
    .set({ quarterStartDate: toDateString(parsed.data.quarterStartDate) })
    .where(eq(settingsTable.id, existing.id))
    .returning();

  res.json(UpdateSettingsResponse.parse(updated));
});

export default router;
