/*
 * Regenerates data/*.json from docs/india-health-insurance-market-2026.md.
 * Run: npm run extract -w @stacked/seed-data
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseB1, parseB2, parseInsurers, parseScenarios } from "./parse.js";

const here = dirname(fileURLToPath(import.meta.url));
export const DOC_PATH = resolve(here, "../../../docs/india-health-insurance-market-2026.md");
const out = (name: string, rows: unknown[]) => {
  writeFileSync(resolve(here, "../data", name), `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`${name}: ${rows.length} rows`);
};

const md = readFileSync(DOC_PATH, "utf8");
const products = [...parseB1(md), ...parseB2(md)];
const ids = new Set<string>();
for (const p of products) {
  if (ids.has(p.product_id)) throw new Error(`Duplicate product_id ${p.product_id}`);
  ids.add(p.product_id);
}

out("insurers.json", parseInsurers(md));
out("products.json", products);
out("scenarios.json", parseScenarios(md));
