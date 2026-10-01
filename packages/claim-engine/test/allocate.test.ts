import { describe, expect, it } from "vitest";
import { allocateClaim, explainPlan, policyNames, type Catalogue, en } from "../src/index.js";
import { byCode, group, INSURERS, policy, scale, scenario, SHARED_BILL } from "./fixtures.js";

const legacyGroup = (over: Parameters<typeof group>[0]) =>
  group({
    room_rent: { rule: "pct_si_per_day", value: 1, icu_value: null, proportionate_deduction: true },
    ...over,
  });
const net = (map: Record<string, boolean>) => ({
  id: null,
  city_tier: "metro" as const,
  in_network_by_insurer: map,
  abroad: false,
});

describe("cascade and explanation", () => {
  it("a second policy picks up what the first disallowed plus the balance above its SI", () => {
    // group SI ₹1.5L with a ₹1,500/day cap; ReAssure has no cap
    const g = legacyGroup({ policy_id: "g", sum_insured: 150000 });
    const reassure = policy({ policy_id: "r", label: "ReAssure", insurer_id: "niva-bupa", sum_insured: 1000000 });
    const plan = allocateClaim([reassure, g], scenario(), INSURERS);

    expect(plan.allocation.map((a) => a.policy_id)).toEqual(["g", "r"]);
    const [first, second] = plan.allocation;
    expect(first!.deductions.map((d) => [d.code, d.amount])).toEqual([
      ["room_proportionate", 130000],
      ["above_si", 20000],
    ]);
    expect(second!.recovered_disallowed).toBeGreaterThan(0);
    expect(second!.recovered_balance).toBeGreaterThan(0);
    expect(second!.recovered_disallowed + second!.recovered_balance).toBe(second!.payout);
    expect(plan.out_of_pocket).toBe(0);
    expect(plan.explanation_sentences[0]).toBe("Your employer policy pays ₹1.5L (its room cap costs you ₹1.3L).");
    expect(plan.explanation_sentences[1]).toBe("Your ReAssure pays the ₹1.3L plus the ₹20k balance.");
    expect(plan.explanation_sentences.at(-1)).toBe("You pay nothing.");
    expect(byCode(plan.warnings, "contribution_clause")).toBeDefined();
    expect(byCode(plan.warnings, "second_by_reimbursement")).toBeDefined();
    expect(plan.allocation[1]!.mode).toBe("reimbursement");
  });

  it("names only the disallowed part when the first policy's SI was enough", () => {
    const g = legacyGroup({
      policy_id: "g",
      sum_insured: 500000,
      consumables_covered: false,
      copay: [{ trigger: "all_claims", pct: 5 }],
    });
    const own = policy({ policy_id: "own", sum_insured: 1000000 });
    const plan = allocateClaim([g, own], scenario(), INSURERS);
    expect(plan.allocation.map((a) => [a.policy_id, a.payout])).toEqual([
      ["g", 204250],
      ["own", 95750],
    ]);
    expect(plan.explanation_sentences[0]).toBe(
      "Your employer policy pays ₹2L (its room cap, consumables exclusion and co-pay cost you ₹96k).",
    );
    expect(plan.explanation_sentences[1]).toBe("Your own policy pays the ₹96k that your employer policy didn't.");
  });

  it("lists a policy whose terms allow nothing of the remainder as untouched", () => {
    const g = group({ policy_id: "g", consumables_covered: false });
    const strict = policy({ policy_id: "s", consumables_covered: false });
    const plan = allocateClaim([g, strict], scenario(), INSURERS);
    expect(plan.untouched).toEqual([
      {
        policy_id: "s",
        reasons: [{ code: "nothing_admissible", params: {}, text: "Its terms allow nothing of what is left" }],
      },
    ]);
    expect(plan.out_of_pocket).toBe(25000);
    expect(plan.explanation_sentences.at(-1)).toBe("You pay ₹25k.");
  });

  it("says so when no policy can pay", () => {
    const plan = allocateClaim([policy({ policy_id: "p", permanent_exclusions: ["S4"] })], scenario(), INSURERS);
    expect(plan.headline).toBe("None of your policies can pay this claim.");
    expect(plan.allocation).toEqual([]);
    expect(plan.out_of_pocket).toBe(300000);
    expect(plan.why_this_order[0]!.text).toBe("Your own policy can't pay: this treatment is permanently excluded.");
  });

  it("re-renders a plan with another catalogue", () => {
    const plan = allocateClaim([group({ policy_id: "g" })], scenario(), INSURERS);
    const shout: Catalogue = { headline: (p) => `FIRST: ${String(p.name)}` };
    const names = policyNames([group({ policy_id: "g" })], new Map(), en);
    expect(explainPlan(plan, names, shout).headline).toBe("FIRST: your employer policy");
    expect(explainPlan(plan, new Map(), en).headline).toBe("Claim from your g first.");
  });
});

