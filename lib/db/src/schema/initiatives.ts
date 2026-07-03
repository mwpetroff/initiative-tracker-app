import { integer, pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";

export const initiativesTable = pgTable("initiatives", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departmentsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // planning | in_progress | blocked | completed | on_hold
  priority: text("priority").notNull(), // low | medium | high
  owner: text("owner").notNull(),
  progress: integer("progress").notNull().default(0),
  startDate: date("start_date", { mode: "string" }).notNull(),
  targetDate: date("target_date", { mode: "string" }).notNull(),
  quarterGoal: text("quarter_goal"),
  quarterGoalTarget: integer("quarter_goal_target"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertInitiativeSchema = createInsertSchema(initiativesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInitiative = z.infer<typeof insertInitiativeSchema>;
export type Initiative = typeof initiativesTable.$inferSelect;
