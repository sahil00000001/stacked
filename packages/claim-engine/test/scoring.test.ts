import { describe, expect, it } from "vitest";
import {
  cashlessStatus,
  computeConfidence,
  DEFAULT_WEIGHTS,
  en,
  futureCost,
  hasInsufficientHistory,
  historyYears,
  ncbCoverLost,
  shortInsurerName,
  type InsurerMetrics,
} from "../src/index.js";
import { othersOnPolicy } from "../src/cost.js";
import { INSURERS, policy, scenario } from "./fixtures.js";

const ins = (id: string) => INSURERS.find((i) => i.insurer_id === id)!;
const conf = (id: string, over: Parameters<typeof scenario>[0] = {}, w = DEFAULT_WEIGHTS) =>
  computeConfidence(
    id,
    INSURERS.find((i) => i.insurer_id === id),
    scenario(over),
    w,
    en,
  );

describe("confidence", () => {
  it("follows the section 8 formula with csr_weight scaling", () => {
    // S4 csr_weight 0.8: a = 0.32, c = 0.16, unknown network → cashless 0.5
    const c = conf("hdfc-ergo");
    const csr = 0.9761;
    const expected = (0.32 * csr + 0.3 * csr + 0.16 * (1 - 0.0887) + 0.1 * 0.5) / (0.32 + 0.3 + 0.16 + 0.1);
    expect(c.value).toBeCloseTo(expected, 10);
    expect(c.level).toBe(5);
    expect(c.cashless).toBe(0.5);
  });

  it("uses a stated repudiation ratio when present", () => {
    const star: InsurerMetrics = { ...ins("star-health"), repudiation_ratio: 18.64 };
    const withRep = computeConfidence("star-health", star, scenario(), DEFAULT_WEIGHTS, en);
    expect(withRep.value).toBeLessThan(conf("star-health").value);
  });

  it("maps values to five levels", () => {
    const at = (v: number) => {
      const t = DEFAULT_WEIGHTS.level_thresholds;
      return v >= t[0] ? 5 : v >= t[1] ? 4 : v >= t[2] ? 3 : v >= t[3] ? 2 : 1;
    };
    for (const id of ["hdfc-ergo", "star-health", "niva-bupa", "new-india"]) {
      const c = conf(id);
      expect(c.level).toBe(at(c.value));
    }
    const strict = {
      ...DEFAULT_WEIGHTS,
      level_thresholds: [0.99, 0.98, 0.97, 0.96] as [number, number, number, number],
    };
    expect(conf("star-health", {}, strict).level).toBe(1);
    expect(conf("star-health", {}, { ...DEFAULT_WEIGHTS, level_thresholds: [0.99, 0.98, 0.97, 0.7] }).level).toBe(2);
    expect(conf("star-health", {}, { ...DEFAULT_WEIGHTS, level_thresholds: [0.99, 0.98, 0.7, 0.6] }).level).toBe(3);
    expect(conf("star-health", {}, { ...DEFAULT_WEIGHTS, level_thresholds: [0.99, 0.7, 0.6, 0.5] }).level).toBe(4);
    expect(conf("star-health").text).toMatch(/^Moderate confidence\. Star Health & Allied settled 88\.6%/);
  });

  it("caps new insurers at insufficient history", () => {
    const g = conf("galaxy-health");
    expect(historyYears(ins("galaxy-health"))).toBe(2);
    expect(hasInsufficientHistory(ins("galaxy-health"))).toBe(true);
    expect(g.level).toBe("insufficient_history");
    expect(g.value).toBeLessThanOrEqual(0.5);
    expect(g.text).toBe("Insufficient history. Galaxy Health & Allied has fewer than three years of claim data.");
    const n = conf("narayana-health");
    expect(n.level).toBe("insufficient_history");
    expect(n.csr_3yr).toBeNull();
  });

  it("handles an insurer with no data at all", () => {
    const blank: InsurerMetrics = {
      ...ins("galaxy-health"),
      csr_fy25: null,
      csr_fy26: null,
      csr_3yr_avg: null,
      complaints_per_10k_fy26: null,
    };
    expect(computeConfidence("x", blank, scenario(), DEFAULT_WEIGHTS, en).level).toBe("insufficient_history");
    const u = computeConfidence("unknown-co", undefined, scenario(), DEFAULT_WEIGHTS, en);
    expect(u.text).toBe("Insufficient history. We have no claim record for this insurer.");
    expect(u.insurer_name).toBe("unknown-co");
    expect(u.as_of).toBeNull();
  });

  it("reads cashless status from the hospital network map", () => {
    const h = (v: boolean | undefined) =>
      scenario({
        hospital: {
          id: null,
          city_tier: "metro",
          in_network_by_insurer: v === undefined ? {} : { x: v },
          abroad: false,
        },
      });
    expect(cashlessStatus("x", h(true))).toBe(1);
    expect(cashlessStatus("x", h(false))).toBe(0);
    expect(cashlessStatus("x", h(undefined))).toBe(0.5);
  });

  it("shortens insurer names", () => {
    expect(shortInsurerName("HDFC ERGO General Insurance")).toBe("HDFC ERGO");
    expect(shortInsurerName("The New India Assurance")).toBe("New India Assurance");
    expect(shortInsurerName("Bajaj General Insurance (formerly Bajaj Allianz)")).toBe("Bajaj");
    expect(shortInsurerName("National Insurance Company")).toBe("National");
    expect(shortInsurerName("Care Health Insurance")).toBe("Care");
  });
});