describe("ranking reasons", () => {
  it("explains a group primary with no bonus at stake", () => {
    const plan = allocateClaim([group({ policy_id: "g" })], scenario(), INSURERS);
    expect(byCode(plan.why_this_order, "group_no_bonus")!.text).toBe(
      "Your employer policy has no personal bonus to lose, and claims on it don't raise your own renewal premium.",
    );
  });

  it("explains a higher payout on the policy's own terms", () => {
    const legacy = legacyGroup({ policy_id: "g", holder_relationship: "self", policy_type: "individual" });
    const modern = policy({ policy_id: "m", label: "Optima Secure", sum_insured: 1000000 });
    const plan = allocateClaim([legacy, modern], scenario(), INSURERS);
    expect(plan.allocation[0]!.policy_id).toBe("m");
    expect(byCode(plan.why_this_order, "pays_more")!.text).toBe(
      "Your Optima Secure pays ₹60k more than your own policy on this bill under its own terms.",
    );
    expect(byCode(plan.why_this_order, "fewer_claims")).toBeDefined();
    expect(byCode(plan.why_this_order, "default_order")).toBeUndefined();
  });

  it("notes the bonus cut when only a reducing-bonus policy can pay", () => {
    const a = policy({
      policy_id: "a",
      sum_insured: 1000000,
      bonus_accrued: 100000,
      bonus_rule: { pct_per_year: 10, max_pct: 100, reduces_on_claim: true },
    });
    const plan = allocateClaim([a], scenario(), INSURERS);
    expect(byCode(plan.why_this_order, "bonus_reduced")!.text).toBe(
      "Claiming your own policy cuts its bonus by about ₹2L of cover.",
    );
    expect(byCode(plan.why_this_order, "bonus_not_reduced")).toBeUndefined();
  });

  it("uses a parents' floater last, for the balance only", () => {
    const g = group({ policy_id: "g", sum_insured: 500000 });
    const parents = policy({
      policy_id: "pf",
      holder_relationship: "parents_floater",
      policy_type: "family_floater",
      sum_insured: 1000000,
    });
    const plan = allocateClaim(
      [parents, g],
      scenario({ bill_items: scale(SHARED_BILL, 3), room_rate_per_day: 24000 }),
      INSURERS,
    );
    expect(plan.allocation.map((a) => [a.policy_id, a.payout])).toEqual([
      ["g", 500000],
      ["pf", 400000],
    ]);
    expect(byCode(plan.why_this_order, "floater_last")!.text).toBe(
      "Your parents' floater is used last because its cover is shared with other members.",
    );
  });
});

