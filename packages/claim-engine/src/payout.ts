import { DEFAULT_AGE_THRESHOLD } from "./config.js";
import { ageOn } from "./dates.js";
import { findMember, type RawReason } from "./eligibility.js";
import { formatINR } from "./format.js";
import type { BillHead, CityTier, ClaimScenario, Policy } from "./schemas.js";
import type { Params } from "./types.js";

export interface WorkItem {
  head: BillHead | "pre_hosp" | "post_hosp";
  amount: number;
  room_linked: boolean;
  unpaid: number;
}

export interface RawDeduction {
  code: string;
  params: Params;
  amount: number;
}

export interface Evaluation {
  presented: number;
  payout: number;
  /** what this policy pays against each work item, same order */
  paid: number[];
  deductions: RawDeduction[];
  warnings: RawReason[];
}

export const baseSI = (p: Policy): number => (p.sum_insured === "unlimited" ? Infinity : p.sum_insured);

export const isTopUp = (p: Policy): boolean => p.policy_type === "top_up" || p.policy_type === "super_top_up";

/** SI + bonus − used this year. Restoration tops a partly used policy back up to its base SI. */
export function availableSI(p: Policy): { amount: number; restored: boolean } {
  const base = baseSI(p);
  const avail = base + p.bonus_accrued - p.si_used_this_year;
  if (p.restoration.type !== "none" && p.si_used_this_year > 0 && avail < base) {
    return { amount: base, restored: true };
  }
  return { amount: Math.max(0, avail), restored: false };
}

export function remainingDeductible(p: Policy): number {
  if (p.deductible.type === "none") return 0;
  if (p.deductible.type === "per_claim") return p.deductible.amount;
  return Math.max(0, p.deductible.amount - (p.deductible_met_this_year ?? 0));
}

interface DayCap {
  cap: number;
  label: string;
}

/** Rupee cap per day for a room or ICU rule, or null when the rule has no rupee figure. */
function perDayCap(
  kind: "pct" | "amount",
  value: number | null,
  maxPerDay: number | null | undefined,
  si: number,
): DayCap | null {
  if (value == null) return null;
  if (kind === "pct" && !Number.isFinite(si)) return null;
  let cap = kind === "pct" ? (value / 100) * si : value;
  let label = kind === "pct" ? `${value}%` : `${formatINR(value)}/day`;
  if (maxPerDay != null && maxPerDay < cap) {
    cap = maxPerDay;
    label = `${label} (max ${formatINR(maxPerDay)}/day)`;
  }
  return { cap, label };
}

export function roomCap(p: Policy): DayCap | null {
  const { rule, value, max_per_day } = p.room_rent;
  if (rule === "pct_si_per_day") return perDayCap("pct", value, max_per_day, baseSI(p));
  if (rule === "fixed_amount" || rule === "category") return perDayCap("amount", value, max_per_day, baseSI(p));
  return null;
}

export function icuCap(p: Policy): DayCap | null {
  const kind = p.room_rent.rule === "pct_si_per_day" ? "pct" : "amount";
  return perDayCap(kind, p.room_rent.icu_value, p.room_rent.icu_max_per_day, baseSI(p));
}

const factorFor = (cap: DayCap | null, rate: number | undefined): number =>
  cap && rate && rate > 0 ? Math.min(1, cap.cap / rate) : 1;

const TIER_RANK: Record<CityTier, number> = { tier3: 0, tier2: 1, metro: 2 };

interface Copay {
  code: string;
  params: Params;
  pct: number;
}

function applicableCopays(p: Policy, s: ClaimScenario, roomOverCap: boolean, warnings: RawReason[]): Copay[] {
  const out: Copay[] = [];
  for (const c of p.copay) {
    const params: Params = { pct: c.pct };
    let applies = false;
    switch (c.trigger) {
      case "all_claims":
      case "voluntary":
        applies = true;
        break;
      case "age_at_entry": {
        const age = c.age_threshold ?? DEFAULT_AGE_THRESHOLD;
        params.age = age;
        const member = findMember(p, s.claimant);
        if (!member) warnings.push({ code: "age_unknown", params: { policy_id: p.policy_id } });
        else applies = ageOn(member.dob, p.waiting_periods.continuity_start) >= age;
        break;
      }
      case "zone":
        applies = TIER_RANK[s.hospital.city_tier] > TIER_RANK[c.zone ?? "tier2"];
        break;
      case "non_network":
        applies = s.hospital.in_network_by_insurer[p.insurer_id] === false;
        break;
      case "room_upgrade":
        applies = roomOverCap;
        break;
    }
    if (applies && c.pct > 0) out.push({ code: `copay_${c.trigger}`, params, pct: c.pct });
  }
  return out;
}

interface ClaimLimit {
  cap: number;
  code: string;
  params: Params;
}

