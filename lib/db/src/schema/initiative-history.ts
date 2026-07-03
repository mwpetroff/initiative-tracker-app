import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { initiativesTable } from "./initiatives";

export const initiativeHistoryTable = pgTable("initiative_history", {
  id: serial("id").primaryKey(),
  initiativeId: integer("initiative_id")
    .notNull()
    .references(() => initiativesTable.id, { onDelete: "cascade" }),
  oldStatus: text("old_status").notNull(),
  newStatus: text("new_status").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInitiativeHistorySchema = createInsertSchema(initiativeHistoryTable).omit({
  id: true,
  changedAt: true,
});
export type InsertInitiativeHistory = z.infer<typeof insertInitiativeHistorySchema>;
export type InitiativeHistory = typeof initiativeHistoryTable.$inferSelect;
