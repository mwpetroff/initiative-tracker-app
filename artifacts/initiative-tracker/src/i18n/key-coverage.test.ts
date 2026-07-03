import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import en from "./locales/en.json";
import ja from "./locales/ja.json";

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      keys.push(...flattenKeys(value as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function walkSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      files.push(...walkSourceFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

interface Usage {
  key: string;
  file: string;
  line: number;
}

interface DynamicUsage {
  prefix: string;
  raw: string;
  file: string;
  line: number;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function collectUsages(): { staticUsages: Usage[]; dynamicUsages: DynamicUsage[] } {
  const staticUsages: Usage[] = [];
  const dynamicUsages: DynamicUsage[] = [];

  const staticPattern = /\bt\(\s*(["'])((?:(?!\1).)+)\1/g;
  const templatePattern = /\bt\(\s*`([^`]*)`/g;

  for (const file of walkSourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, "utf-8");
    const relative = path.relative(SRC_DIR, file);

    for (const match of source.matchAll(staticPattern)) {
      staticUsages.push({
        key: match[2],
        file: relative,
        line: lineOf(source, match.index),
      });
    }

    for (const match of source.matchAll(templatePattern)) {
      const raw = match[1];
      const interpolationStart = raw.indexOf("${");
      if (interpolationStart === -1) {
        staticUsages.push({
          key: raw,
          file: relative,
          line: lineOf(source, match.index),
        });
      } else {
        dynamicUsages.push({
          prefix: raw.slice(0, interpolationStart),
          raw,
          file: relative,
          line: lineOf(source, match.index),
        });
      }
    }
  }

  return { staticUsages, dynamicUsages };
}

function keyExists(key: string, keySet: Set<string>): boolean {
  if (keySet.has(key)) return true;
  return PLURAL_SUFFIXES.some((suffix) => keySet.has(`${key}${suffix}`));
}

const enKeys = new Set(flattenKeys(en));
const jaKeys = new Set(flattenKeys(ja));
const { staticUsages, dynamicUsages } = collectUsages();

describe("i18n key coverage", () => {
  it("finds t() usages in the source tree", () => {
    expect(staticUsages.length).toBeGreaterThan(0);
  });

  it.each([
    ["en.json", enKeys],
    ["ja.json", jaKeys],
  ] as const)("every static t() key exists in %s", (localeName, keySet) => {
    const missing = staticUsages.filter((usage) => !keyExists(usage.key, keySet));
    const report = missing
      .map((usage) => `  - "${usage.key}" (${usage.file}:${usage.line})`)
      .join("\n");
    expect(
      missing.length,
      `Missing ${missing.length} translation key(s) in ${localeName}:\n${report}`,
    ).toBe(0);
  });

  it.each([
    ["en.json", enKeys],
    ["ja.json", jaKeys],
  ] as const)(
    "every dynamic t(`...${}`) prefix matches at least one key in %s",
    (localeName, keySet) => {
      const unmatched = dynamicUsages.filter(
        (usage) =>
          usage.prefix.length > 0 &&
          ![...keySet].some((key) => key.startsWith(usage.prefix)),
      );
      const report = unmatched
        .map((usage) => `  - t(\`${usage.raw}\`) (${usage.file}:${usage.line})`)
        .join("\n");
      expect(
        unmatched.length,
        `Dynamic key prefix(es) with no matching keys in ${localeName}:\n${report}`,
      ).toBe(0);
    },
  );

  it("en.json and ja.json define the same set of keys", () => {
    const stripPluralSuffix = (key: string): string => {
      for (const suffix of PLURAL_SUFFIXES) {
        if (key.endsWith(suffix)) return key.slice(0, -suffix.length);
      }
      return key;
    };
    const enBaseKeys = new Set([...enKeys].map(stripPluralSuffix));
    const jaBaseKeys = new Set([...jaKeys].map(stripPluralSuffix));
    const missingInJa = [...enBaseKeys].filter((key) => !jaBaseKeys.has(key));
    const missingInEn = [...jaBaseKeys].filter((key) => !enBaseKeys.has(key));
    const report = [
      missingInJa.length
        ? `Keys in en.json but missing from ja.json:\n${missingInJa.map((k) => `  - ${k}`).join("\n")}`
        : "",
      missingInEn.length
        ? `Keys in ja.json but missing from en.json:\n${missingInEn.map((k) => `  - ${k}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    expect(missingInJa.length + missingInEn.length, report).toBe(0);
  });
});
