import type { HolderRelationship, Policy, PolicyType, Product } from "@stacked/claim-engine";

/** What the user enters on top of a preset. */
export interface PresetInput {
  policy_id: string;
  holder_relationship: HolderRelationship;
  insurer_id?: string; // required for products sold by every insurer (Arogya Sanjeevani)
  sum_insured: number | "unlimited";
  members: Policy["members"];
  continuity_start: string;
  renewal_date: string;
  deductible_amount?: number; // top-ups and super top-ups
}

const FIXED_TYPES = new Set<PolicyType>(["critical_illness", "hospital_cash", "personal_accident"]);
const L = 1e5;

/** Products whose room rule depends on SI or variant; the doc states the tiers in prose. */
function tieredRoom(p: Product, si: number): Policy["room_rent"] | null {
  const pct = (value: number, icu: number | null = null): Policy["room_rent"] => ({
    rule: "pct_si_per_day",
    value,
    icu_value: icu,
    proportionate_deduction: true,
  });
  const rule = (r: Policy["room_rent"]["rule"]): Policy["room_rent"] => ({
    rule: r,
    value: null,
    icu_value: null,
    proportionate_deduction: true,
  });
  switch (p.product_id) {
    case "star-health-star-health-assure": // 1% at ₹5L; any room except suite at ₹10–25L; no limit from ₹50L
      return si >= 50 * L ? rule("no_cap") : si >= 10 * L ? rule("any_except_suite") : pct(1);
    case "bajaj-general-my-health-care": // single private AC (₹3–10L); actuals above ₹10L
      return si > 10 * L ? rule("no_cap") : rule("single_pvt_ac");
    case "bajaj-general-health-guard": // Silver 1%; Gold/Platinum single AC to ₹7.5L, any room ₹10L+ — Silver assumed
      return pct(1);
    default:
      return null;
  }
}

function roomRent(p: Product, si: number, unknown: string[]): Policy["room_rent"] {
  const tiered = tieredRoom(p, si);
  if (tiered) {
    if (p.product_id === "bajaj-general-health-guard") unknown.push("room_rent");
    return tiered;
  }
  const base = { value: null, icu_value: null, proportionate_deduction: true };
  switch (p.room_rent_rule) {
    case "NO_CAP":
      return { ...base, rule: "no_cap", proportionate_deduction: false };
    case "SINGLE_PVT_AC":
      return { ...base, rule: "single_pvt_ac" };
    case "ANY_EXCEPT_SUITE":
      return { ...base, rule: "any_except_suite" };
    case "PCT_SI": {
      const [room = "", icu = ""] = (p.room_rent_value ?? "").split(";");
      const n = (t: string, re: RegExp) => {
        const m = t.match(re);
        return m ? Number(m[1]!.replace(/,/g, "")) : null;
      };
      const icuText = /icu/i.test(icu) ? icu : (p.room_rent_value ?? "");
      return {
        rule: "pct_si_per_day",
        value: n(room, /(\d+(?:\.\d+)?)% of SI/i),
        icu_value: n(icuText, /ICU\s*(\d+(?:\.\d+)?)%/i),
        proportionate_deduction: true,
        max_per_day: n(room, /max ₹([\d,]+)/i),
        icu_max_per_day: n(icu, /max ₹([\d,]+)/i),
      };
    }
    case "CATEGORY":
      unknown.push("room_rent.value");
      return { ...base, rule: "category" };
    default:
      unknown.push("room_rent");
      return { ...base, rule: "no_cap", proportionate_deduction: false };
  }
}

function copay(p: Product, unknown: string[]): Policy["copay"] {
  const rule = p.copay_rule;
  if (!rule) {
    unknown.push("copay");
    return [];
  }
  const all = rule.match(/(\d+)% on all claims/i);
  if (all) return [{ trigger: "all_claims", pct: Number(all[1]) }];
  const age = rule.match(/(\d+)% (?:if entry age ≥\s*|at entry age )(\d+)/i);
  if (age) return [{ trigger: "age_at_entry", pct: Number(age[1]), age_threshold: Number(age[2]) }];
  if (/^(none|0%)/i.test(rule) || /^proportionate/i.test(rule)) return [];
  unknown.push("copay");
  return [];
}

function restoration(text: string | null, unknown: string[]): Policy["restoration"] {
  if (!text) {
    unknown.push("restoration");
    return { type: "none", same_illness: false, first_claim_eligible: false };
  }
  const t = text.toLowerCase();
  const type = /^none/.test(t) ? "none" : /unlimited/.test(t) ? "unlimited" : "once";
  return {
    type,
    same_illness: /same or different|same illness included|any illness|related and unrelated/.test(t),
    first_claim_eligible: !/not for first claim|not on first claim|from 2nd claim|after first paid claim/.test(t),
  };
}

