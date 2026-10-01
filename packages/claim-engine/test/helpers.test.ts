import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  defaultBillSplit,
  en,
  fixedBenefitPayouts,
  formatDateLong,
  formatINR,
  formatPct,
  policyNames,
  render,
  stayDays,
  type Catalogue,
} from "../src/index.js";
import { INSURERS, policy, scenario, SHARED_BILL } from "./fixtures.js";

describe("formatINR", () => {
  it("uses Indian grouping in full form", () => {
    expect(formatINR(120000)).toBe("₹1,20,000");
    expect(formatINR(204250)).toBe("₹2,04,250");
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
  });

  it("compacts to k, L and Cr", () => {
    expect(formatINR(120000, { compact: true })).toBe("₹1.2L");
    expect(formatINR(410000, { compact: true })).toBe("₹4.1L");
    expect(formatINR(405000, { compact: true })).toBe("₹4.1L");
    expect(formatINR(500000, { compact: true })).toBe("₹5L");
    expect(formatINR(38000, { compact: true })).toBe("₹38k");
    expect(formatINR(99600, { compact: true })).toBe("₹1L");
    expect(formatINR(15000000, { compact: true })).toBe("₹1.5Cr");
    expect(formatINR(9996000, { compact: true })).toBe("₹1Cr");
    expect(formatINR(950, { compact: true })).toBe("₹950");
    expect(formatINR(-38000, { compact: true })).toBe("-₹38k");
  });

  it("formats percentages", () => {
    expect(formatPct(97.613)).toBe("97.6%");
    expect(formatPct(95, 0)).toBe("95%");
  });
});

describe("dates", () => {
  it("adds months and days on calendar dates", () => {
    expect(addMonthsISO("2025-08-01", 36)).toBe("2028-08-01");
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addDaysISO("2026-09-20", 30)).toBe("2026-10-20");
    expect(formatDateLong("2027-03-14")).toBe("14 March 2027");
  });
});

describe("defaultBillSplit", () => {
  it("reproduces the section 8.1 bill from a ₹3L total, ₹8,000 room and 4 nights", () => {
    expect(defaultBillSplit(300000, "S11", { roomRatePerDay: 8000, nights: 4 })).toEqual(SHARED_BILL);
  });

  it("sums to the total for every scenario", () => {
    for (const c of ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11"] as const) {
      const items = defaultBillSplit(123457, c);
      expect(items.reduce((t, i) => t + i.amount, 0)).toBe(123457);
      expect(items.every((i) => i.amount > 0)).toBe(true);
    }
  });

  it("caps the room line at the total and handles zero", () => {
    expect(defaultBillSplit(10000, "S3", { roomRatePerDay: 8000, nights: 4 })).toEqual([
      { head: "room", amount: 10000, room_linked: true },
    ]);
    expect(defaultBillSplit(0, "S3")).toEqual([]);
  });
});

describe("fixed benefits", () => {
  const s = scenario({ category: "S5" });

  it("matches by keyword, category id, explicit event and hospitalisation", () => {
    const p = policy({
      policy_id: "f",
      indemnity: false,
      policy_type: "critical_illness",
      fixed_benefits: [
        { event: "Cancer (all stages)", amount: 1000000, survival_days: 30 },
        { event: "S5", amount: 1, survival_days: null },
        { event: "Stroke", amount: 500000, survival_days: null },
        { event: "Hospital cash", amount: 2000, survival_days: null, per_day: true },
      ],
    });
    expect(fixedBenefitPayouts(p, s).map((f) => f.payout)).toEqual([1000000, 1, 8000]);
    expect(
      fixedBenefitPayouts(p, scenario({ category: "S3", fixed_benefit_events: ["stroke"] })).map((f) => f.event),
    ).toEqual(["Stroke", "Hospital cash"]);
  });

  it("works out the length of stay", () => {
    expect(stayDays(scenario({ length_of_stay_days: 6 }))).toBe(6);
    expect(stayDays(scenario())).toBe(4);
    expect(stayDays(scenario({ room_rate_per_day: 0 }))).toBe(1);
    expect(stayDays(scenario({ bill_items: [{ head: "medicines", amount: 5, room_linked: false }] }))).toBe(1);
  });
});

describe("names and messages", () => {
  const ins = new Map(INSURERS.map((i) => [i.insurer_id, i]));

  it("names policies by label, relationship or type, and disambiguates duplicates", () => {
    const names = policyNames(
      [
        policy({ policy_id: "a", label: "ReAssure" }),
        policy({ policy_id: "b", insurer_id: "hdfc-ergo" }),
        policy({ policy_id: "c", insurer_id: "star-health" }),
        policy({ policy_id: "d", insurer_id: "unknown-co" }),
        policy({ policy_id: "e", holder_relationship: "spouse", insurer_id: "niva-bupa" }),
        policy({ policy_id: "f", holder_relationship: "spouse", insurer_id: "niva-bupa" }),
        policy({ policy_id: "g", policy_type: "hospital_cash", indemnity: false }),
      ],
      ins,
      en,
    );
    expect([...names.values()]).toEqual([
      "ReAssure",
      "own policy (HDFC ERGO)",
      "own policy (Star Health & Allied)",
      "own policy (unknown-co)",
      "spouse's policy (Niva Bupa) 1",
      "spouse's policy (Niva Bupa) 2",
      "hospital cash policy",
    ]);
  });

  it("renders from a catalogue, falls back to English, and rejects unknown codes", () => {
    const hi: Catalogue = { above_si: () => "बीमा राशि से अधिक" };
    expect(render(hi, "above_si")).toBe("बीमा राशि से अधिक");
    expect(render(hi, "consumables_not_covered")).toBe("Consumables not covered");
    expect(() => render(en, "nope")).toThrow('No message for reason code "nope"');
    expect(render(en, "deductible")).toBe("Deductible of ₹0");
    expect(render(en, "primary_pays", { name: "x", amount: 1000 })).toBe("X pays ₹1k.");
  });
});
