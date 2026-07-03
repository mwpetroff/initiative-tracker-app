import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { db, settingsTable } from "@workspace/db";

describe("GET /api/settings", () => {
  it("returns the singleton settings row", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(typeof res.body.quarterStartDate).toBe("string");
  });

  it("never creates more than one settings row, even under concurrent first access", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get("/api/settings")),
    );
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    }

    const allRows = await db.select().from(settingsTable);
    expect(allRows).toHaveLength(1);
  });
});

describe("PUT /api/settings", () => {
  it("updates the quarter start date and keeps a single row", async () => {
    const original = await request(app).get("/api/settings");

    const res = await request(app).put("/api/settings").send({ quarterStartDate: "2026-04-01" });
    expect(res.status).toBe(200);
    expect(String(res.body.quarterStartDate).slice(0, 10)).toBe("2026-04-01");

    const allRows = await db.select().from(settingsTable);
    expect(allRows).toHaveLength(1);

    await request(app).put("/api/settings").send({ quarterStartDate: original.body.quarterStartDate });
  });

  it("rejects an invalid body with 400", async () => {
    const res = await request(app).put("/api/settings").send({ quarterStartDate: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("updates the language preference and persists it", async () => {
    const original = await request(app).get("/api/settings");

    const res = await request(app).put("/api/settings").send({ language: "ja" });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("ja");

    const after = await request(app).get("/api/settings");
    expect(after.body.language).toBe("ja");

    await request(app).put("/api/settings").send({ language: original.body.language });
  });

  it("does not change the language when only the quarter start date is updated", async () => {
    const original = await request(app).get("/api/settings");

    await request(app).put("/api/settings").send({ language: "ja" });
    const res = await request(app)
      .put("/api/settings")
      .send({ quarterStartDate: original.body.quarterStartDate });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("ja");

    await request(app).put("/api/settings").send({ language: original.body.language });
  });

  it("rejects an unsupported language with 400", async () => {
    const res = await request(app).put("/api/settings").send({ language: "fr" });
    expect(res.status).toBe(400);
  });
});
