import { findMember } from "./eligibility.js";
import { baseSI } from "./payout.js";
import type { Policy } from "./schemas.js";
import type { Weights } from "./types.js";

export interface FutureCost {
  total: number;
  ncb_cover_lost: number; // ₹ of cover lost to a bonus cut (before × chance)
  ncb: number;
  floater: number;
  group: number;
}

export const isSharedFloater = (p: Policy): boolean =>
  p.policy_type === "family_floater" || p.holder_relationship === "parents_floater";

/** Members other than the claimant. Unknown members on a parents' floater count as shared. */
export function othersOnPolicy(p: Policy, claimant: string): number {
  if (p.members.length === 0) return p.holder_relationship === "parents_floater" ? 1 : 0;
  const me = findMember(p, claimant);
  return p.members.filter((m) => m !== me).length;
}

/**
 * Rupees of cover lost if this policy is claimed: the bonus cut (one year's
 * accrual, capped at what has accrued) plus next year's accrual forgone.
 * Zero when the bonus is guaranteed regardless of claims.
 */
export function ncbCoverLost(p: Policy): number {
  if (!p.bonus_rule.reduces_on_claim) return 0;
  const si = baseSI(p);
  if (!Number.isFinite(si)) return 0;
  const step = (p.bonus_rule.pct_per_year / 100) * si;
  const cut = step > 0 ? Math.min(p.bonus_accrued, step) : p.bonus_accrued;
  const headroom = (p.bonus_rule.max_pct / 100) * si - p.bonus_accrued;
  const forgone = Math.max(0, Math.min(step, headroom));
  return cut + forgone;
}

/** Section 8 step 4: ncb_loss_value + floater SI consumed for others + group renewal externality. */
export function futureCost(p: Policy, payout: number, claimant: string, w: Weights): FutureCost {
  if (payout <= 0) return { total: 0, ncb_cover_lost: 0, ncb: 0, floater: 0, group: 0 };
  const lost = ncbCoverLost(p);
  const ncb = lost * w.p_need_extra_cover;
  const rate = p.holder_relationship === "parents_floater" ? w.parents_floater_cost_rate : w.floater_cost_rate;
  const floater = isSharedFloater(p) && othersOnPolicy(p, claimant) > 0 ? payout * rate : 0;
  const group = p.holder_relationship === "employer_group" ? payout * w.group_renewal_rate : 0;
  return { total: ncb + floater + group, ncb_cover_lost: lost, ncb, floater, group };
}
