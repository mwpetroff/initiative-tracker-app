import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { initiativesTable } from "./initiatives";

export const initiativeUpdatesTable = pgTable("initiative_updates", {
  id: serial("id").primaryKey(),
  initiativeId: integer("initiative_id")
    .notNull()
    .references(() => initiativesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  author: text("author"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInitiativeUpdateSchema = createInsertSchema(initiativeUpdatesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInitiativeUpdate = z.infer<typeof insertInitiativeUpdateSchema>;
export type InitiativeUpdate = typeof initiativeUpdatesTable.$inferSelect;
