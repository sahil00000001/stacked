import { FIXED_BENEFIT_KEYWORDS, HOSPITALISATION_EVENTS } from "./config.js";
import type { ClaimScenario, Policy } from "./schemas.js";

/** Length of stay: given, else room charges ÷ room rate, else 1 day. */
export function stayDays(s: ClaimScenario): number {
  if (s.length_of_stay_days) return s.length_of_stay_days;
  const room = s.bill_items.filter((b) => b.head === "room").reduce((t, b) => t + b.amount, 0);
  if (room > 0 && s.room_rate_per_day > 0) return Math.max(1, Math.round(room / s.room_rate_per_day));
  return 1;
}

/**
 * A fixed benefit matches when its event is named in the scenario's
 * fixed_benefit_events, equals the category id, contains a keyword for the
 * category, or is a hospitalisation (hospital cash) benefit.
 */
export function eventMatches(event: string, s: ClaimScenario): boolean {
  const e = event.trim().toLowerCase();
  if (s.fixed_benefit_events?.some((x) => x.trim().toLowerCase() === e)) return true;
  if (e === s.category.toLowerCase()) return true;
  if (FIXED_BENEFIT_KEYWORDS[s.category]?.some((k) => e.includes(k))) return true;
  return HOSPITALISATION_EVENTS.some((k) => e.includes(k));
}

export function fixedBenefitPayouts(
  p: Policy,
  s: ClaimScenario,
): { event: string; payout: number; survival_days: number | null }[] {
  return p.fixed_benefits
    .filter((fb) => eventMatches(fb.event, s))
    .map((fb) => ({
      event: fb.event,
      payout: fb.per_day ? fb.amount * stayDays(s) : fb.amount,
      survival_days: fb.survival_days,
    }));
}
