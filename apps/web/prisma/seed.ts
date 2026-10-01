/*
 * Loads Table A, Tables B1/B2 (+ name-only list) and Table C into Postgres,
 * plus a demo user (fictional) with four policies and one saved claim plan.
 * Run: DATABASE_URL=… npm run db:migrate && npm run db:seed -w @stacked/web
 * The rows come from @stacked/seed-data, which is regenerated from the research doc.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { allocateClaim } from "@stacked/claim-engine";
import { DEMO_PERSON, DEMO_POLICIES, INSURERS, PRODUCTS, SCENARIOS, demoScenario } from "@stacked/seed-data";

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

  // Demo data: one fictional user, their family group, policies and a saved plan
  const user = await prisma.user.upsert({
    where: { email: DEMO_PERSON.email },
    create: { email: DEMO_PERSON.email, name: DEMO_PERSON.name },
    update: { name: DEMO_PERSON.name },
  });
  const family = await prisma.familyGroup.upsert({
    where: { id: "demo-family" },
    create: { id: "demo-family", name: "Rao family" },
    update: { name: "Rao family" },
  });
  await prisma.familyMember.upsert({
    where: { user_id_family_group_id: { user_id: user.id, family_group_id: family.id } },
    create: { user_id: user.id, family_group_id: family.id, role: "owner" },
    update: {},
  });
  for (const p of DEMO_POLICIES) {
    const data = {
      user_id: user.id,
      family_group_id: p.holder_relationship === "parents_floater" ? family.id : null,
      insurer_id: p.insurer_id,
      product_id: p.product_id,
      holder_relationship: p.holder_relationship,
      policy_type: p.policy_type,
      data: p as unknown as Prisma.InputJsonValue,
      data_status: p.data_status,
      source_url: p.source_url ?? null,
      as_of: p.as_of ? date(p.as_of) : null,
    };
    await prisma.policy.upsert({ where: { policy_id: p.policy_id }, create: { policy_id: p.policy_id, ...data }, update: data });
  }
  const scenario = demoScenario(new Date().toISOString().slice(0, 10));
  const plan = allocateClaim(DEMO_POLICIES, scenario, INSURERS);
  const planRow = {
    user_id: user.id,
    scenario: scenario as unknown as Prisma.InputJsonValue,
    policies: DEMO_POLICIES as unknown as Prisma.InputJsonValue,
    plan: plan as unknown as Prisma.InputJsonValue,
    engine_version: plan.engine_version,
  };
  await prisma.claimPlan.upsert({ where: { id: "demo-plan" }, create: { id: "demo-plan", ...planRow }, update: planRow });

  console.log(`Seeded ${INSURERS.length} insurers, ${PRODUCTS.length} products, ${SCENARIOS.length} scenarios.`);
  console.log(`Demo: ${DEMO_PERSON.name}, ${DEMO_POLICIES.length} policies, plan "${plan.headline}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
