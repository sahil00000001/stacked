import type { Policy } from "@stacked/claim-engine";
import productsJson from "../data/products.json";
import { presetFromProduct } from "./preset.js";
import type { Product } from "@stacked/claim-engine";

/*
 * Sample vault for visitors and for the database seed: a fictional salaried
 * person in Bengaluru with the typical Indian multi-cover stack — employer
 * group cover, their own retail policy, a parents' floater they're on, and a
 * critical-illness plan. Shown with "Try with sample policies".
 */

const PRODUCTS = productsJson as unknown as Product[];
const product = (id: string) => {
  const p = PRODUCTS.find((x) => x.product_id === id);
  if (!p) throw new Error(`Demo product missing: ${id}`);
  return p;
};

export const DEMO_PERSON = { name: "Asha Rao", email: "demo@stacked.app", city: "Bengaluru", dob: "1993-08-14" };
const asha = { name: "Asha", dob: DEMO_PERSON.dob };

const group: Policy = {
  policy_id: "demo-employer",
  label: "Employer cover",
  holder_relationship: "employer_group",
  insurer_id: "icici-lombard",
  product_id: null,
  uin: null,
  policy_type: "group",
  indemnity: true,
  members: [asha],
  sum_insured: 500000,
  bonus_accrued: 0,
  bonus_rule: { pct_per_year: 0, max_pct: 0, reduces_on_claim: false },
  restoration: { type: "none", same_illness: false, first_claim_eligible: false },
  si_used_this_year: 0,
  deductible: { amount: 0, type: "none" },
  room_rent: { rule: "pct_si_per_day", value: 1, icu_value: 2, proportionate_deduction: true },
  copay: [],
  waiting_periods: {
    initial_days: 0,
    specific_months: 0,
    ped_months: 0,
    maternity_months: 0,
    continuity_start: "2023-06-01",
  },
  sublimits: [],
  pre_post_days: { pre: 30, post: 60 },
  consumables_covered: false,
  maternity: { covered: true, limit_normal: 50000, limit_csection: 75000, newborn_day1: true },
  international_cover: false,
  fixed_benefits: [],
  renewal_date: "2027-03-31",
  data_status: "user_verified",
  unknown_fields: ["sublimits", "pre_post_days"],
};

const own = {
  ...presetFromProduct(product("niva-bupa-reassure-2-0"), {
    policy_id: "demo-own",
    holder_relationship: "self",
    sum_insured: 1000000,
    members: [asha],
    continuity_start: "2022-01-15",
    renewal_date: "2027-01-14",
  }),
  label: "ReAssure 2.0",
  bonus_accrued: 0,
};

const parents = {
  ...presetFromProduct(product("new-india-floater-mediclaim"), {
    policy_id: "demo-parents",
    holder_relationship: "parents_floater",
    sum_insured: 500000,
    members: [asha, { name: "Ravi", dob: "1961-02-03" }, { name: "Meena", dob: "1964-11-20" }],
    continuity_start: "2014-04-01",
    renewal_date: "2027-03-31",
  }),
  policy_type: "family_floater" as const,
  label: "Parents' Mediclaim",
  bonus_accrued: 125000,
};

const ci = {
  ...presetFromProduct(product("niva-bupa-criticare"), {
    policy_id: "demo-ci",
    holder_relationship: "self",
    sum_insured: 1000000,
    members: [asha],
    continuity_start: "2023-02-01",
    renewal_date: "2027-01-31",
  }),
  label: "CritiCare",
};

export const DEMO_POLICIES: Policy[] = [group, own, parents, ci];

export { demoScenario } from "./demoScenario.js";