describe("materiality tolerance (DECISIONS E5)", () => {
  const extra = [
    {
      ...INSURERS[0]!,
      insurer_id: "icici-lombard",
      insurer_name: "ICICI Lombard General Insurance",
      insurer_type: "PVT_GI" as const,
      csr_fy24: 84.83,
      csr_fy25: 83.65,
      csr_fy26: 91.96,
      csr_3yr_avg: 86.81,
      complaints_per_10k_fy26: 20.64,
      complaints_3yr_avg: 15.05,
    },
    {
      ...INSURERS[0]!,
      insurer_id: "navi-general",
      insurer_name: "Navi General Insurance",
      insurer_type: "PVT_GI" as const,
      csr_fy24: 63.49,
      csr_fy25: 80.39,
      csr_fy26: 95.58,
      csr_3yr_avg: 79.82,
      complaints_per_10k_fy26: 42.56,
      complaints_3yr_avg: 220.47,
    },
  ];
  const all = [...INSURERS, ...extra];

  it("keeps the default order when claim records are close (ICICI Lombard group vs Niva Bupa own)", () => {
    const g = legacyGroup({ policy_id: "g", insurer_id: "icici-lombard", consumables_covered: false });
    const own = policy({ policy_id: "own", insurer_id: "niva-bupa", sum_insured: 1000000 });
    const plan = allocateClaim([own, g], scenario(), all);
    expect(plan.allocation.map((a) => a.policy_id)).toEqual(["g", "own"]);
    expect(plan.indemnity_paid).toBe(300000);
    expect(byCode(plan.why_this_order, "default_order")).toBeDefined();
  });

  it("between same-tier policies inside the tolerance, the stronger record goes first", () => {
    const a = policy({ policy_id: "a", insurer_id: "icici-lombard" });
    const b = policy({ policy_id: "b", insurer_id: "niva-bupa" });
    expect(allocateClaim([a, b], scenario(), all).allocation.map((x) => x.policy_id)).toEqual(["b"]);
  });

  it("a large gap in claim record still overrides the default order", () => {
    const g = group({ policy_id: "g", insurer_id: "navi-general" });
    const own = policy({ policy_id: "own", insurer_id: "hdfc-ergo", sum_insured: 1000000 });
    const plan = allocateClaim([g, own], scenario(), all);
    expect(plan.allocation[0]!.policy_id).toBe("own");
    expect(byCode(plan.why_this_order, "stronger_record")).toBeDefined();
  });

  it("can be switched off to rank purely by score", () => {
    const g = legacyGroup({ policy_id: "g", insurer_id: "icici-lombard", consumables_covered: false });
    const own = policy({ policy_id: "own", insurer_id: "niva-bupa", sum_insured: 1000000 });
    expect(allocateClaim([own, g], scenario(), all, { tie_tolerance: 0 }).allocation[0]!.policy_id).toBe("own");
  });
});

describe("modes and warnings", () => {
  it("claims cashless when the hospital is in the primary's network", () => {
    const plan = allocateClaim(
      [group({ policy_id: "g" })],
      scenario({ hospital: net({ "hdfc-ergo": true }) }),
      INSURERS,
    );
    expect(plan.allocation[0]!.mode).toBe("cashless");
    expect(plan.warnings).toEqual([]);
  });

  it("falls back to reimbursement outside the network", () => {
    const plan = allocateClaim(
      [group({ policy_id: "g" })],
      scenario({ hospital: net({ "hdfc-ergo": false }) }),
      INSURERS,
    );
    expect(plan.allocation[0]!.mode).toBe("reimbursement");
    expect(byCode(plan.warnings, "non_network")!.text).toBe(
      "This hospital is outside HDFC ERGO's network, so expect to pay first and claim reimbursement.",
    );
  });

  it("warns when the network is unknown", () => {
    const plan = allocateClaim([group({ policy_id: "g" })], scenario(), INSURERS);
    expect(plan.allocation[0]!.mode).toBe("cashless");
    expect(byCode(plan.warnings, "network_unknown")).toBeDefined();
  });

  it("warns about room categories, renewals, restoration, entry age and new insurers", () => {
    const p = policy({
      policy_id: "p",
      insurer_id: "galaxy-health",
      room_rent: { rule: "single_pvt_ac", value: null, icu_value: null, proportionate_deduction: true },
      renewal_date: "2026-09-30",
      si_used_this_year: 450000,
      restoration: { type: "once", same_illness: false, first_claim_eligible: false },
      copay: [{ trigger: "age_at_entry", pct: 20 }],
    });
    const q = policy({
      policy_id: "q",
      room_rent: { rule: "any_except_suite", value: null, icu_value: null, proportionate_deduction: true },
    });
    const plan = allocateClaim(
      [p, q],
      scenario({ bill_items: scale(SHARED_BILL, 3), room_rate_per_day: 24000 }),
      INSURERS,
    );
    const texts = plan.warnings.map((w) => w.code);
    expect(texts).toEqual(
      expect.arrayContaining([
        "restoration_same_illness",
        "renewal_before_admission",
        "age_unknown",
        "room_category",
        "insufficient_history",
      ]),
    );
    expect(byCode(plan.warnings, "age_unknown")!.text).toMatch(
      /^Your own policy \(Galaxy Health & Allied\) has an entry-age co-pay/,
    );
    expect(plan.warnings.filter((w) => w.code === "room_category").map((w) => w.text)).toEqual([
      "Your own policy (HDFC ERGO) pays in full only for any room except a suite. A costlier room can lead to deductions.",
      "Your own policy (Galaxy Health & Allied) pays in full only for a single private AC room. A costlier room can lead to deductions.",
    ]);
  });

  it("does not warn about restoration that covers the same illness", () => {
    const p = policy({
      policy_id: "p",
      si_used_this_year: 100000,
      restoration: { type: "once", same_illness: true, first_claim_eligible: true },
    });
    expect(byCode(allocateClaim([p], scenario(), INSURERS).warnings, "restoration_same_illness")).toBeUndefined();
  });
});

