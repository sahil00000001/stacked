import { describe, expect, it } from "vitest";
import {
  allocateClaim,
  availableSI,
  buildWorkItems,
  evaluatePolicy,
  icuCap,
  remainingDeductible,
  roomCap,
  type BillItem,
  type Policy,
} from "../src/index.js";
import { byCode, INSURERS, policy, scenario, SHARED_BILL } from "./fixtures.js";

const evalOn = (p: Policy, over: Parameters<typeof scenario>[0] = {}) => {
  const s = scenario(over);
  return evaluatePolicy(p, s, buildWorkItems(s));
};
const sumDed = (ds: { amount: number }[]) => ds.reduce((t, d) => t + d.amount, 0);

describe("room rent", () => {
  it("fixed rupee cap without proportionate deduction cuts only the room line", () => {
    const p = policy({
      policy_id: "p",
      room_rent: { rule: "fixed_amount", value: 4000, icu_value: null, proportionate_deduction: false },
    });
    const ev = evalOn(p);
    expect(ev.deductions).toEqual([{ code: "room_above_cap", params: { cap: "₹4,000/day" }, amount: 16000 }]);
    expect(ev.payout).toBe(284000);
  });

  it("category cap with proportionate deduction cuts every room-linked line", () => {
    const p = policy({
      policy_id: "p",
      room_rent: { rule: "category", value: 4000, icu_value: null, proportionate_deduction: true },
    });
    expect(evalOn(p).deductions[0]).toMatchObject({ code: "room_proportionate", amount: 80000 });
  });

  it("applies the per-day maximum (Arogya Sanjeevani style)", () => {
    const p = policy({
      policy_id: "p",
      room_rent: {
        rule: "pct_si_per_day",
        value: 2,
        icu_value: 5,
        proportionate_deduction: true,
        max_per_day: 5000,
        icu_max_per_day: 10000,
      },
    });
    expect(roomCap(p)).toEqual({ cap: 5000, label: "2% (max ₹5,000/day)" });
    expect(icuCap(p)).toEqual({ cap: 10000, label: "5% (max ₹10,000/day)" });
    expect(evalOn(p).deductions[0]!.params.cap).toBe("2% (max ₹5,000/day)");
  });

  it("has no rupee cap for no_cap, single_pvt_ac, missing values and unlimited SI", () => {
    expect(roomCap(policy({ policy_id: "a" }))).toBeNull();
    expect(
      roomCap(
        policy({
          policy_id: "b",
          room_rent: { rule: "single_pvt_ac", value: null, icu_value: null, proportionate_deduction: true },
        }),
      ),
    ).toBeNull();
    expect(
      roomCap(
        policy({
          policy_id: "c",
          room_rent: { rule: "fixed_amount", value: null, icu_value: null, proportionate_deduction: true },
        }),
      ),
    ).toBeNull();
    expect(
      roomCap(
        policy({
          policy_id: "d",
          sum_insured: "unlimited",
          room_rent: { rule: "pct_si_per_day", value: 1, icu_value: null, proportionate_deduction: true },
        }),
      ),
    ).toBeNull();
  });

  it("warns and skips the cap when the room rate is missing", () => {
    const p = policy({
      policy_id: "p",
      room_rent: { rule: "pct_si_per_day", value: 1, icu_value: null, proportionate_deduction: true },
    });
    const ev = evalOn(p, { room_rate_per_day: 0 });
    expect(ev.payout).toBe(300000);
    expect(ev.warnings).toEqual([{ code: "room_rate_missing", params: {} }]);
  });

  it("does not warn about a missing room rate when nothing is room-linked", () => {
    const p = policy({
      policy_id: "p",
      room_rent: { rule: "pct_si_per_day", value: 1, icu_value: null, proportionate_deduction: true },
    });
    expect(
      evalOn(p, { room_rate_per_day: 0, bill_items: [{ head: "medicines", amount: 1000, room_linked: false }] })
        .warnings,
    ).toEqual([]);
  });
});

describe("ICU", () => {
  const icuBill: BillItem[] = [{ head: "icu", amount: 60000, room_linked: true }, ...SHARED_BILL];
  const p = policy({
    policy_id: "p",
    room_rent: { rule: "fixed_amount", value: 8000, icu_value: 10000, proportionate_deduction: true },
  });

  it("caps ICU charges by the ICU rate", () => {
    const ev = evalOn(p, { bill_items: icuBill, icu_rate_per_day: 15000 });
    expect(byCode(ev.deductions, "icu_above_cap")).toMatchObject({ amount: 20000, params: { cap: "₹10,000/day" } });
  });

  it("leaves ICU alone when the ICU rate is within the cap", () => {
    expect(
      byCode(evalOn(p, { bill_items: icuBill, icu_rate_per_day: 9000 }).deductions, "icu_above_cap"),
    ).toBeUndefined();
  });

  it("warns when the ICU rate is missing", () => {
    expect(evalOn(p, { bill_items: icuBill }).warnings).toEqual([{ code: "icu_rate_missing", params: {} }]);
  });

  it("does not need an ICU rate without an ICU line", () => {
    expect(evalOn(p).warnings).toEqual([]);
  });
});

