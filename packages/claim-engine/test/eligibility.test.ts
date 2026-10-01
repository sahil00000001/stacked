import { describe, expect, it } from "vitest";
import { allocateClaim, checkEligibility, coversClaimant, findMember } from "../src/index.js";
import { group, INSURERS, policy, scenario } from "./fixtures.js";

const codes = (p: Parameters<typeof checkEligibility>[0], over: Parameters<typeof scenario>[0] = {}) =>
  checkEligibility(p, scenario(over)).map((r) => r.code);

describe("eligibility", () => {
  it("matches members by id or by name, and treats an empty list as covering everyone", () => {
    const p = policy({ policy_id: "p", members: [{ name: " Asha ", dob: "1994-01-01", member_id: "m1" }] });
    expect(findMember(p, "m1")?.name).toBe(" Asha ");
    expect(findMember(p, "asha")).toBeDefined();
    expect(coversClaimant(p, "Ravi")).toBe(false);
    expect(coversClaimant(policy({ policy_id: "q" }), "Ravi")).toBe(true);
    expect(codes(p, { claimant: "Ravi" })).toEqual(["member_not_covered"]);
  });

  it("rejects treatment abroad without international cover", () => {
    const abroad = { id: null, city_tier: "metro" as const, in_network_by_insurer: {}, abroad: true };
    expect(codes(policy({ policy_id: "p" }), { hospital: abroad })).toEqual(["abroad_not_covered"]);
    expect(codes(policy({ policy_id: "p", international_cover: true }), { hospital: abroad })).toEqual([]);
  });

  it("rejects permanent exclusions", () => {
    expect(codes(policy({ policy_id: "p", permanent_exclusions: ["S4"] }))).toEqual(["permanent_exclusion"]);
  });

  it("applies the initial wait except for accidents", () => {
    const fresh = policy({
      policy_id: "p",
      waiting_periods: {
        initial_days: 30,
        specific_months: 24,
        ped_months: 36,
        maternity_months: null,
        continuity_start: "2026-09-20",
      },
    });
    expect(checkEligibility(fresh, scenario())).toEqual([{ code: "initial_wait", params: { until: "2026-10-20" } }]);
    expect(codes(fresh, { is_accident: true, category: "S2" })).toEqual([]);
  });

  it("applies the specific-disease wait to S1 by default, or when flagged", () => {
    const p = policy({
      policy_id: "p",
      waiting_periods: {
        initial_days: 30,
        specific_months: 24,
        ped_months: 36,
        maternity_months: null,
        continuity_start: "2025-06-01",
      },
    });
    expect(codes(p, { category: "S1" })).toEqual(["specific_wait"]);
    expect(codes(p, { category: "S8", is_specific_disease: true })).toEqual(["specific_wait"]);
    expect(codes(p, { category: "S1", is_specific_disease: false })).toEqual([]);
    expect(codes(p, { category: "S1", is_accident: true })).toEqual([]);
  });

  it("handles maternity cover and its wait", () => {
    expect(codes(policy({ policy_id: "p" }), { category: "S6" })).toEqual(["maternity_not_covered"]);
    const covered = (months: number | null) =>
      policy({
        policy_id: "p",
        maternity: { covered: true, limit_normal: null, limit_csection: null, newborn_day1: true },
        waiting_periods: {
          initial_days: 30,
          specific_months: 24,
          ped_months: 36,
          maternity_months: months,
          continuity_start: "2024-01-01",
        },
      });
    expect(codes(covered(36), { category: "S6" })).toEqual(["maternity_wait"]);
    expect(codes(covered(24), { category: "S6" })).toEqual([]);
    expect(codes(covered(null), { category: "S6" })).toEqual([]);
  });

  it("checks only member, exclusions and initial wait for fixed-benefit policies", () => {
    const ci = policy({
      policy_id: "ci",
      indemnity: false,
      policy_type: "critical_illness",
      waiting_periods: {
        initial_days: 90,
        specific_months: 24,
        ped_months: 48,
        maternity_months: null,
        continuity_start: "2026-08-01",
      },
    });
    expect(codes(ci, { is_ped: true, category: "S1" })).toEqual(["initial_wait"]);
  });

  it("marks a used-up policy ineligible in the plan", () => {
    const used = policy({ policy_id: "used", sum_insured: 300000, si_used_this_year: 300000 });
    const plan = allocateClaim([used, group({ policy_id: "g" })], scenario(), INSURERS);
    expect(plan.ineligible).toEqual([
      {
        policy_id: "used",
        reasons: [{ code: "si_exhausted", params: {}, text: "Sum insured is used up for this policy year" }],
      },
    ]);
  });
});
