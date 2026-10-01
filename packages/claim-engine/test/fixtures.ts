import type { BillItem, ClaimScenario, InsurerMetrics, Policy } from "../src/index.js";

export const ADMISSION = "2026-10-01";

/** A modern, fully served individual policy; tests override what they care about. */
export function policy(over: Partial<Policy> & { policy_id: string }): Policy {
  return {
    holder_relationship: "self",
    insurer_id: "hdfc-ergo",
    product_id: null,
    uin: null,
    policy_type: "individual",
    indemnity: true,
    members: [],
    sum_insured: 500000,
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
      continuity_start: "2020-01-01",
    },
    sublimits: [],
    pre_post_days: { pre: 60, post: 180 },
    consumables_covered: true,
    maternity: { covered: false, limit_normal: null, limit_csection: null, newborn_day1: false },
    international_cover: false,
    fixed_benefits: [],
    renewal_date: "2027-03-31",
    data_status: "user_verified",
    ...over,
  };
}

/** Employer group cover: no waits, PED from day 1. */
export function group(over: Partial<Policy> & { policy_id: string }): Policy {
  return policy({
    holder_relationship: "employer_group",
    policy_type: "group",
    waiting_periods: {
      initial_days: 0,
      specific_months: 0,
      ped_months: 0,
      maternity_months: 0,
      continuity_start: "2024-04-01",
    },
    ...over,
  });
}

/** Section 8.1 shared bill for TC1–TC2: ₹3,00,000. */
export const SHARED_BILL: BillItem[] = [
  { head: "room", amount: 32000, room_linked: true },
  { head: "doctor", amount: 40000, room_linked: true },
  { head: "other", label: "Nursing", amount: 8000, room_linked: true },
  { head: "ot", amount: 50000, room_linked: true },
  { head: "investigations", amount: 30000, room_linked: true },
  { head: "medicines", amount: 80000, room_linked: false },
  { head: "implants", amount: 35000, room_linked: false },
  { head: "consumables", amount: 25000, room_linked: false },
];

export const scale = (items: BillItem[], k: number): BillItem[] => items.map((i) => ({ ...i, amount: i.amount * k }));

export function scenario(over: Partial<ClaimScenario> = {}): ClaimScenario {
  return {
    scenario_id: "test",
    claimant: "Asha",
    category: "S4",
    is_ped: false,
    is_accident: false,
    admission_date: ADMISSION,
    hospital: { id: null, city_tier: "metro", in_network_by_insurer: {}, abroad: false },
    room_rate_per_day: 8000,
    bill_items: SHARED_BILL,
    pre_hosp_amount: 0,
    post_hosp_amount: 0,
    ...over,
  };
}

const metric = (row: Omit<InsurerMetrics, "as_of" | "source_url" | "metric_definition">): InsurerMetrics => ({
  ...row,
  as_of: "2026-09-07",
  source_url: "https://joinditto.in/health-insurance/data-lab/",
  metric_definition: "NL-37 Ditto method",
});

/** Rows from Table A. */
export const INSURERS: InsurerMetrics[] = [
  metric({
    insurer_id: "hdfc-ergo",
    insurer_name: "HDFC ERGO General Insurance",
    insurer_type: "PVT_GI",
    csr_fy24: 97.19,
    csr_fy25: 97.45,
    csr_fy26: 98.19,
    csr_3yr_avg: 97.61,
    icr_fy23: 79.04,
    icr_fy24: 80.98,
    icr_fy25: 84.85,
    health_gwp_fy26_cr: 7152,
    complaints_per_10k_fy26: 4.99,
    complaints_3yr_avg: 8.87,
    network_hospitals_min: 16000,
    flags: "Top-tier CSR and complaints",
  }),
  metric({
    insurer_id: "star-health",
    insurer_name: "Star Health & Allied Insurance",
    insurer_type: "SAHI",
    csr_fy24: 86.49,
    csr_fy25: 88.34,
    csr_fy26: 91.05,
    csr_3yr_avg: 88.63,
    icr_fy23: 65,
    icr_fy24: 66.47,
    icr_fy25: 70.3,
    health_gwp_fy26_cr: 18606,
    complaints_per_10k_fy26: 54.02,
    complaints_3yr_avg: 54.04,
    network_hospitals_min: 14000,
    flags: "Highest SAHI repudiation FY24 (18.64%, IBAI)",
  }),
  metric({
    insurer_id: "niva-bupa",
    insurer_name: "Niva Bupa Health Insurance",
    insurer_type: "SAHI",
    csr_fy24: 91.93,
    csr_fy25: 92.39,
    csr_fy26: 94.44,
    csr_3yr_avg: 92.92,
    icr_fy23: 54.05,
    icr_fy24: 59.02,
    icr_fy25: 61.22,
    health_gwp_fy26_cr: 8586,
    complaints_per_10k_fy26: 29.19,
    complaints_3yr_avg: 37.13,
    network_hospitals_min: 10000,
    flags: "Listed (NSE: NIVABUPA)",
  }),
  metric({
    insurer_id: "galaxy-health",
    insurer_name: "Galaxy Health & Allied Insurance",
    insurer_type: "SAHI",
    csr_fy24: null,
    csr_fy25: 79.37,
    csr_fy26: 90.18,
    csr_3yr_avg: 84.78,
    icr_fy23: null,
    icr_fy24: null,
    icr_fy25: null,
    health_gwp_fy26_cr: 148,
    complaints_per_10k_fy26: 25.9,
    complaints_3yr_avg: null,
    network_hospitals_min: 9400,
    flags: "New insurer; 2-yr avg only",
  }),
  metric({
    insurer_id: "narayana-health",
    insurer_name: "Narayana Health Insurance",
    insurer_type: "SAHI",
    csr_fy24: null,
    csr_fy25: 100,
    csr_fy26: 103.24,
    csr_3yr_avg: null,
    icr_fy23: null,
    icr_fy24: null,
    icr_fy25: null,
    health_gwp_fy26_cr: 2,
    complaints_per_10k_fy26: 9,
    complaints_3yr_avg: null,
    network_hospitals_min: 20,
    flags: "Tiny volume; closed hospital network",
  }),
  metric({
    insurer_id: "new-india",
    insurer_name: "The New India Assurance",
    insurer_type: "PSU_GI",
    csr_fy24: 98.44,
    csr_fy25: 98.38,
    csr_fy26: 97.18,
    csr_3yr_avg: 98.0,
    icr_fy23: 103.33,
    icr_fy24: 105.87,
    icr_fy25: 100.98,
    health_gwp_fy26_cr: 22434,
    complaints_per_10k_fy26: 6.62,
    complaints_3yr_avg: 5.66,
    network_hospitals_min: 2000,
    flags: "Largest health GWP; ICR over 100%",
  }),
];

export const byCode = <T extends { code: string }>(list: T[], code: string) => list.find((x) => x.code === code);
