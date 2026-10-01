import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allocateClaim, CSR_WEIGHT_BY_CATEGORY, PolicySchema, type ClaimScenario } from "@stacked/claim-engine";
import { INSURERS, PRODUCTS, SCENARIOS, presetFromProduct, type PresetInput } from "../src/index.js";
import { parseB1, parseB2, parseInsurers, parseScenarios, readBonus, readMonths, readSI } from "../scripts/parse.js";

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(resolve(here, "../../../docs/india-health-insurance-market-2026.md"), "utf8");
const product = (id: string) => {
  const p = PRODUCTS.find((x) => x.product_id === id);
  if (!p) throw new Error(`no product ${id}`);
  return p;
};
const input = (over: Partial<PresetInput> = {}): PresetInput => ({
  policy_id: "p",
  holder_relationship: "self",
  sum_insured: 500000,
  members: [{ name: "Asha", dob: "1994-05-10" }],
  continuity_start: "2021-04-01",
  renewal_date: "2027-03-31",
  ...over,
});

describe("seed data matches the research doc", () => {
  it("data/*.json is what the extractor produces from the doc today", () => {
    expect(INSURERS).toEqual(parseInsurers(md));
    expect(PRODUCTS).toEqual([...parseB1(md), ...parseB2(md)]);
    expect(SCENARIOS).toEqual(parseScenarios(md));
  });

  it("loads every Table A insurer with its period and source", () => {
    expect(INSURERS).toHaveLength(31);
    const hdfc = INSURERS.find((i) => i.insurer_id === "hdfc-ergo")!;
    expect(hdfc).toMatchObject({
      csr_3yr_avg: 97.61,
      complaints_3yr_avg: 8.87,
      network_hospitals_min: 16000,
      as_of: "2026-09-07",
    });
    expect(hdfc.metric_definition).toBe("NL-37 Ditto method");
    const galaxy = INSURERS.find((i) => i.insurer_id === "galaxy-health")!;
    expect(galaxy.csr_fy24).toBeNull();
    expect(INSURERS.find((i) => i.insurer_id === "shriram-general")!.network_hospitals_min).toBeNull();
  });

  it("loads B1, B2 and name-only products, every one linked to a known insurer", () => {
    const ids = new Set(INSURERS.map((i) => i.insurer_id));
    expect(PRODUCTS.filter((p) => p.data_status === "partial")).toHaveLength(52);
    expect(PRODUCTS.filter((p) => p.data_status === "name_only")).toHaveLength(33);
    for (const p of PRODUCTS) expect(p.insurer_id === "*" || ids.has(p.insurer_id), p.product_id).toBe(true);
    expect(new Set(PRODUCTS.map((p) => p.product_id)).size).toBe(PRODUCTS.length);
  });

  it("loads Table C, and the engine's csr_weight table matches it", () => {
    expect(SCENARIOS.map((s) => s.scenario_id)).toEqual([
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
      "S9",
      "S10",
      "S11",
    ]);
    expect(Object.fromEntries(SCENARIOS.map((s) => [s.scenario_id, s.csr_weight]))).toEqual(CSR_WEIGHT_BY_CATEGORY);
    expect(SCENARIOS.find((s) => s.scenario_id === "S4")).toMatchObject({ room_rent: 3, ped_wait: 3, csr_weight: 0.8 });
  });
});

describe("free-text readers", () => {
  it("reads SI ranges", () => {
    expect(readSI("₹5L–2Cr")).toEqual({ min: 500000, max: 20000000 });
    expect(readSI("₹5L, ₹10L, Unlimited")).toEqual({ min: 500000, max: "unlimited" });
    expect(readSI("Up to ₹1Cr")).toEqual({ min: null, max: 10000000 });
    expect(readSI("₹50k–10L (varies)")).toEqual({ min: 50000, max: 1000000 });
    expect(readSI("Not found")).toEqual({ min: null, max: null });
  });

  it("reads waits conservatively", () => {
    expect(readMonths("3 yrs (reducible by add-on to 1–2)")).toBe(36);
    expect(readMonths("36 m (SI ≤₹5L) / 24 m (≥₹7.5L)")).toBe(36);
    expect(readMonths("90 days (diabetes, BP, cardiac); 24 m; 36 m (joints, mental illness)")).toBe(36);
    expect(readMonths("0 (optional 24 m for a discount)")).toBe(24);
    expect(readMonths("0")).toBe(0);
    expect(readMonths("Not found")).toBeNull();
  });

  it("reads bonus rules", () => {
    expect(readBonus("50% guaranteed / 100%; Cumulative Bonus Super add-on 100% / 500%")).toEqual({
      pct: 50,
      max: 100,
      reduces: false,
    });
    expect(readBonus("50% / 100%; reduces 50% on claim")).toEqual({ pct: 50, max: 100, reduces: true });
    expect(readBonus('"Gullak" 100% guaranteed / 1,500% (older wording 1,000%)')).toEqual({
      pct: 100,
      max: 1500,
      reduces: false,
    });
    expect(readBonus("No NCB")).toEqual({ pct: 0, max: 0, reduces: false });
  });

  it("caps the New India 48-month PED figure at the 36-month regulatory maximum", () => {
    expect(product("new-india-floater-mediclaim").ped_wait_months).toBe(36);
  });
});

