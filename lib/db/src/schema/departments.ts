import { pgTable, serial, text, timestamp, integer, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameJa: text("name_ja"),
  colorHex: text("color_hex").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => departmentsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departmentsTable.$inferSelect;
