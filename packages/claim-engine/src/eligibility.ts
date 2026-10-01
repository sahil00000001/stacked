import { addDaysISO, addMonthsISO } from "./dates.js";
import type { ClaimScenario, Policy } from "./schemas.js";
import type { Params } from "./types.js";

export interface RawReason {
  code: string;
  params: Params;
}

type Member = Policy["members"][number];

/** Matches the claimant by member_id first, then by name (case-insensitive). */
export function findMember(policy: Policy, claimant: string): Member | undefined {
  const key = claimant.trim().toLowerCase();
  return policy.members.find((m) => m.member_id === claimant || m.name.trim().toLowerCase() === key);
}

/** An empty member list means the members weren't entered yet; treat the claimant as covered. */
export function coversClaimant(policy: Policy, claimant: string): boolean {
  return policy.members.length === 0 || findMember(policy, claimant) !== undefined;
}

export function isSpecificDisease(scenario: ClaimScenario): boolean {
  return scenario.is_specific_disease ?? scenario.category === "S1";
}

/**
 * Section 8 step 1. Returns every reason the policy cannot pay; empty means eligible.
 * Sum-insured exhaustion is checked by the allocator, which knows the available SI.
 */
export function checkEligibility(policy: Policy, scenario: ClaimScenario): RawReason[] {
  const reasons: RawReason[] = [];
  const wp = policy.waiting_periods;
  const admission = scenario.admission_date;
  const exempt = scenario.is_accident;

  const waitEnds = (until: string, code: string) => {
    if (admission < until) reasons.push({ code, params: { until } });
  };

  if (!coversClaimant(policy, scenario.claimant)) {
    reasons.push({ code: "member_not_covered", params: { claimant: scenario.claimant } });
  }
  if (policy.indemnity && scenario.hospital.abroad && !policy.international_cover) {
    reasons.push({ code: "abroad_not_covered", params: {} });
  }
  if (policy.permanent_exclusions?.includes(scenario.category)) {
    reasons.push({ code: "permanent_exclusion", params: { category: scenario.category } });
  }
  if (!exempt && wp.initial_days > 0) {
    waitEnds(addDaysISO(wp.continuity_start, wp.initial_days), "initial_wait");
  }
  if (!policy.indemnity) return reasons;

  if (!exempt && isSpecificDisease(scenario) && wp.specific_months > 0) {
    waitEnds(addMonthsISO(wp.continuity_start, wp.specific_months), "specific_wait");
  }
  if (scenario.is_ped && wp.ped_months > 0) {
    waitEnds(addMonthsISO(wp.continuity_start, wp.ped_months), "ped_wait");
  }
  if (scenario.category === "S6") {
    if (!policy.maternity.covered) {
      reasons.push({ code: "maternity_not_covered", params: {} });
    } else if (wp.maternity_months) {
      waitEnds(addMonthsISO(wp.continuity_start, wp.maternity_months), "maternity_wait");
    }
  }
  return reasons;
}