describe("pre and post hospitalisation", () => {
  it("pays pre/post amounts when the policy has the days", () => {
    expect(evalOn(policy({ policy_id: "p" }), { pre_hosp_amount: 5000, post_hosp_amount: 7000 }).payout).toBe(312000);
  });

  it("deducts them when the policy has no pre/post cover", () => {
    const p = policy({ policy_id: "p", pre_post_days: { pre: 0, post: 0 } });
    const ev = evalOn(p, { pre_hosp_amount: 5000, post_hosp_amount: 7000 });
    expect(ev.deductions.map((d) => [d.code, d.amount])).toEqual([
      ["pre_hosp_not_covered", 5000],
      ["post_hosp_not_covered", 7000],
    ]);
  });
});

describe("sub-limits and maternity limits", () => {
  it("caps by procedure name", () => {
    const p = policy({
      policy_id: "p",
      sublimits: [{ procedure: "Angioplasty", cap_amount: 150000, cap_pct_si: null }],
    });
    const ev = evalOn(p, { procedure: "angioplasty" });
    expect(ev.deductions).toEqual([
      { code: "sublimit", params: { procedure: "Angioplasty", cap: 150000 }, amount: 150000 },
    ]);
  });

  it("caps by scenario category and % of SI, taking the tighter", () => {
    const p = policy({
      policy_id: "p",
      sublimits: [
        { procedure: "S4", cap_amount: null, cap_pct_si: 40 },
        { procedure: "S4", cap_amount: 250000, cap_pct_si: null },
      ],
    });
    expect(evalOn(p).payout).toBe(200000);
  });

  it("ignores sub-limits for other procedures and caps with no figure", () => {
    const p = policy({
      policy_id: "p",
      sublimits: [
        { procedure: "Cataract", cap_amount: 40000, cap_pct_si: null },
        { procedure: "S4", cap_amount: null, cap_pct_si: null },
      ],
    });
    expect(evalOn(p).payout).toBe(300000);
  });

  it("applies the normal or C-section maternity limit", () => {
    const p = policy({
      policy_id: "p",
      maternity: { covered: true, limit_normal: 50000, limit_csection: 75000, newborn_day1: true },
    });
    expect(evalOn(p, { category: "S6" }).payout).toBe(50000);
    expect(evalOn(p, { category: "S6", delivery_type: "csection" }).payout).toBe(75000);
    expect(evalOn(p, { category: "S6" }).deductions[0]!.code).toBe("maternity_limit");
  });

  it("has no maternity cap when the limit is not known", () => {
    const p = policy({
      policy_id: "p",
      maternity: { covered: true, limit_normal: null, limit_csection: null, newborn_day1: false },
    });
    expect(evalOn(p, { category: "S6" }).payout).toBe(300000);
  });
});

describe("co-pay triggers", () => {
  const withCopay = (copay: Policy["copay"], over: Partial<Policy> = {}) => policy({ policy_id: "p", copay, ...over });

  it("voluntary co-pay always applies", () => {
    expect(evalOn(withCopay([{ trigger: "voluntary", pct: 10 }])).deductions[0]).toMatchObject({
      code: "copay_voluntary",
      amount: 30000,
    });
  });

  it("entry-age co-pay uses the member's age at continuity start", () => {
    const members = [{ name: "Asha", dob: "1958-01-01" }];
    const p = withCopay([{ trigger: "age_at_entry", pct: 20 }], { members });
    expect(evalOn(p).deductions[0]).toMatchObject({
      code: "copay_age_at_entry",
      amount: 60000,
      params: { pct: 20, age: 61 },
    });
    const young = withCopay([{ trigger: "age_at_entry", pct: 20, age_threshold: 65 }], { members });
    expect(evalOn(young).deductions).toEqual([]);
  });

  it("entry-age co-pay is skipped with a warning when the member is unknown", () => {
    const ev = evalOn(withCopay([{ trigger: "age_at_entry", pct: 20 }]));
    expect(ev.deductions).toEqual([]);
    expect(ev.warnings).toEqual([{ code: "age_unknown", params: { policy_id: "p" } }]);
  });

  it("zone co-pay applies only in a higher-cost city than the policy zone", () => {
    const p = withCopay([{ trigger: "zone", pct: 20, zone: "tier2" }]);
    expect(evalOn(p).payout).toBe(240000);
    expect(
      evalOn(p, { hospital: { id: null, city_tier: "tier2", in_network_by_insurer: {}, abroad: false } }).payout,
    ).toBe(300000);
    expect(evalOn(withCopay([{ trigger: "zone", pct: 20 }])).payout).toBe(240000);
  });

  it("non-network co-pay applies only when the hospital is known to be outside the network", () => {
    const p = withCopay([{ trigger: "non_network", pct: 10 }]);
    expect(evalOn(p).payout).toBe(300000);
    const out = { id: null, city_tier: "metro" as const, in_network_by_insurer: { "hdfc-ergo": false }, abroad: false };
    expect(evalOn(p, { hospital: out }).payout).toBe(270000);
  });

  it("room-upgrade co-pay applies when the room rate is above the cap", () => {
    const p = withCopay([{ trigger: "room_upgrade", pct: 10 }], {
      room_rent: { rule: "fixed_amount", value: 10000, icu_value: null, proportionate_deduction: false },
    });
    expect(evalOn(p).payout).toBe(300000);
    const up = evalOn(p, { room_rate_per_day: 12000 });
    // room ₹32,000 cut to 10/12 → ₹26,667; 10% co-pay on ₹2,94,667 → ₹2,65,200
    expect(up.deductions.map((d) => d.code)).toEqual(["room_above_cap", "copay_room_upgrade"]);
    expect(up.payout).toBe(265200);
  });

  it("stacks co-pays and caps the total at 100%", () => {
    const p = withCopay([
      { trigger: "all_claims", pct: 70 },
      { trigger: "voluntary", pct: 50 },
      { trigger: "all_claims", pct: 0 },
    ]);
    const ev = evalOn(p);
    expect(ev.payout).toBe(0);
    expect(sumDed(ev.deductions)).toBe(300000);
  });
});

