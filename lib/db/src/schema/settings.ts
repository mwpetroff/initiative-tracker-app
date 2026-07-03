import { pgTable, serial, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Settings is a singleton table: exactly one row must ever exist, always with id=1.
// SINGLETON_ID is enforced by getOrCreateSettings() via an upsert on this fixed id,
// so concurrent first-access calls converge on the same row instead of racing to
// insert duplicates.
export const SINGLETON_ID = 1;

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  quarterStartDate: date("quarter_start_date", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
