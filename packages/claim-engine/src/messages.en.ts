import { formatDateLong } from "./dates.js";
import { formatINR } from "./format.js";
import type { Params } from "./types.js";

/*
 * English strings for every engine reason code. The engine never writes a
 * user-facing sentence anywhere else, so a Hindi catalogue with the same keys
 * is all a translation needs.
 */

export type Catalogue = Record<string, (p: Params) => string>;

const inr = (v: string | number | undefined) => formatINR(Number(v ?? 0));
const inrC = (v: string | number | undefined) => formatINR(Number(v ?? 0), { compact: true });
const date = (v: string | number | undefined) => formatDateLong(String(v));
const s = (v: string | number | undefined) => String(v ?? "");
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const en: Catalogue = {
  /* ── Deductions ─────────────────────────────────────────────── */
  room_proportionate: (p) => `Room rent above ${s(p.cap)} cap — proportionate cut`,
  room_above_cap: (p) => `Room rent above ${s(p.cap)} cap`,
  icu_above_cap: (p) => `ICU charges above ${s(p.cap)} cap`,
  consumables_not_covered: () => "Consumables not covered",
  pre_hosp_not_covered: () => "Pre-hospitalisation expenses not covered",
  post_hosp_not_covered: () => "Post-hospitalisation expenses not covered",
  sublimit: (p) => `Sub-limit for ${s(p.procedure)} (${inr(p.cap)})`,
  maternity_limit: (p) => `Maternity limit (${inr(p.cap)})`,
  copay_all_claims: (p) => `Co-pay ${s(p.pct)}%`,
  copay_age_at_entry: (p) => `Co-pay ${s(p.pct)}% (entry age ${s(p.age)} or above)`,
  copay_zone: (p) => `Zone co-pay ${s(p.pct)}% (treated in a higher-cost city)`,
  copay_non_network: (p) => `Co-pay ${s(p.pct)}% (hospital outside the network)`,
  copay_room_upgrade: (p) => `Co-pay ${s(p.pct)}% (room above your eligible category)`,
  copay_voluntary: (p) => `Voluntary co-pay ${s(p.pct)}%`,
  deductible: (p) => `Deductible of ${inr(p.amount)}`,
  above_si: () => "Above sum insured",

  /* short forms used in "(its room cap costs you ₹38k)" */
  short_room: () => "room cap",
  short_icu: () => "ICU cap",
  short_consumables: () => "consumables exclusion",
  short_prepost: () => "pre/post-hospitalisation limits",
  short_sublimit: () => "sub-limit",
  short_maternity: () => "maternity limit",
  short_copay: () => "co-pay",
  short_deductible: () => "deductible",

  /* ── Eligibility ────────────────────────────────────────────── */
  member_not_covered: (p) => `${s(p.claimant)} is not a member of this policy`,
  abroad_not_covered: () => "Treatment abroad is not covered",
  permanent_exclusion: () => "This treatment is permanently excluded",
  initial_wait: (p) => `Initial waiting period until ${date(p.until)}`,
  specific_wait: (p) => `Specific-disease waiting period until ${date(p.until)}`,
  ped_wait: (p) => `Pre-existing disease waiting period until ${date(p.until)}`,
  maternity_not_covered: () => "Maternity is not covered",
  maternity_wait: (p) => `Maternity waiting period until ${date(p.until)}`,
  si_exhausted: () => "Sum insured is used up for this policy year",
  fixed_benefit_no_match: () => "Pays only on a listed event, and this admission isn't one",
  not_needed: () => "Not needed: the bill is already paid",
  nothing_admissible: () => "Its terms allow nothing of what is left",

  /* ── Fixed-benefit conditions ───────────────────────────────── */
  survival_period: (p) => `Paid if the survival period of ${s(p.days)} days is met`,
  claim_separately: () => "Claim this separately; it pays whatever the other policies pay",

  /* ── Why this order ─────────────────────────────────────────── */
  default_order: () =>
    "The total paid is the same either way and the insurers' claim records are close, so the usual order applies: employer cover first, then your own policy, then your parents' floater.",
  fewer_claims: () =>
    "The total paid is the same either way, so the plan with fewer claims wins: less paperwork, and more cover left on your other policies.",
  group_no_bonus: (p) =>
    `${cap(s(p.name))} has no personal bonus to lose, and claims on it don't raise your own renewal premium.`,
  bonus_not_reduced: () => "Claiming here does not reduce your bonus.",
  bonus_kept: (p) => `${cap(s(p.name))} is not claimed, so its ${inrC(p.amount)} bonus is kept.`,
  bonus_reduced: (p) => `Claiming ${s(p.name)} cuts its bonus by about ${inrC(p.amount)} of cover.`,
  stronger_record: (p) =>
    `${s(p.insurer)} has the stronger claim record: ${s(p.csr)}% of claims settled against ${s(p.other_csr)}% for ${s(p.other_insurer)} (${s(p.period)}).`,
  pays_more: (p) =>
    `${cap(s(p.name))} pays ${inrC(p.amount)} more than ${s(p.other)} on this bill under its own terms.`,
  ped_only: (p) => `${cap(s(p.name))} covers pre-existing diseases now.`,
  cannot_pay: (p) => `${cap(s(p.name))} can't pay: ${s(p.reason)}.`,
  floater_untouched: (p) => `${cap(s(p.name))} stays untouched, so the cover it shares with the family is kept.`,
  floater_last: (p) => `${cap(s(p.name))} is used last because its cover is shared with other members.`,
  super_topup: (p) => `${cap(s(p.name))} pays once this year's claims pass its ${inrC(p.deductible)} deductible.`,
  fixed_parallel: (p) =>
    `${cap(s(p.name))} pays ${inrC(p.amount)} as a lump sum on top, whatever the other policies pay.`,

  /* ── Warnings ───────────────────────────────────────────────── */
  room_rate_missing: () => "Room rate is missing. Enter the per-day room charge so we can check the room-rent cap.",
  icu_rate_missing: () => "ICU rate per day is missing, so the ICU cap was not checked.",
  room_category: (p) => `${cap(s(p.name))} pays in full only for ${s(p.room)}. A costlier room can lead to deductions.`,
  network_unknown: (p) =>
    `We don't know if this hospital is in ${s(p.insurer)}'s network. Check before admission; cashless may not be available.`,
  non_network: (p) =>
    `This hospital is outside ${s(p.insurer)}'s network, so expect to pay first and claim reimbursement.`,
  restoration_same_illness: (p) =>
    `${cap(s(p.name))}'s restored cover may not apply if this is the same illness as an earlier claim this year.`,
  renewal_before_admission: (p) =>
    `${cap(s(p.name))} renews on ${date(p.date)}, before admission. Renew it to stay covered.`,
  age_unknown: (p) =>
    `${cap(s(p.name))} has an entry-age co-pay, but the member's date of birth is missing, so it was not applied.`,
  contribution_clause: () =>
    "Some wordings let insurers split a claim between them if you don't choose. Tell each insurer the order you want and check the wording.",
  second_by_reimbursement: () =>
    "Later policies usually pay by reimbursement: keep attested copies of the bills and the first insurer's settlement letter.",
  insufficient_history: (p) => `${s(p.insurer)} has less than three years of claim data, so its record is not rated.`,

  /* ── Explanation sentences ──────────────────────────────────── */
  headline: (p) => `Claim from ${s(p.name)} first.`,
  headline_none: () => "None of your policies can pay this claim.",
  primary_pays: (p) => `${cap(s(p.name))} pays ${inrC(p.amount)}${p.costs ? ` (${s(p.costs)})` : ""}.`,
  costs_you: (p) => `its ${s(p.what)} ${Number(p.count) > 1 ? "cost" : "costs"} you ${inrC(p.amount)}`,
  secondary_pays_both: (p) => `${cap(s(p.name))} pays the ${inrC(p.disallowed)} plus the ${inrC(p.balance)} balance.`,
  secondary_pays_disallowed: (p) => `${cap(s(p.name))} pays the ${inrC(p.disallowed)} that ${s(p.prev)} didn't.`,
  secondary_pays_balance: (p) => `${cap(s(p.name))} pays the ${inrC(p.balance)} balance.`,
  untouched: (p) => `${cap(s(p.name))} stays untouched.`,
  fixed_pays: (p) => `${cap(s(p.name))} also pays ${inrC(p.amount)} as a lump sum.`,
  you_pay: (p) => `You pay ${inrC(p.amount)}.`,
  you_pay_nothing: () => "You pay nothing.",

  /* ── Confidence ─────────────────────────────────────────────── */
  level_5: () => "Very high",
  level_4: () => "High",
  level_3: () => "Moderate",
  level_2: () => "Low",
  level_1: () => "Very low",
  level_insufficient_history: () => "Insufficient history",
  confidence_text: (p) =>
    `${s(p.level)} confidence. ${s(p.insurer)} settled ${s(p.csr)}% of claims (${s(p.period)}) with ${s(p.complaints)} complaints per 10,000 claims.`,
  confidence_insufficient: (p) => `Insufficient history. ${s(p.insurer)} has fewer than three years of claim data.`,
  confidence_unknown_insurer: () => "Insufficient history. We have no claim record for this insurer.",

  /* ── Policy names ───────────────────────────────────────────── */
  name_employer_group: () => "employer policy",
  name_self: () => "own policy",
  name_spouse: () => "spouse's policy",
  name_parents_floater: () => "parents' floater",
  name_other: () => "other policy",
  name_super_top_up: () => "super top-up",
  name_top_up: () => "top-up",
  name_critical_illness: () => "critical-illness policy",
  name_hospital_cash: () => "hospital cash policy",
  name_personal_accident: () => "personal accident policy",
  your: (p) => `your ${s(p.name)}`,
};

export function render(catalogue: Catalogue, code: string, params: Params = {}): string {
  const fn = catalogue[code] ?? en[code];
  if (!fn) throw new Error(`No message for reason code "${code}"`);
  return fn(params);
}
