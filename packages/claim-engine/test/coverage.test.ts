import { describe, expect, it } from "vitest";
import { allocateClaim, buildWorkItems, en, evaluatePolicy } from "../src/index.js";
import { INSURERS, policy, scenario } from "./fixtures.js";

const ALL_PARAMS = {
  cap: "1%",
  procedure: "Cataract",
  pct: 5,
  age: 61,
  amount: 120000,
  claimant: "Asha",
  until: "2027-03-14",
  days: 30,
  name: "your employer policy",
  insurer: "HDFC ERGO",
  csr: "97.6",
  other_csr: "88.6",
  other_insurer: "Star Health & Allied",
  period: "FY24–26",
  other: "your own policy",
  reason: "a reason",
  deductible: 500000,
  room: "a single private AC room",
  date: "2027-03-14",
  costs: "its room cap costs you ₹38k",
  what: "room cap",
  count: 1,
  disallowed: 38000,
  balance: 120000,
  prev: "your employer policy",
  level: "High",
  complaints: "8.9",
};

describe("message catalogue", () => {
  it("renders every English string to non-empty text without placeholders", () => {
    for (const [code, fn] of Object.entries(en)) {
      const numericCap = code === "sublimit" || code === "maternity_limit";
      const text = fn(numericCap ? { ...ALL_PARAMS, cap: 40000 } : ALL_PARAMS);
      expect(text.length, code).toBeGreaterThan(0);
      expect(text, code).not.toMatch(/undefined|NaN|\$\{/);
      // empty params must not crash strings that don't need a date
      try {
        fn({});
      } catch (e) {
        expect(e, code).toBeInstanceOf(RangeError);
      }
    }
  });
});

describe("edge paths", () => {
  it("passes evaluation warnings without a policy through to the plan", () => {
    const p = policy({
      policy_id: "p",
      room_rent: { rule: "pct_si_per_day", value: 1, icu_value: null, proportionate_deduction: true },
    });
    const plan = allocateClaim([p], scenario({ room_rate_per_day: 0 }), INSURERS);
    expect(plan.warnings[0]!.text).toBe(
      "Room rate is missing. Enter the per-day room charge so we can check the room-rent cap.",
    );
  });

  it("puts rounding drift on the largest deduction so the ledger sums exactly", () => {
    const p = policy({
      policy_id: "p",
      consumables_covered: false,
      pre_post_days: { pre: 0, post: 0 },
      room_rent: { rule: "fixed_amount", value: 4000, icu_value: null, proportionate_deduction: true },
    });
    const s = scenario({
      bill_items: [
        { head: "room", amount: 3, room_linked: true },
        { head: "consumables", amount: 4.4, room_linked: false },
      ],
      pre_hosp_amount: 0.6,
    });
    const ev = evaluatePolicy(p, s, buildWorkItems(s));
    expect(ev.presented).toBe(8);
    expect(ev.payout).toBe(2);
    expect(ev.deductions.map((d) => [d.code, d.amount])).toEqual([
      ["room_proportionate", 2],
      ["consumables_not_covered", 3],
      ["pre_hosp_not_covered", 1],
    ]);
  });
});