describe("presetFromProduct", () => {
  it("fills a modern plan's known terms (Care Supreme)", () => {
    const p = presetFromProduct(product("care-health-care-supreme"), input({ sum_insured: 1000000 }));
    expect(PolicySchema.parse(p)).toBeTruthy();
    expect(p).toMatchObject({
      insurer_id: "care-health",
      uin: "CHIHLIP27061V032627",
      data_status: "aggregator",
      room_rent: { rule: "no_cap" },
      copay: [],
      consumables_covered: false, // add-on, not bought by default
      bonus_rule: { pct_per_year: 50, max_pct: 100, reduces_on_claim: false },
      restoration: { type: "unlimited", same_illness: true },
      pre_post_days: { pre: 60, post: 180 },
      waiting_periods: { initial_days: 30, specific_months: 24, ped_months: 36 },
      maternity: { covered: false },
    });
    expect(p.unknown_fields).toEqual(["sublimits"]);
  });

  it("fills a legacy plan's caps (New India Floater Mediclaim)", () => {
    const p = presetFromProduct(
      product("new-india-floater-mediclaim"),
      input({ holder_relationship: "parents_floater" }),
    );
    expect(p.policy_type).toBe("family_floater");
    expect(p.room_rent).toMatchObject({
      rule: "pct_si_per_day",
      value: 1,
      icu_value: 2,
      proportionate_deduction: true,
    });
    expect(p.bonus_rule).toEqual({ pct_per_year: 25, max_pct: 50, reduces_on_claim: true });
    expect(p.unknown_fields).toEqual(
      expect.arrayContaining(["consumables_covered", "pre_post_days.pre", "restoration"]),
    );
  });

  it("needs an insurer for Arogya Sanjeevani and reads its capped room rule", () => {
    expect(() => presetFromProduct(product("arogya-sanjeevani"), input())).toThrow(/choose one/);
    const p = presetFromProduct(product("arogya-sanjeevani"), input({ insurer_id: "new-india" }));
    expect(p.room_rent).toEqual({
      rule: "pct_si_per_day",
      value: 2,
      icu_value: 5,
      proportionate_deduction: true,
      max_per_day: 5000,
      icu_max_per_day: 10000,
    });
    expect(p.copay).toEqual([{ trigger: "all_claims", pct: 5 }]);
  });

  it("applies SI-tiered room rules (Star Health Assure)", () => {
    const star = product("star-health-star-health-assure");
    expect(presetFromProduct(star, input({ sum_insured: 500000 })).room_rent.rule).toBe("pct_si_per_day");
    expect(presetFromProduct(star, input({ sum_insured: 1500000 })).room_rent.rule).toBe("any_except_suite");
    expect(presetFromProduct(star, input({ sum_insured: 5000000 })).room_rent.rule).toBe("no_cap");
    expect(presetFromProduct(star, input()).copay).toEqual([{ trigger: "age_at_entry", pct: 10, age_threshold: 61 }]);
  });

  it("reads senior co-pays and short PED waits (Red Carpet)", () => {
    const p = presetFromProduct(product("star-health-senior-citizens-red-carpet"), input());
    expect(p.copay).toEqual([{ trigger: "all_claims", pct: 30 }]);
    expect(p.waiting_periods.ped_months).toBe(12);
    expect(p.unknown_fields).toContain("room_rent");
  });

  it("builds fixed benefits for critical-illness plans", () => {
    const p = presetFromProduct(product("niva-bupa-criticare"), input({ sum_insured: 1000000 }));
    expect(p.indemnity).toBe(false);
    expect(p.fixed_benefits).toEqual([
      { event: "Cancer", amount: 1000000, survival_days: 30 },
      { event: "Heart attack", amount: 1000000, survival_days: 30 },
      { event: "Stroke", amount: 1000000, survival_days: 30 },
    ]);
  });

  it("asks for a super top-up's deductible", () => {
    const stu = product("care-health-care-supreme-enhance");
    expect(presetFromProduct(stu, input()).unknown_fields).toContain("deductible.amount");
    const set = presetFromProduct(stu, input({ deductible_amount: 500000, sum_insured: 4500000 }));
    expect(set.deductible).toEqual({ amount: 500000, type: "aggregate" });
  });

  it("makes every product a valid Policy", () => {
    for (const p of PRODUCTS) {
      const pol = presetFromProduct(p, input({ insurer_id: "new-india", deductible_amount: 300000 }));
      expect(() => PolicySchema.parse(pol), p.product_id).not.toThrow();
    }
  });

  it("runs through the engine: legacy PSU plan vs a modern plan on the TC1 bill", () => {
    const legacy = presetFromProduct(product("new-india-floater-mediclaim"), input({ policy_id: "legacy" }));
    const modern = presetFromProduct(product("care-health-care-supreme"), input({ policy_id: "modern" }));
    const s: ClaimScenario = {
      scenario_id: "x",
      claimant: "Asha",
      category: "S4",
      is_ped: false,
      is_accident: false,
      admission_date: "2026-10-01",
      hospital: { id: null, city_tier: "metro", in_network_by_insurer: {}, abroad: false },
      room_rate_per_day: 8000,
      bill_items: [
        { head: "room", amount: 32000, room_linked: true },
        { head: "doctor", amount: 40000, room_linked: true },
        { head: "medicines", amount: 80000, room_linked: false },
        { head: "consumables", amount: 25000, room_linked: false },
      ],
      pre_hosp_amount: 0,
      post_hosp_amount: 0,
    };
    const plan = allocateClaim([legacy, modern], s, INSURERS);
    expect(plan.indemnity_paid).toBe(152000); // consumables (an add-on on Care Supreme) aren't paid by either
    expect(plan.out_of_pocket).toBe(25000);
  });
});
