import type { Page } from "@playwright/test";

/* Plain Policy objects (no engine import) for seeding the on-device store. */

const base = {
  product_id: null,
  uin: null,
  indemnity: true,
  members: [{ name: "Asha", dob: "1994-05-10" }],
  bonus_accrued: 0,
  bonus_rule: { pct_per_year: 0, max_pct: 0, reduces_on_claim: false },
  restoration: { type: "none", same_illness: false, first_claim_eligible: false },
  si_used_this_year: 0,
  deductible: { amount: 0, type: "none" },
  room_rent: { rule: "no_cap", value: null, icu_value: null, proportionate_deduction: false },
  copay: [],
  waiting_periods: {
    initial_days: 30,
    specific_months: 24,
    ped_months: 36,
    maternity_months: null,
    continuity_start: "2021-01-01",
  },
  sublimits: [],
  pre_post_days: { pre: 60, post: 180 },
  consumables_covered: true,
  maternity: { covered: false, limit_normal: null, limit_csection: null, newborn_day1: false },
  international_cover: false,
  fixed_benefits: [],
  renewal_date: "2027-03-31",
  data_status: "user_verified",
};

export const GROUP = {
  ...base,
  policy_id: "e2e-group",
  label: "Employer cover",
  holder_relationship: "employer_group",
  insurer_id: "icici-lombard",
  policy_type: "group",
  sum_insured: 500000,
  room_rent: { rule: "pct_si_per_day", value: 1, icu_value: 2, proportionate_deduction: true },
  waiting_periods: {
    initial_days: 0,
    specific_months: 0,
    ped_months: 0,
    maternity_months: 0,
    continuity_start: "2024-04-01",
  },
  consumables_covered: false,
  unknown_fields: ["sublimits", "pre_post_days"],
};

export const OWN = {
  ...base,
  policy_id: "e2e-own",
  label: "ReAssure",
  holder_relationship: "self",
  insurer_id: "niva-bupa",
  policy_type: "individual",
  sum_insured: 1000000,
  data_status: "aggregator",
  unknown_fields: ["sublimits"],
};

export const PARENTS = {
  ...base,
  policy_id: "e2e-parents",
  label: "Parents' Mediclaim",
  holder_relationship: "parents_floater",
  insurer_id: "new-india",
  policy_type: "family_floater",
  sum_insured: 500000,
  members: [
    { name: "Asha", dob: "1994-05-10" },
    { name: "Ravi", dob: "1962-01-02" },
    { name: "Meena", dob: "1965-07-19" },
  ],
  bonus_rule: { pct_per_year: 25, max_pct: 50, reduces_on_claim: true },
  room_rent: { rule: "pct_si_per_day", value: 1, icu_value: 2, proportionate_deduction: true },
  waiting_periods: {
    initial_days: 30,
    specific_months: 36,
    ped_months: 36,
    maternity_months: null,
    continuity_start: "2015-04-01",
  },
  consumables_covered: false,
};

const extra = (i: number) => ({
  ...base,
  policy_id: `e2e-extra-${i}`,
  label: `Extra cover ${i}`,
  holder_relationship: "spouse",
  insurer_id: "hdfc-ergo",
  policy_type: "individual",
  sum_insured: 300000 + i * 100000,
});

export const FIVE = [GROUP, OWN, PARENTS, extra(1), extra(2)];

/** Seeds localStorage before the app loads (zustand persist format). */
export async function seed(page: Page, policies: unknown[], extraState: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([p, x]) => {
      if (sessionStorage.getItem("e2e-seeded")) return;
      sessionStorage.setItem("e2e-seeded", "1");
      localStorage.setItem(
        "stacked-v1",
        JSON.stringify({
          state: { policies: p, plans: [], draft: null, current: null, settings: { usualRoomRate: 8000 }, ...x },
          version: 1,
        }),
      );
    },
    [policies, extraState] as const,
  );
}
