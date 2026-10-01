import type { ScenarioCategory } from "./schemas.js";

export type Params = Record<string, string | number>;

/** A machine-readable reason. `text` is the English rendering from messages.en. */
export interface Reason {
  code: string;
  params: Params;
  text: string;
}

export interface Deduction {
  code: string;
  params: Params;
  reason: string;
  amount: number;
}

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5 | "insufficient_history";

export interface Confidence {
  value: number; // 0–1, used for ranking
  level: ConfidenceLevel;
  label: string; // "High", "Insufficient history"
  insurer_id: string;
  insurer_name: string;
  csr_3yr: number | null;
  complaints_3yr: number | null;
  cashless: 0 | 0.5 | 1;
  period: string; // "FY24–26"
  source: string;
  as_of: string | null;
  text: string; // the sentence shown next to the meter
}

export interface Allocation {
  policy_id: string;
  order: number; // 1-based cascade position
  role: "primary" | "secondary";
  presented: number; // bill amount still unpaid when this policy was claimed
  payout: number;
  mode: "cashless" | "reimbursement";
  deductions: Deduction[];
  recovered_disallowed: number; // part of payout covering earlier policies' deductions
  recovered_balance: number; // part of payout covering amounts above earlier policies' SI
  confidence: number;
  confidence_detail: Confidence;
  cost: number; // future cost in ₹ (before λ)
  score: number; // payout × conf − λ·cost
}

export interface FixedBenefitPayout {
  policy_id: string;
  event: string;
  payout: number;
  conditions: Reason[];
  confidence_detail: Confidence;
}

export interface PolicyOutcome {
  policy_id: string;
  reasons: Reason[];
}

export interface ClaimPlan {
  engine_version: string;
  scenario_id: string;
  category: ScenarioCategory;
  total_bill: number;
  allocation: Allocation[];
  untouched: PolicyOutcome[]; // eligible, paid nothing
  ineligible: PolicyOutcome[];
  fixed_benefits: FixedBenefitPayout[];
  fixed_benefit_payout: number;
  indemnity_paid: number;
  out_of_pocket: number;
  why_this_order: Reason[];
  warnings: Reason[];
  headline: string;
  explanation: string;
  explanation_sentences: string[];
}

export interface Weights {
  w_csr: number;
  w_repudiation: number;
  w_complaints: number;
  w_cashless: number;
  lambda: number;
  /** complaints per 10k at or above which the complaints term is 0 */
  complaints_cap: number;
  /** chance the extra cover lost to an NCB cut is needed (₹ value = cover × chance) */
  p_need_extra_cover: number;
  /** ₹ cost per ₹ paid from a floater shared with others */
  floater_cost_rate: number;
  /** same, for a parents' floater (higher-risk members) */
  parents_floater_cost_rate: number;
  /** ₹ cost per ₹ paid from an employer group policy */
  group_renewal_rate: number;
  /** fallback when an insurer has no CSR history (Ditto mean, FY24–26) */
  industry_mean_csr: number;
  industry_mean_complaints: number;
  insufficient_history_cap: number;
  /** level thresholds, highest first: value ≥ t[0] → 5 … */
  level_thresholds: [number, number, number, number];
  csr_weight_by_category: Record<ScenarioCategory, number>;
  /**
   * Plans whose value is within this share of the best plan's value count as
   * equal, so a sliver of claim-record difference doesn't override the default
   * order (doc §0: terms matter more than a few points of settlement ratio).
   */
  tie_tolerance: number;
  /** base policies above which the planner falls back from exhaustive search to greedy */
  max_exhaustive: number;
}

/** What callers pass: any subset of weights, including a partial csr_weight map. */
export type WeightsInput = Partial<Omit<Weights, "csr_weight_by_category">> & {
  csr_weight_by_category?: Partial<Record<ScenarioCategory, number>>;
};