describe("future cost", () => {
  it("values an NCB cut only when the bonus reduces on claim", () => {
    const reducing = policy({
      policy_id: "a",
      sum_insured: 1000000,
      bonus_accrued: 200000,
      bonus_rule: { pct_per_year: 50, max_pct: 100, reduces_on_claim: true },
    });
    // cut min(2L, 5L) = 2L + next accrual forgone min(5L, 8L headroom) = 5L
    expect(ncbCoverLost(reducing)).toBe(700000);
    expect(futureCost(reducing, 100, "Asha", DEFAULT_WEIGHTS).ncb).toBeCloseTo(105000);
    expect(futureCost(reducing, 0, "Asha", DEFAULT_WEIGHTS).total).toBe(0);
    const atMax = { ...reducing, bonus_accrued: 1000000 };
    expect(ncbCoverLost(atMax)).toBe(500000);
    const flat = { ...reducing, bonus_rule: { pct_per_year: 0, max_pct: 0, reduces_on_claim: true } };
    expect(ncbCoverLost(flat)).toBe(200000);
    expect(ncbCoverLost({ ...reducing, sum_insured: "unlimited" })).toBe(0);
    expect(ncbCoverLost({ ...reducing, bonus_rule: { ...reducing.bonus_rule, reduces_on_claim: false } })).toBe(0);
  });

  it("charges floater use only when others share the cover", () => {
    const fam = policy({
      policy_id: "f",
      policy_type: "family_floater",
      members: [
        { name: "Asha", dob: "1994-01-01" },
        { name: "Kabir", dob: "2020-01-01" },
      ],
    });
    expect(othersOnPolicy(fam, "Asha")).toBe(1);
    expect(futureCost(fam, 100000, "Asha", DEFAULT_WEIGHTS).floater).toBeCloseTo(15000);
    const solo = { ...fam, members: [{ name: "Asha", dob: "1994-01-01" }] };
    expect(futureCost(solo, 100000, "Asha", DEFAULT_WEIGHTS).floater).toBe(0);
    const parents = policy({ policy_id: "p", holder_relationship: "parents_floater", policy_type: "family_floater" });
    expect(othersOnPolicy(parents, "Asha")).toBe(1);
    expect(othersOnPolicy(policy({ policy_id: "i" }), "Asha")).toBe(0);
    expect(futureCost(parents, 100000, "Asha", DEFAULT_WEIGHTS).floater).toBeCloseTo(30000);
  });

  it("applies the group renewal externality rate", () => {
    const g = policy({ policy_id: "g", holder_relationship: "employer_group", policy_type: "group" });
    expect(futureCost(g, 100000, "Asha", DEFAULT_WEIGHTS).group).toBe(0);
    expect(futureCost(g, 100000, "Asha", { ...DEFAULT_WEIGHTS, group_renewal_rate: 0.02 }).group).toBe(2000);
  });
});
