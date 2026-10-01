import {
  DEFAULT_WEIGHTS,
  allocateClaim,
  computeConfidence,
  defaultBillSplit,
  en,
  type ClaimScenario,
  type Confidence,
  type Policy,
} from "@stacked/claim-engine";
import { INSURERS, PRODUCTS, presetFromProduct } from "@stacked/seed-data";
import { employerPolicy } from "@/lib/policyDraft";

/** Sample vault and plans for the /design route, built with the real engine and seed data. */
const members = [{ name: "Asha", dob: "1994-05-10" }];
const product = (id: string) => PRODUCTS.find((p) => p.product_id === id)!;

const group = employerPolicy({
  policy_id: "s-group",
  insurer_id: "icici-lombard",
  label: "Employer cover",
  sum_insured: 500000,
  room: "pct",
  room_value: 1,
  copay_pct: 0,
  maternity: true,
  maternity_limit: 50000,
  ped_day1: true,
  ped_months: 0,
  consumables: "no",
  family: false,
  members,
  continuity_start: "2024-04-01",
  renewal_date: "2027-03-31",
});
const own = {
  ...presetFromProduct(product("niva-bupa-reassure-2-0"), {
    policy_id: "s-own",
    holder_relationship: "self",
    sum_insured: 1000000,
    members,
    continuity_start: "2025-08-01",
    renewal_date: "2027-07-31",
  }),
  label: "ReAssure",
};
const parents = presetFromProduct(product("new-india-floater-mediclaim"), {
  policy_id: "s-parents",
  holder_relationship: "parents_floater",
  sum_insured: 500000,
  members: [...members, { name: "Ravi", dob: "1962-01-02" }, { name: "Meena", dob: "1965-07-19" }],
  continuity_start: "2015-04-01",
  renewal_date: "2027-03-31",
});
const nameOnly = presetFromProduct(product("acko-platinum-health"), {
  policy_id: "s-name-only",
  holder_relationship: "spouse",
  sum_insured: 0,
  members: [],
  continuity_start: "2026-06-01",
  renewal_date: "2027-05-31",
});
const ci = presetFromProduct(product("niva-bupa-criticare"), {
  policy_id: "s-ci",
  holder_relationship: "self",
  sum_insured: 1000000,
  members,
  continuity_start: "2023-01-01",
  renewal_date: "2027-01-01",
});

export const SAMPLE_POLICIES: Policy[] = [group, own, parents, ci, nameOnly];

const scenario = (over: Partial<ClaimScenario>): ClaimScenario => ({
  scenario_id: "design",
  claimant: "Asha",
  category: "S4",
  is_ped: false,
  is_accident: false,
  admission_date: "2026-10-01",
  hospital: { id: null, city_tier: "metro", in_network_by_insurer: { "icici-lombard": true }, abroad: false },
  room_rate_per_day: 8000,
  bill_items: defaultBillSplit(900000, "S11", { roomRatePerDay: 8000, nights: 4 }),
  pre_hosp_amount: 0,
  post_hosp_amount: 0,
  ...over,
});

export const SAMPLE_PLANS = {
  cascade: allocateClaim([group, own, parents], scenario({}), INSURERS),
  covered: allocateClaim(
    [own],
    scenario({ bill_items: defaultBillSplit(300000, "S11", { roomRatePerDay: 8000, nights: 4 }) }),
    INSURERS,
  ),
  shortfall: allocateClaim([group], scenario({}), INSURERS),
  none: allocateClaim([own], scenario({ is_ped: true, category: "S7" }), INSURERS),
  withLumpSum: allocateClaim([group, own, ci], scenario({ category: "S5" }), INSURERS),
};

const s = scenario({});
const conf = (id: string, thresholds = DEFAULT_WEIGHTS.level_thresholds): Confidence =>
  computeConfidence(
    id,
    INSURERS.find((i) => i.insurer_id === id),
    s,
    { ...DEFAULT_WEIGHTS, level_thresholds: thresholds },
    en,
  );

/** One meter per level: real insurers, thresholds shifted only to show every state. */
export const SAMPLE_CONFIDENCE: Confidence[] = [
  conf("hdfc-ergo"),
  conf("aditya-birla-health"),
  conf("star-health"),
  conf("star-health", [0.99, 0.98, 0.97, 0.7]),
  conf("navi-general"),
  conf("galaxy-health"),
];

export const SAMPLE_INSURERS = {
  top: INSURERS.find((i) => i.insurer_id === "hdfc-ergo")!,
  fresh: INSURERS.find((i) => i.insurer_id === "galaxy-health")!,
  artefact: INSURERS.find((i) => i.insurer_id === "liberty-general")!,
  all: INSURERS,
};