/** The tightest procedure sub-limit or maternity limit that applies to this scenario. */
function claimLimit(p: Policy, s: ClaimScenario): ClaimLimit | null {
  const si = baseSI(p);
  const limits: ClaimLimit[] = [];
  const proc = s.procedure?.trim().toLowerCase();
  for (const sl of p.sublimits) {
    const key = sl.procedure.trim().toLowerCase();
    if (key !== proc && key !== s.category.toLowerCase()) continue;
    const cap = Math.min(sl.cap_amount ?? Infinity, sl.cap_pct_si != null ? (sl.cap_pct_si / 100) * si : Infinity);
    if (Number.isFinite(cap)) limits.push({ cap, code: "sublimit", params: { procedure: sl.procedure, cap } });
  }
  if (s.category === "S6") {
    const cap = s.delivery_type === "csection" ? p.maternity.limit_csection : p.maternity.limit_normal;
    if (cap != null) limits.push({ cap, code: "maternity_limit", params: { cap } });
  }
  return limits.reduce<ClaimLimit | null>((min, l) => (min && min.cap <= l.cap ? min : l), null);
}

/**
 * Section 8 step 2 for one indemnity policy against what is still unpaid.
 *
 * Each item is admitted on the policy's own terms as if it were the only policy
 * (`adm`), and the policy is asked for min(unpaid, adm) per item. Then, at claim
 * level: sub-limit → co-pay → deductible → available SI. Every reduction from
 * the presented amount is recorded, so presented − payout = Σ deductions.
 */
export function evaluatePolicy(p: Policy, s: ClaimScenario, items: WorkItem[]): Evaluation {
  const warnings: RawReason[] = [];
  const buckets = new Map<string, RawDeduction>();
  const deduct = (code: string, params: Params, amount: number) => {
    if (amount <= 0) return;
    const b = buckets.get(code);
    if (b) b.amount += amount;
    else buckets.set(code, { code, params, amount });
  };

  const presented = Math.round(items.reduce((t, i) => t + i.unpaid, 0));
  const room = roomCap(p);
  const icu = icuCap(p);
  const roomFactor = factorFor(room, s.room_rate_per_day);
  const icuFactor = factorFor(icu, s.icu_rate_per_day);

  if (room && !(s.room_rate_per_day > 0) && items.some((i) => i.room_linked && i.amount > 0)) {
    warnings.push({ code: "room_rate_missing", params: {} });
  }
  if (icu && !s.icu_rate_per_day && items.some((i) => i.head === "icu" && i.amount > 0)) {
    warnings.push({ code: "icu_rate_missing", params: {} });
  }

  let soleAdmissible = 0;
  const claims = items.map((it) => {
    let adm = it.amount;
    let code: string | null = null;
    let params: Params = {};
    if (it.head === "consumables" && !p.consumables_covered) {
      adm = 0;
      code = "consumables_not_covered";
    } else if (it.head === "pre_hosp" && p.pre_post_days.pre === 0) {
      adm = 0;
      code = "pre_hosp_not_covered";
    } else if (it.head === "post_hosp" && p.pre_post_days.post === 0) {
      adm = 0;
      code = "post_hosp_not_covered";
    } else if (it.head === "icu") {
      if (icuFactor < 1) {
        adm = it.amount * icuFactor;
        code = "icu_above_cap";
        params = { cap: icu!.label };
      }
    } else if (it.room_linked && roomFactor < 1 && (p.room_rent.proportionate_deduction || it.head === "room")) {
      adm = it.amount * roomFactor;
      code = p.room_rent.proportionate_deduction ? "room_proportionate" : "room_above_cap";
      params = { cap: room!.label };
    }
    const claim = Math.min(it.unpaid, adm);
    if (code) deduct(code, params, it.unpaid - claim);
    soleAdmissible += adm;
    return claim;
  });

  const claimed = claims.reduce((t, c) => t + c, 0);
  let payable = claimed;

  const limit = claimLimit(p, s);
  if (limit) {
    if (payable > limit.cap) {
      deduct(limit.code, limit.params, payable - limit.cap);
      payable = limit.cap;
    }
    soleAdmissible = Math.min(soleAdmissible, limit.cap);
  }

  const copays = applicableCopays(p, s, roomFactor < 1, warnings);
  const pctSum = copays.reduce((t, c) => t + c.pct, 0);
  if (pctSum > 0) {
    const effective = Math.min(100, pctSum) / 100;
    const base = payable;
    for (const c of copays) deduct(c.code, c.params, (base * c.pct * effective) / pctSum);
    payable = base * (1 - effective);
    soleAdmissible *= 1 - effective;
  }

  const ded = remainingDeductible(p);
  if (ded > 0) {
    const liability = Math.max(0, soleAdmissible - ded);
    if (payable > liability) {
      deduct("deductible", { amount: p.deductible.amount }, payable - liability);
      payable = liability;
    }
  }

  const avail = availableSI(p).amount;
  if (payable > avail) {
    deduct("above_si", {}, payable - avail);
    payable = avail;
  }

  const payout = Math.round(payable);
  const ratio = claimed > 0 ? payout / claimed : 0;
  const paid = claims.map((c) => c * ratio);

  return { presented, payout, paid, deductions: roundDeductions([...buckets.values()], presented - payout), warnings };
}

/** Rounds to whole rupees and puts any rounding drift on the largest line, so lines sum exactly. */
function roundDeductions(list: RawDeduction[], target: number): RawDeduction[] {
  const rounded = list.map((d) => ({ ...d, amount: Math.round(d.amount) }));
  const drift = target - rounded.reduce((t, d) => t + d.amount, 0);
  if (drift !== 0 && rounded.length > 0) {
    const largest = rounded.reduce((a, b) => (b.amount > a.amount ? b : a));
    largest.amount += drift;
  }
  return rounded.filter((d) => d.amount > 0);
}
