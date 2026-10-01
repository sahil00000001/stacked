import "server-only";
import type { InsurerMetrics, Policy, Product, Scenario } from "@stacked/claim-engine";
import { DEMO_POLICIES, DEMO_PERSON, INSURERS, PRODUCTS, SCENARIOS } from "@stacked/seed-data";

/*
 * Reference data. With DATABASE_URL set it is read from Postgres (Supabase,
 * schema "stacked", seeded by prisma/seed.ts); otherwise, or if the database
 * can't be reached, straight from @stacked/seed-data, which holds the same
 * rows. The app never fails because the database did.
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

export type DataSource = "database" | "built-in";

/** Runs a database read, falling back to the built-in rows on any error. */
async function fromDb<T>(
  read: (db: Awaited<ReturnType<typeof prisma>>) => Promise<T>,
  fallback: T,
): Promise<{ data: T; source: DataSource }> {
  if (!process.env.DATABASE_URL) return { data: fallback, source: "built-in" };
  try {
    return { data: await read(await prisma()), source: "database" };
  } catch (e) {
    console.warn("[stacked] database read failed, using built-in data:", (e as Error).message.split("\n")[0]);
    return { data: fallback, source: "built-in" };
  }
}

export async function getInsurers(): Promise<InsurerMetrics[]> {
  const { data } = await fromDb(async (db) => {
    const rows = await db.insurer.findMany({ orderBy: { insurer_name: "asc" } });
    if (rows.length === 0) throw new Error("insurers table is empty");
    return rows.map((r) => ({ ...r, as_of: iso(r.as_of) }));
  }, INSURERS);
  return data;
}

export async function getInsurer(id: string): Promise<InsurerMetrics | undefined> {
  return (await getInsurers()).find((i) => i.insurer_id === id);
}

export async function getProducts(): Promise<Product[]> {
  const { data } = await fromDb(async (db) => {
    const rows = await db.product.findMany();
    if (rows.length === 0) throw new Error("products table is empty");
    return rows.map(({ all_insurers, ...r }) => ({
      ...r,
      insurer_id: all_insurers ? "*" : (r.insurer_id ?? "*"),
      si_min: siValue(r.si_min),
      si_max: siValue(r.si_max),
      room_rent_rule: r.room_rent_rule as Product["room_rent_rule"],
      consumables: r.consumables as Product["consumables"],
      as_of: iso(r.as_of),
    }));
  }, PRODUCTS);
  return data;
}

export async function getScenarios(): Promise<Scenario[]> {
  const { data } = await fromDb(async (db) => {
    const rows = (await db.scenario.findMany()) as Scenario[];
    if (rows.length === 0) throw new Error("scenarios table is empty");
    return rows.sort((a, b) => Number(a.scenario_id.slice(1)) - Number(b.scenario_id.slice(1)));
  }, SCENARIOS);
  return data;
}

/** The sample vault for "Try with sample policies": the demo user's policies. */
export async function getDemoPolicies(): Promise<{ policies: Policy[]; person: string; source: DataSource }> {
  const { data, source } = await fromDb(async (db) => {
    const user = await db.user.findUnique({ where: { email: DEMO_PERSON.email } });
    if (!user) throw new Error("demo user not seeded");
    const rows = await db.policy.findMany({ where: { user_id: user.id }, orderBy: { created_at: "asc" } });
    if (rows.length === 0) throw new Error("demo policies not seeded");
    return rows.map((r) => r.data as unknown as Policy);
  }, DEMO_POLICIES);
  return { policies: data, person: DEMO_PERSON.name, source };
}
