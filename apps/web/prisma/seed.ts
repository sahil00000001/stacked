/*
 * Loads Table A, Tables B1/B2 (+ name-only list) and Table C into Postgres.
 * Run: DATABASE_URL=… npm run db:migrate && npm run db:seed -w @stacked/web
 * The rows come from @stacked/seed-data, which is regenerated from the research doc.
 */
import { PrismaClient } from "@prisma/client";
import { INSURERS, PRODUCTS, SCENARIOS } from "@stacked/seed-data";

const prisma = new PrismaClient();
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
const si = (v: number | "unlimited" | null) => (v == null ? null : String(v));

async function main() {
  for (const i of INSURERS) {
    const row = { ...i, as_of: date(i.as_of), repudiation_ratio: i.repudiation_ratio ?? null };
    const data = {
      ...row,
      health_gwp_fy26_cr: i.health_gwp_fy26_cr == null ? null : Math.round(i.health_gwp_fy26_cr),
      network_hospitals_min: i.network_hospitals_min == null ? null : Math.round(i.network_hospitals_min),
    };
    await prisma.insurer.upsert({ where: { insurer_id: i.insurer_id }, create: data, update: data });
  }

  for (const p of PRODUCTS) {
    const all = p.insurer_id === "*";
    const data = {
      ...p,
      insurer_id: all ? null : p.insurer_id,
      all_insurers: all,
      si_min: si(p.si_min),
      si_max: si(p.si_max),
      as_of: date(p.as_of),
    };
    await prisma.product.upsert({ where: { product_id: p.product_id }, create: data, update: data });
  }

  for (const s of SCENARIOS) {
    await prisma.scenario.upsert({ where: { scenario_id: s.scenario_id }, create: s, update: s });
  }

  console.log(`Seeded ${INSURERS.length} insurers, ${PRODUCTS.length} products, ${SCENARIOS.length} scenarios.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
