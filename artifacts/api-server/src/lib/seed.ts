import { pool } from "@workspace/db";
import { logger } from "./logger";
import seedData from "../seed/seed-data.json" with { type: "json" };

export const SEED_VERSION = 1;

type Row = Record<string, unknown>;

const INSERT_ORDER = [
  "departments",
  "risk_categories",
  "settings",
  "initiatives",
  "dependencies",
  "initiative_history",
  "initiative_updates",
] as const;

const DELETE_ORDER = [...INSERT_ORDER].reverse();

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier in seed data: ${name}`);
  }
  return `"${name}"`;
}

interface SeedClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

async function insertRows(
  client: SeedClient,
  table: string,
  rows: Row[],
  overrides: Record<string, unknown> = {},
): Promise<void> {
  for (const row of rows) {
    const merged = { ...row, ...overrides };
    const columns = Object.keys(merged);
    const values = columns.map((c) => merged[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    await client.query(
      `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES (${placeholders.join(", ")})`,
      values,
    );
  }
}

export async function seedIfNeeded(): Promise<boolean> {
  const client = await pool.connect();
  try {
    const state = await client.query("SELECT COUNT(*) AS count FROM seed_state");
    const alreadySeeded = Number(state.rows[0]?.["count"] ?? 0) > 0;
    const forceReseed = process.env["FORCE_RESEED"] === "true";

    if (alreadySeeded && !forceReseed) {
      return false;
    }

    if (forceReseed) {
      logger.warn(
        "FORCE_RESEED=true — wiping all data and reloading the sample dataset",
      );
    }

    logger.info({ seedVersion: SEED_VERSION }, "Seeding database with sample data");

    await client.query("BEGIN");

    for (const table of DELETE_ORDER) {
      await client.query(`DELETE FROM ${quoteIdent(table)}`);
    }

    const data = seedData as Record<string, Row[]>;

    // Departments reference each other via parent_id, so insert with
    // parent_id null first, then restore the hierarchy.
    await insertRows(client, "departments", data["departments"] ?? [], {
      parent_id: null,
    });
    for (const dept of data["departments"] ?? []) {
      if (dept["parent_id"] != null) {
        await client.query("UPDATE departments SET parent_id = $1 WHERE id = $2", [
          dept["parent_id"],
          dept["id"],
        ]);
      }
    }

    for (const table of INSERT_ORDER) {
      if (table === "departments") continue;
      await insertRows(client, table, data[table] ?? []);
    }

    for (const table of INSERT_ORDER) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${quoteIdent(table)}), 0) + 1, false)`,
      );
    }

    await client.query("INSERT INTO seed_state (version) VALUES ($1)", [SEED_VERSION]);

    await client.query("COMMIT");
    logger.info({ seedVersion: SEED_VERSION }, "Database seeded with sample data");
    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
