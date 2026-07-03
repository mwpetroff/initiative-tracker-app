import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riskCategoriesTable = pgTable("risk_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRiskCategorySchema = createInsertSchema(riskCategoriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRiskCategory = z.infer<typeof insertRiskCategorySchema>;
export type RiskCategory = typeof riskCategoriesTable.$inferSelect;