describe("fixed benefits in the plan", () => {
  it("lists survival conditions and rejects benefits that don't match", () => {
    const ci = policy({
      policy_id: "ci",
      indemnity: false,
      policy_type: "critical_illness",
      fixed_benefits: [{ event: "Heart attack", amount: 500000, survival_days: 30 }],
    });
    const plan = allocateClaim([ci], scenario({ category: "S4" }), INSURERS);
    expect(plan.fixed_benefits[0]!.conditions.map((c) => c.text)).toEqual([
      "Paid if the survival period of 30 days is met",
      "Claim this separately; it pays whatever the other policies pay",
    ]);
    expect(plan.allocation).toEqual([]);

    const dengue = allocateClaim([ci], scenario({ category: "S3" }), INSURERS);
    expect(dengue.ineligible[0]!.reasons[0]!.code).toBe("fixed_benefit_no_match");
    expect(dengue.why_this_order).toEqual([]);
    expect(dengue.explanation).toBe("You pay ₹3L.");
  });
});

describe("search", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => policy({ policy_id: `p${i}`, sum_insured: 50000 + i * 1000, label: `P${i}` }));

  it("falls back to greedy ordering above the exhaustive limit", () => {
    const plan = allocateClaim(many(9), scenario(), INSURERS);
    expect(plan.allocation[0]!.policy_id).toBe("p8");
    expect(plan.indemnity_paid).toBe(300000);
  });

  it("can be forced to greedy and still respects default order on ties", () => {
    const plan = allocateClaim([policy({ policy_id: "own" }), group({ policy_id: "g" })], scenario(), INSURERS, {
      max_exhaustive: 1,
    });
    expect(plan.allocation[0]!.policy_id).toBe("g");
  });

  it("orders more than three top-ups by default rank", () => {
    const stu = (id: string) =>
      policy({
        policy_id: id,
        policy_type: "super_top_up",
        sum_insured: 100000,
        deductible: { amount: 100000, type: "aggregate" },
      });
    const tu = policy({
      policy_id: "tu",
      policy_type: "top_up",
      sum_insured: 100000,
      deductible: { amount: 100000, type: "per_claim" },
    });
    const plan = allocateClaim(
      [stu("s1"), stu("s2"), stu("s3"), tu, group({ policy_id: "g", sum_insured: 100000 })],
      scenario(),
      INSURERS,
    );
    expect(plan.allocation.map((a) => a.policy_id)).toEqual(["g", "tu", "s1"]);
  });

  it("honours weight overrides and can skip validation", () => {
    const ps = [policy({ policy_id: "star", insurer_id: "star-health" }), policy({ policy_id: "hdfc" })];
    const plan = allocateClaim(ps, scenario(), INSURERS, { csr_weight_by_category: { S4: 0 } }, { validate: false });
    expect(plan.allocation[0]!.policy_id).toBe("hdfc");
    expect(() => allocateClaim([{ ...ps[0]!, sum_insured: -1 }], scenario(), INSURERS)).toThrow();
  });
});