describe("deductibles and sum insured", () => {
  it("per-claim top-up deductible", () => {
    const p = policy({
      policy_id: "p",
      policy_type: "top_up",
      sum_insured: 1000000,
      deductible: { amount: 200000, type: "per_claim" },
    });
    expect(remainingDeductible(p)).toBe(200000);
    const ev = evalOn(p);
    expect(ev.payout).toBe(100000);
    expect(ev.deductions).toEqual([{ code: "deductible", params: { amount: 200000 }, amount: 200000 }]);
  });

  it("aggregate deductible already partly met earlier in the year", () => {
    const p = policy({
      policy_id: "p",
      policy_type: "super_top_up",
      sum_insured: 1000000,
      deductible: { amount: 500000, type: "aggregate" },
      deductible_met_this_year: 350000,
    });
    expect(remainingDeductible(p)).toBe(150000);
    expect(evalOn(p).payout).toBe(150000);
    expect(remainingDeductible(policy({ policy_id: "q" }))).toBe(0);
  });

  it("caps at available SI including bonus and minus SI used", () => {
    const p = policy({ policy_id: "p", sum_insured: 200000, bonus_accrued: 50000, si_used_this_year: 100000 });
    expect(availableSI(p)).toEqual({ amount: 150000, restored: false });
    const ev = evalOn(p);
    expect(ev.payout).toBe(150000);
    expect(ev.deductions).toEqual([{ code: "above_si", params: {}, amount: 150000 }]);
  });

  it("restoration tops a used policy back to its base SI", () => {
    const p = policy({
      policy_id: "p",
      sum_insured: 500000,
      si_used_this_year: 450000,
      restoration: { type: "unlimited", same_illness: false, first_claim_eligible: false },
    });
    expect(availableSI(p)).toEqual({ amount: 500000, restored: true });
    expect(availableSI(policy({ policy_id: "q", si_used_this_year: 900000 })).amount).toBe(0);
  });

  it("unlimited SI never caps", () => {
    const p = policy({ policy_id: "p", sum_insured: "unlimited" });
    expect(availableSI(p).amount).toBe(Infinity);
    expect(evalOn(p, { bill_items: [{ head: "other", amount: 9e7, room_linked: false }] }).payout).toBe(9e7);
  });
});

describe("invariants", () => {
  const variants: Policy[] = [
    policy({
      policy_id: "a",
      room_rent: { rule: "pct_si_per_day", value: 1, icu_value: null, proportionate_deduction: true },
      copay: [{ trigger: "all_claims", pct: 7 }],
      consumables_covered: false,
    }),
    policy({ policy_id: "b", sum_insured: 120000, copay: [{ trigger: "all_claims", pct: 13 }] }),
    policy({
      policy_id: "c",
      room_rent: { rule: "fixed_amount", value: 3333, icu_value: null, proportionate_deduction: true },
      sum_insured: 250000,
    }),
    policy({
      policy_id: "d",
      holder_relationship: "parents_floater",
      policy_type: "family_floater",
      sum_insured: 333333,
    }),
  ];

  it("each ledger sums to presented − payout and the plan never pays more than the bill", () => {
    for (let k = 0; k < variants.length; k++) {
      const ps = variants.slice(0, k + 1);
      const plan = allocateClaim(ps, scenario({ room_rate_per_day: 7777 }), INSURERS);
      for (const a of plan.allocation) expect(a.presented - a.payout).toBe(sumDed(a.deductions));
      expect(plan.indemnity_paid).toBeLessThanOrEqual(plan.total_bill);
      expect(plan.indemnity_paid + plan.out_of_pocket).toBe(plan.total_bill);
      for (let i = 1; i < plan.allocation.length; i++) {
        expect(plan.allocation[i]!.presented).toBe(plan.allocation[i - 1]!.presented - plan.allocation[i - 1]!.payout);
      }
    }
  });
});
