import "server-only";
import type { InsurerMetrics, Product, Scenario } from "@stacked/claim-engine";
import { INSURERS, PRODUCTS, SCENARIOS } from "@stacked/seed-data";

/*
 * Reference data. With DATABASE_URL set, it is read from Postgres (seeded by
 * prisma/seed.ts); otherwise straight from @stacked/seed-data, which is the
 * same rows (DECISIONS W2).
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const siValue = (v: string | null): number | "unlimited" | null =>
  v == null ? null : v === "unlimited" ? v : Number(v);

async function prisma() {
  const { PrismaClient } = await import("@prisma/client");
  const g = globalThis as unknown as { __prisma?: InstanceType<typeof PrismaClient> };
  g.__prisma ??= new PrismaClient();
  return g.__prisma;
}

const hasDatabase = () => Boolean(process.env.DATABASE_URL);

export async function getInsurers(): Promise<InsurerMetrics[]> {
  if (!hasDatabase()) return INSURERS;
  const rows = await (await prisma()).insurer.findMany({ orderBy: { insurer_name: "asc" } });
  return rows.map((r) => ({ ...r, as_of: iso(r.as_of) }));
}

export async function getInsurer(id: string): Promise<InsurerMetrics | undefined> {
  return (await getInsurers()).find((i) => i.insurer_id === id);
}

export async function getProducts(): Promise<Product[]> {
  if (!hasDatabase()) return PRODUCTS;
  const rows = await (await prisma()).product.findMany();
  return rows.map(({ all_insurers, ...r }) => ({
    ...r,
    insurer_id: all_insurers ? "*" : (r.insurer_id ?? "*"),
    si_min: siValue(r.si_min),
    si_max: siValue(r.si_max),
    room_rent_rule: r.room_rent_rule as Product["room_rent_rule"],
    consumables: r.consumables as Product["consumables"],
    as_of: iso(r.as_of),
  }));
}

export async function getScenarios(): Promise<Scenario[]> {
  if (!hasDatabase()) return SCENARIOS;
  const rows = (await (await prisma()).scenario.findMany()) as Scenario[];
  return rows.sort((a, b) => Number(a.scenario_id.slice(1)) - Number(b.scenario_id.slice(1)));
}
