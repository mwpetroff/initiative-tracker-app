import { integer, pgTable, serial, timestamp } from "drizzle-orm/pg-core";

export const seedStateTable = pgTable("seed_state", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SeedState = typeof seedStateTable.$inferSelect;
