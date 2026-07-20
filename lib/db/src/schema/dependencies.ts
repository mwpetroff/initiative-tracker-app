import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";
import { initiativesTable } from "./initiatives";
import { riskCategoriesTable } from "./risk-categories";

export const dependenciesTable = pgTable("dependencies", {
  id: serial("id").primaryKey(),
  initiativeId: integer("initiative_id")
    .notNull()
    .references(() => initiativesTable.id, { onDelete: "cascade" }),
  dependsOnDepartmentId: integer("depends_on_department_id").references(() => departmentsTable.id, {
    onDelete: "cascade",
  }),
  dependsOnRiskCategoryId: integer("depends_on_risk_category_id").references(() => riskCategoriesTable.id, {
    onDelete: "restrict",
  }),
  riskLevel: text("risk_level").notNull(), // low | medium | high | critical
  notes: text("notes").notNull().default(""),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDependencySchema = createInsertSchema(dependenciesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDependency = z.infer<typeof insertDependencySchema>;
export type Dependency = typeof dependenciesTable.$inferSelect;
