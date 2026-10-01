import { describe, expect, it } from "vitest";
import { allocateClaim } from "../src/index.js";
import { byCode, group, INSURERS, policy, scale, scenario, SHARED_BILL } from "./fixtures.js";

/** Section 8.1 — must pass before any UI. */
describe("Section 8.1 test cases", () => {
  it("TC1 — legacy plan: proportionate room cut, consumables, 5% co-pay", () => {
    const legacy = policy({
      policy_id: "legacy",
      sum_insured: 500000,
      room_rent: { rule: "pct_si_per_day", value: 1, icu_value: 2, proportionate_deduction: true },
      consumables_covered: false,
      copay: [{ trigger: "all_claims", pct: 5 }],
    });
    const plan = allocateClaim([legacy], scenario(), INSURERS);
    const a = plan.allocation[0]!;

    expect(plan.total_bill).toBe(300000);
    expect(a.payout).toBe(204250);
    expect(a.deductions.map((d) => [d.code, d.amount])).toEqual([
      ["room_proportionate", 60000],
      ["consumables_not_covered", 25000],
      ["copay_all_claims", 10750],
    ]);
    expect(a.deductions[0]!.reason).toBe("Room rent above 1% cap — proportionate cut");
    expect(a.deductions[1]!.reason).toBe("Consumables not covered");
    expect(a.deductions[2]!.reason).toBe("Co-pay 5%");
    expect(plan.out_of_pocket).toBe(95750);
  });

  it("TC2 — modern plan: same bill paid in full", () => {
    const modern = policy({ policy_id: "modern", sum_insured: 500000 });
    const plan = allocateClaim([modern], scenario(), INSURERS);
    expect(plan.allocation[0]!.payout).toBe(300000);
    expect(plan.allocation[0]!.deductions).toEqual([]);
    expect(plan.out_of_pocket).toBe(0);
  });

  it("TC3 — cascade above SI: group → own → parents untouched", () => {
    const g = group({ policy_id: "group", sum_insured: 500000 });
    const own = policy({ policy_id: "own", sum_insured: 1000000 });
    const parents = policy({
      policy_id: "parents",
      holder_relationship: "parents_floater",
      policy_type: "family_floater",
      sum_insured: 1000000,
      members: [
        { name: "Asha", dob: "1994-05-10" },
        { name: "Ravi", dob: "1962-01-02" },
        { name: "Meena", dob: "1965-07-19" },
      ],
    });
    const plan = allocateClaim(
      [parents, own, g],
      scenario({ bill_items: scale(SHARED_BILL, 3), room_rate_per_day: 24000 }),
      INSURERS,
    );

    expect(plan.total_bill).toBe(900000);
    expect(plan.allocation.map((a) => [a.policy_id, a.payout])).toEqual([
      ["group", 500000],
      ["own", 400000],
    ]);
    expect(plan.untouched.map((u) => u.policy_id)).toEqual(["parents"]);
    expect(plan.out_of_pocket).toBe(0);
    expect(plan.allocation[1]!.recovered_balance).toBe(400000);
    expect(byCode(plan.why_this_order, "floater_untouched")).toBeDefined();
    expect(byCode(plan.why_this_order, "default_order")).toBeDefined();
    expect(plan.headline).toBe("Claim from your employer policy first.");
    expect(plan.explanation).toContain("Your employer policy pays ₹5L.");
    expect(plan.explanation).toContain("Your own policy pays the ₹4L balance.");
    expect(plan.explanation).toContain("Your parents' floater stays untouched.");
  });

  it("TC4 — PED waiting period: own ineligible, group primary", () => {
    const own = policy({
      policy_id: "own",
      waiting_periods: {
        initial_days: 30,
        specific_months: 24,
        ped_months: 36,
        maternity_months: null,
        continuity_start: "2025-08-01",
      },
    });
    const g = group({ policy_id: "group", sum_insured: 500000 });
    const plan = allocateClaim([own, g], scenario({ category: "S7", is_ped: true }), INSURERS);

    expect(plan.allocation[0]!.policy_id).toBe("group");
    const out = plan.ineligible.find((o) => o.policy_id === "own")!;
    expect(out.reasons[0]!.code).toBe("ped_wait");
    expect(out.reasons[0]!.text).toBe("Pre-existing disease waiting period until 1 August 2028");
    expect(byCode(plan.why_this_order, "ped_only")).toBeDefined();
    expect(plan.explanation).toContain(
      "Your own policy can't pay: pre-existing disease waiting period until 1 August 2028.",
    );
  });

  it("TC5 — super top-up pays above the aggregate deductible", () => {
    const g = group({ policy_id: "group", sum_insured: 500000 });
    const stu = policy({
      policy_id: "stu",
      policy_type: "super_top_up",
      sum_insured: 2000000,
      deductible: { amount: 500000, type: "aggregate" },
    });
    const plan = allocateClaim(
      [stu, g],
      scenario({ bill_items: scale(SHARED_BILL, 3), room_rate_per_day: 24000 }),
      INSURERS,
    );

    expect(plan.allocation.map((a) => [a.policy_id, a.payout])).toEqual([
      ["group", 500000],
      ["stu", 400000],
    ]);
    expect(plan.out_of_pocket).toBe(0);
    expect(byCode(plan.why_this_order, "super_topup")!.text).toBe(
      "Your super top-up pays once this year's claims pass its ₹5L deductible.",
    );
  });

  it("TC6 — fixed benefit paid in parallel, indemnity unchanged", () => {
    const g = group({ policy_id: "group", sum_insured: 500000 });
    const own = policy({ policy_id: "own", sum_insured: 1000000 });
    const ci = policy({
      policy_id: "ci",
      policy_type: "critical_illness",
      indemnity: false,
      sum_insured: 1000000,
      waiting_periods: {
        initial_days: 90,
        specific_months: 0,
        ped_months: 0,
        maternity_months: null,
        continuity_start: "2023-01-01",
      },
      fixed_benefits: [{ event: "Cancer", amount: 1000000, survival_days: null }],
    });
    const s = scenario({ category: "S5", bill_items: scale(SHARED_BILL, 2), room_rate_per_day: 16000 });
    const without = allocateClaim([g, own], s, INSURERS);
    const withCI = allocateClaim([g, own, ci], s, INSURERS);

    expect(withCI.allocation.map((a) => [a.policy_id, a.payout])).toEqual(
      without.allocation.map((a) => [a.policy_id, a.payout]),
    );
    expect(withCI.out_of_pocket).toBe(without.out_of_pocket);
    expect(withCI.fixed_benefit_payout).toBe(1000000);
    expect(withCI.fixed_benefits[0]!.policy_id).toBe("ci");
    expect(withCI.indemnity_paid).toBe(without.indemnity_paid);
    expect(withCI.explanation).toContain("Your critical-illness policy also pays ₹10L as a lump sum.");
  });

  it("TC7 — bonus preservation: guaranteed-bonus policy ranks first", () => {
    const a = policy({
      policy_id: "A",
      label: "Plan A",
      sum_insured: 1000000,
      bonus_accrued: 200000,
      bonus_rule: { pct_per_year: 50, max_pct: 100, reduces_on_claim: true },
    });
    const b = policy({
      policy_id: "B",
      label: "Plan B",
      sum_insured: 1000000,
      bonus_accrued: 200000,
      bonus_rule: { pct_per_year: 50, max_pct: 100, reduces_on_claim: false },
    });
    const plan = allocateClaim([a, b], scenario(), INSURERS);

    expect(plan.allocation[0]!.policy_id).toBe("B");
    expect(plan.allocation).toHaveLength(1);
    const r = byCode(plan.why_this_order, "bonus_not_reduced")!;
    expect(r.text).toBe("Claiming here does not reduce your bonus.");
    expect(r.params.policy_id).toBe("B");
    expect(byCode(plan.why_this_order, "bonus_kept")!.text).toBe(
      "Your Plan A is not claimed, so its ₹2L bonus is kept.",
    );
  });

  it("TC8 — confidence: HDFC ERGO ranks above Star on the same payout", () => {
    const star = policy({ policy_id: "star", insurer_id: "star-health", sum_insured: 500000 });
    const hdfc = policy({ policy_id: "hdfc", insurer_id: "hdfc-ergo", sum_insured: 500000 });
    const plan = allocateClaim([star, hdfc], scenario(), INSURERS);

    expect(plan.allocation[0]!.policy_id).toBe("hdfc");
    const c = plan.allocation[0]!.confidence_detail;
    expect(c.text).toContain("FY24–26");
    expect(c.text).toBe(
      "Very high confidence. HDFC ERGO settled 97.6% of claims (FY24–26) with 8.9 complaints per 10,000 claims.",
    );
    expect(byCode(plan.why_this_order, "stronger_record")!.text).toBe(
      "HDFC ERGO has the stronger claim record: 97.6% of claims settled against 88.6% for Star Health & Allied (FY24–26).",
    );
  });
});
