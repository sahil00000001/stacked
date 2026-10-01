import type { ScenarioCategory } from "./schemas.js";
import type { Weights } from "./types.js";

export const ENGINE_VERSION = "1.0.0";

export const METRIC_PERIOD = "FY24–26";
export const METRIC_SOURCE = "Insurer claim record (FY24–26 average, NL-37)";

/** Table C `csr_weight`, docs/india-health-insurance-market-2026.md §4.2. */
export const CSR_WEIGHT_BY_CATEGORY: Record<ScenarioCategory, number> = {
  S1: 0.5,
  S2: 0.6,
  S3: 0.7,
  S4: 0.8,
  S5: 0.8,
  S6: 0.4,
  S7: 0.9,
  S8: 0.7,
  S9: 0.5,
  S10: 0.6,
  S11: 0.8,
};

export const DEFAULT_WEIGHTS: Weights = {
  w_csr: 0.4,
  w_repudiation: 0.3,
  w_complaints: 0.2,
  w_cashless: 0.1,
  lambda: 0.3,
  complaints_cap: 100,
  p_need_extra_cover: 0.15,
  floater_cost_rate: 0.15,
  parents_floater_cost_rate: 0.3,
  group_renewal_rate: 0,
  industry_mean_csr: 92.02,
  industry_mean_complaints: 29.35,
  insufficient_history_cap: 0.5,
  level_thresholds: [0.9, 0.8, 0.7, 0.6],
  csr_weight_by_category: CSR_WEIGHT_BY_CATEGORY,
  tie_tolerance: 0.03,
  max_exhaustive: 7,
};

/** Default claim order when plans tie: group → own → spouse → other → parents' floater, then top-ups. */
export const DEFAULT_ORDER_RANK: Record<string, number> = {
  employer_group: 0,
  self: 1,
  spouse: 2,
  other: 3,
  parents_floater: 4,
};

export const DEFAULT_AGE_THRESHOLD = 61;

/** Scenario categories whose fixed benefits are matched by keyword (lower-case). */
export const FIXED_BENEFIT_KEYWORDS: Partial<Record<ScenarioCategory, string[]>> = {
  S2: ["fracture", "accidental hospitalisation", "accidental hospitalization"],
  S4: ["heart", "cardiac", "myocardial", "angioplasty", "bypass"],
  S5: ["cancer"],
};
export const HOSPITALISATION_EVENTS = ["hospitalisation", "hospitalization", "hospital cash"];
