import { z } from "zod";

/*
 * Zod mirrors of the JSON schemas in docs/india-health-insurance-market-2026.md §6.1.
 * Fields marked `ext:` are additions the engine needs that the research schema
 * does not carry; each one is listed in DECISIONS.md. All extensions are optional
 * so a policy written to the verbatim schema still validates.
 */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
const money = z.number().nonnegative();
const pct = z.number().min(0).max(100);
const months = z.number().int().nonnegative();

export const ScenarioCategorySchema = z.enum(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11"]);
export type ScenarioCategory = z.infer<typeof ScenarioCategorySchema>;

export const DataStatusSchema = z.enum(["user_verified", "parsed_from_wording", "aggregator", "name_only"]);
export const CityTierSchema = z.enum(["metro", "tier2", "tier3"]);
export type CityTier = z.infer<typeof CityTierSchema>;

export const HolderRelationshipSchema = z.enum(["self", "employer_group", "parents_floater", "spouse", "other"]);
export type HolderRelationship = z.infer<typeof HolderRelationshipSchema>;

export const PolicyTypeSchema = z.enum([
  "individual",
  "family_floater",
  "multi_individual",
  "group",
  "senior",
  "top_up",
  "super_top_up",
  "critical_illness",
  "hospital_cash",
  "personal_accident",
]);
export type PolicyType = z.infer<typeof PolicyTypeSchema>;

export const RoomRentRuleSchema = z.enum([
  "no_cap",
  "single_pvt_ac",
  "any_except_suite",
  "pct_si_per_day",
  "fixed_amount",
  "category",
]);

export const CopayTriggerSchema = z.enum([
  "all_claims",
  "age_at_entry",
  "zone",
  "non_network",
  "room_upgrade",
  "voluntary",
]);
export type CopayTrigger = z.infer<typeof CopayTriggerSchema>;

export const MemberSchema = z.object({
  name: z.string(),
  dob: isoDate,
  member_id: z.string().optional(), // ext: stable id so claimant matching doesn't rely on names
});

export const PolicySchema = z.object({
  policy_id: z.string(),
  holder_relationship: HolderRelationshipSchema,
  insurer_id: z.string(),
  product_id: z.string().nullable(),
  uin: z.string().nullable(),
  policy_type: PolicyTypeSchema,
  indemnity: z.boolean(),
  members: z.array(MemberSchema),
  sum_insured: z.union([money, z.literal("unlimited")]),
  bonus_accrued: money,
  bonus_rule: z.object({
    pct_per_year: z.number().nonnegative(),
    max_pct: z.number().nonnegative(),
    reduces_on_claim: z.boolean(),
  }),
  restoration: z.object({
    type: z.enum(["none", "once", "unlimited"]),
    same_illness: z.boolean(),
    first_claim_eligible: z.boolean(),
  }),
  si_used_this_year: money,
  deductible: z.object({ amount: money, type: z.enum(["none", "per_claim", "aggregate"]) }),
  room_rent: z.object({
    rule: RoomRentRuleSchema,
    value: z.number().nonnegative().nullable(),
    icu_value: z.number().nonnegative().nullable(),
    proportionate_deduction: z.boolean(),
    max_per_day: money.nullable().optional(), // ext: e.g. Arogya Sanjeevani "2% of SI, max ₹5,000/day"
    icu_max_per_day: money.nullable().optional(), // ext: ICU equivalent
  }),
  copay: z.array(
    z.object({
      trigger: CopayTriggerSchema,
      pct,
      age_threshold: z.number().int().positive().optional(), // ext: for age_at_entry (default 61)
      zone: CityTierSchema.optional(), // ext: the policy's pricing zone, for zone co-pay
    }),
  ),
  waiting_periods: z.object({
    initial_days: z.number().int().nonnegative(),
    specific_months: months,
    ped_months: months,
    maternity_months: months.nullable(),
    continuity_start: isoDate,
  }),
  sublimits: z.array(
    z.object({
      procedure: z.string(),
      cap_amount: money.nullable(),
      cap_pct_si: pct.nullable(),
    }),
  ),
  pre_post_days: z.object({ pre: z.number().int().nonnegative(), post: z.number().int().nonnegative() }),
  consumables_covered: z.boolean(),
  maternity: z.object({
    covered: z.boolean(),
    limit_normal: money.nullable(),
    limit_csection: money.nullable(),
    newborn_day1: z.boolean(),
  }),
  international_cover: z.boolean(),
  fixed_benefits: z.array(
    z.object({
      event: z.string(),
      amount: money,
      survival_days: z.number().int().nonnegative().nullable(),
      per_day: z.boolean().optional(), // ext: hospital cash pays amount × days
    }),
  ),
  renewal_date: isoDate,
  data_status: DataStatusSchema,

  // ext: engine inputs not in the research schema
  label: z.string().optional(), // short display name, e.g. "ReAssure"
  permanent_exclusions: z.array(ScenarioCategorySchema).optional(),
  deductible_met_this_year: money.optional(), // aggregate deductible already used up earlier in the policy year
  unknown_fields: z.array(z.string()).optional(), // fields filled with a conservative default because the source didn't say
  field_status: z.record(z.string(), DataStatusSchema).optional(), // per-field provenance; edited fields become user_verified

  // §7 data model: ownership and provenance
  user_id: z.string().optional(),
  family_group_id: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  as_of: isoDate.nullable().optional(),
  verified_by_user_at: z.string().nullable().optional(),
});
export type Policy = z.infer<typeof PolicySchema>;

export const BillHeadSchema = z.enum([
  "room",
  "icu",
  "doctor",
  "ot",
  "investigations",
  "medicines",
  "implants",
  "consumables",
  "other",
]);
export type BillHead = z.infer<typeof BillHeadSchema>;

export const BillItemSchema = z.object({
  head: BillHeadSchema,
  amount: money,
  room_linked: z.boolean(),
  label: z.string().optional(), // ext: e.g. "Nursing" on an `other` item
});
export type BillItem = z.infer<typeof BillItemSchema>;

export const DeductionSchema = z.object({
  reason: z.string(),
  amount: money,
  code: z.string().optional(), // ext: machine reason so the UI can re-render in another language
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const ClaimScenarioSchema = z.object({
  scenario_id: z.string(),
  claimant: z.string(),
  category: ScenarioCategorySchema,
  is_ped: z.boolean(),
  is_accident: z.boolean(),
  admission_date: isoDate,
  hospital: z.object({
    id: z.string().nullable(),
    city_tier: CityTierSchema,
    in_network_by_insurer: z.record(z.string(), z.boolean()),
    abroad: z.boolean(),
  }),
  room_rate_per_day: money,
  bill_items: z.array(BillItemSchema),
  pre_hosp_amount: money,
  post_hosp_amount: money,

  // ext: inputs the engine uses when present
  admission_type: z.enum(["planned", "emergency"]).optional(),
  is_specific_disease: z.boolean().optional(), // default: true for S1
  procedure: z.string().optional(), // matched against sublimits[].procedure
  delivery_type: z.enum(["normal", "csection"]).optional(), // S6 only
  icu_rate_per_day: money.optional(),
  length_of_stay_days: z.number().int().positive().optional(),
  fixed_benefit_events: z.array(z.string()).optional(), // explicit events for fixed-benefit matching

  output: z
    .object({
      allocation: z.array(
        z.object({
          policy_id: z.string(),
          payout: money,
          mode: z.enum(["cashless", "reimbursement"]),
          deductions: z.array(DeductionSchema),
          confidence: z.number().min(0).max(1),
        }),
      ),
      out_of_pocket: money,
      explanation: z.string(),
    })
    .optional(),
});
export type ClaimScenario = z.infer<typeof ClaimScenarioSchema>;

/* Table A — insurer metrics, plus §7 provenance columns. */
const nullableNum = z.number().nullable();
export const InsurerMetricsSchema = z.object({
  insurer_id: z.string(),
  insurer_name: z.string(),
  insurer_type: z.enum(["PSU_GI", "PVT_GI", "SAHI"]),
  csr_fy24: nullableNum,
  csr_fy25: nullableNum,
  csr_fy26: nullableNum,
  csr_3yr_avg: nullableNum,
  icr_fy23: nullableNum,
  icr_fy24: nullableNum,
  icr_fy25: nullableNum,
  health_gwp_fy26_cr: nullableNum,
  complaints_per_10k_fy26: nullableNum,
  complaints_3yr_avg: nullableNum,
  network_hospitals_min: nullableNum,
  flags: z.string(),
  as_of: isoDate,
  source_url: z.string(),
  metric_definition: z.string(),
  repudiation_ratio: nullableNum.optional(), // ext: not in Table A; engine falls back to 1 − CSR
});
export type InsurerMetrics = z.infer<typeof InsurerMetricsSchema>;

/* Table B1/B2 — products. Every field nullable; UI renders null as "Not known". */
export const ProductSchema = z.object({
  product_id: z.string(),
  insurer_id: z.string(),
  product_name: z.string(),
  variant: z.string().nullable(),
  product_type: PolicyTypeSchema.nullable(),
  uin: z.string().nullable(),
  si_min: z.union([money, z.literal("unlimited")]).nullable(),
  si_max: z.union([money, z.literal("unlimited")]).nullable(),
  room_rent_rule: z.enum(["NO_CAP", "SINGLE_PVT_AC", "ANY_EXCEPT_SUITE", "PCT_SI", "CATEGORY"]).nullable(),
  room_rent_value: z.string().nullable(),
  copay_rule: z.string().nullable(),
  ped_wait_months: months.nullable(),
  specific_wait_months: months.nullable(),
  restoration: z.string().nullable(),
  bonus_pct_per_year: z.number().nullable(),
  bonus_max_pct: z.number().nullable(),
  bonus_reduces_on_claim: z.boolean().nullable(), // ext: read from the bonus text ("guaranteed", "reduces on claim")
  pre_days: z.number().int().nullable(),
  post_days: z.number().int().nullable(),
  consumables: z.enum(["BUILT_IN", "ADDON", "NO"]).nullable(),
  maternity: z.string().nullable(),
  indicative_premium: z.string().nullable(),
  known_features: z.string().nullable(), // B2 free-text column
  sources: z.string().nullable(),
  data_status: z.enum(["verified", "partial", "name_only"]),
  as_of: isoDate,
  source_url: z.string().nullable(),
});
export type Product = z.infer<typeof ProductSchema>;

/* Table C — scenario × feature relevance (0–3). */
const relevance = z.number().int().min(0).max(3);
export const ScenarioSchema = z.object({
  scenario_id: ScenarioCategorySchema,
  scenario_name: z.string(),
  room_rent: relevance,
  copay: relevance,
  sublimit: relevance,
  initial_specific_wait: relevance,
  ped_wait: relevance,
  restoration: relevance,
  consumables: relevance,
  cashless_network: relevance,
  pre_post_days: relevance,
  maternity: relevance,
  csr_weight: z.number().min(0).max(1),
  notes: z.string(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
