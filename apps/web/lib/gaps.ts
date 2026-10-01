import {
  availableSI,
  formatDateLong,
  formatINR,
  roomCap,
  type InsurerMetrics,
  type Policy,
} from "@stacked/claim-engine";
import { displayName, waits } from "./describe";
import { t } from "./i18n/en";

export interface Gap {
  code: string;
  policy_id: string;
  text: string;
}

/**
 * Section 3.5: coverage gaps computed from the vault — unserved waits, room
 * caps below the user's usual room rate, no consumables cover, floater shared
 * with parents, group cover ending on job change.
 */
export function computeGaps(
  policies: Policy[],
  insurers: InsurerMetrics[],
  opts: { today: string; usualRoomRate: number },
): Gap[] {
  const out: Gap[] = [];
  const g = t.gaps;
  for (const p of policies) {
    const name = displayName(
      p,
      insurers.find((i) => i.insurer_id === p.insurer_id),
    );
    const add = (code: string, text: string) => out.push({ code, policy_id: p.policy_id, text });

    for (const w of waits(p, opts.today)) {
      if (w.served) continue;
      const d = formatDateLong(w.until);
      add(
        `wait_${w.kind}`,
        { ped: g.ped, specific: g.specific, initial: g.initial, maternity: g.maternity }[w.kind](name, d),
      );
    }
    if (p.renewal_date < opts.today) add("renewal", g.renewal(name, formatDateLong(p.renewal_date)));
    if (!p.indemnity) continue;
    if (availableSI(p).amount <= 0) add("exhausted", g.exhausted(name));

    const cap = roomCap(p);
    if (cap && opts.usualRoomRate > cap.cap) {
      const pct = Math.round((1 - cap.cap / opts.usualRoomRate) * 100);
      add("room_cap", g.roomCap(name, formatINR(cap.cap), formatINR(opts.usualRoomRate), pct));
    } else if (p.room_rent.rule === "category") {
      add("room_category", g.roomCategory(name));
    }
    if (!p.consumables_covered) add("consumables", g.consumables(name));
    const copay = p.copay.filter((c) => c.trigger === "all_claims").reduce((s, c) => s + c.pct, 0);
    if (copay > 0) add("copay", g.copay(name, copay));
    if (p.holder_relationship === "parents_floater") add("floater", g.floater(name));
    if (p.holder_relationship === "employer_group") add("group", g.group(name));
  }
  return out;
}