function maternity(text: string | null, unknown: string[]): { cover: Policy["maternity"]; months: number | null } {
  const none = { covered: false, limit_normal: null, limit_csection: null, newborn_day1: false };
  if (!text) {
    unknown.push("maternity");
    return { cover: none, months: null };
  }
  const t = text.toLowerCase();
  if (/^not |add-on| only|^vip/.test(t)) return { cover: none, months: null };
  const k = (re: RegExp) => {
    const m = text.match(re);
    return m ? Number(m[1]) * 1000 : null;
  };
  const months = text.match(/(\d+)[- ]?(?:m\b|month)/i);
  const years = text.match(/(\d+)[- ]?yr/i);
  return {
    cover: {
      covered: true,
      limit_normal: k(/₹(\d+)k(?: normal)?/i),
      limit_csection: k(/₹(\d+)k C-section/i),
      newborn_day1: /newborn from day 1/i.test(text),
    },
    months: months ? Number(months[1]) : years ? Number(years[1]) * 12 : null,
  };
}

function fixedBenefits(p: Product, si: number): Policy["fixed_benefits"] {
  const name = p.product_name.toLowerCase();
  const survival = p.known_features?.match(/(\d+)-day survival/i);
  const survival_days = survival ? Number(survival[1]) : null;
  const events = /cancer/.test(name)
    ? ["Cancer"]
    : /heart|cardiac/.test(name)
      ? ["Heart attack"]
      : ["Cancer", "Heart attack", "Stroke"];
  return events.map((event) => ({ event, amount: si, survival_days }));
}

/**
 * Builds a full Policy from a product preset and what the user enters.
 * Every field the product data doesn't state gets a conservative default and
 * is listed in `unknown_fields`, so the UI can show "Not known" and the engine
 * still runs. Sub-limits are never in the data, so they are always unknown.
 */
export function presetFromProduct(p: Product, input: PresetInput): Policy {
  const unknown: string[] = ["sublimits"];
  const si = input.sum_insured === "unlimited" ? Infinity : input.sum_insured;
  const type: PolicyType = p.product_type ?? "individual";
  const indemnity = !FIXED_TYPES.has(type);
  const insurer_id = p.insurer_id === "*" ? input.insurer_id : p.insurer_id;
  if (!insurer_id) throw new Error(`${p.product_name} is sold by every insurer; choose one`);

  const need = <T>(v: T | null, field: string, fallback: T): T => {
    if (v == null) {
      unknown.push(field);
      return fallback;
    }
    return v;
  };

  const mat = maternity(p.maternity, unknown);
  const isTop = type === "top_up" || type === "super_top_up";
  const deductibleAmount = isTop ? need(input.deductible_amount ?? null, "deductible.amount", 0) : 0;

  const policy: Policy = {
    policy_id: input.policy_id,
    holder_relationship: input.holder_relationship,
    insurer_id,
    product_id: p.product_id,
    uin: p.uin,
    policy_type: type,
    indemnity,
    members: input.members,
    sum_insured: input.sum_insured,
    bonus_accrued: 0,
    bonus_rule: {
      pct_per_year: need(p.bonus_pct_per_year, "bonus_rule.pct_per_year", 0),
      max_pct: need(p.bonus_max_pct, "bonus_rule.max_pct", 0),
      reduces_on_claim: need(p.bonus_reduces_on_claim, "bonus_rule.reduces_on_claim", true),
    },
    restoration: restoration(p.restoration, unknown),
    si_used_this_year: 0,
    deductible: {
      amount: deductibleAmount,
      type: type === "super_top_up" ? "aggregate" : type === "top_up" ? "per_claim" : "none",
    },
    room_rent: indemnity
      ? roomRent(p, si, unknown)
      : { rule: "no_cap", value: null, icu_value: null, proportionate_deduction: false },
    copay: indemnity ? copay(p, unknown) : [],
    waiting_periods: {
      initial_days: 30,
      specific_months: need(p.specific_wait_months, "waiting_periods.specific_months", 24),
      ped_months: need(p.ped_wait_months, "waiting_periods.ped_months", 36),
      maternity_months: mat.months,
      continuity_start: input.continuity_start,
    },
    sublimits: [],
    pre_post_days: {
      pre: need(p.pre_days, "pre_post_days.pre", 30),
      post: need(p.post_days, "pre_post_days.post", 60),
    },
    consumables_covered: need(p.consumables, "consumables_covered", "NO") === "BUILT_IN",
    maternity: mat.cover,
    international_cover: /global/i.test(p.product_name),
    fixed_benefits: indemnity ? [] : fixedBenefits(p, si),
    renewal_date: input.renewal_date,
    data_status: "aggregator",
    label: p.product_name,
    source_url: p.source_url,
    as_of: p.as_of,
  };
  policy.unknown_fields = [...new Set(unknown)];
  return policy;
}
