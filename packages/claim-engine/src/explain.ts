import { render, type Catalogue } from "./messages.en.js";
import { yourName } from "./names.js";
import type { ClaimPlan, Deduction } from "./types.js";

const SHORT: Record<string, string> = {
  room_proportionate: "short_room",
  room_above_cap: "short_room",
  icu_above_cap: "short_icu",
  consumables_not_covered: "short_consumables",
  pre_hosp_not_covered: "short_prepost",
  post_hosp_not_covered: "short_prepost",
  sublimit: "short_sublimit",
  maternity_limit: "short_maternity",
  deductible: "short_deductible",
};
const shortCode = (code: string) => SHORT[code] ?? (code.startsWith("copay_") ? "short_copay" : null);

const list = new Intl.ListFormat("en-IN", { style: "long", type: "conjunction" });

/** "(its room cap and co-pay cost you ₹1.2L)", or "" when only the SI limit applied. */
function costsPhrase(deductions: Deduction[], cat: Catalogue): string {
  const byShort = new Map<string, number>();
  for (const d of deductions) {
    const k = shortCode(d.code);
    if (k) byShort.set(k, (byShort.get(k) ?? 0) + d.amount);
  }
  if (byShort.size === 0) return "";
  const sorted = [...byShort.entries()].sort((a, b) => b[1] - a[1]);
  const amount = sorted.reduce((t, [, v]) => t + v, 0);
  const what = list.format(sorted.map(([k]) => render(cat, k)));
  return render(cat, "costs_you", { what, amount, count: sorted.length });
}

/**
 * Section 8 step 6. Builds the sentences from the plan's own numbers and
 * reasons, so nothing here is hard-coded to a scenario. Call it again with
 * another catalogue to re-render the same plan in another language.
 */
export function explainPlan(
  plan: ClaimPlan,
  names: Map<string, string>,
  cat: Catalogue,
): { headline: string; sentences: string[] } {
  const your = (id: string) => yourName(names.get(id) ?? id, cat);
  const primary = plan.allocation[0];
  const headline = primary ? render(cat, "headline", { name: your(primary.policy_id) }) : render(cat, "headline_none");

  const sentences: string[] = [];
  plan.allocation.forEach((a, i) => {
    const name = your(a.policy_id);
    if (i === 0) {
      sentences.push(render(cat, "primary_pays", { name, amount: a.payout, costs: costsPhrase(a.deductions, cat) }));
      return;
    }
    const d = a.recovered_disallowed;
    const b = a.recovered_balance;
    if (d > 0 && b > 0) sentences.push(render(cat, "secondary_pays_both", { name, disallowed: d, balance: b }));
    else if (d > 0)
      sentences.push(
        render(cat, "secondary_pays_disallowed", {
          name,
          disallowed: d,
          prev: your(plan.allocation[i - 1]!.policy_id),
        }),
      );
    else sentences.push(render(cat, "secondary_pays_balance", { name, balance: b }));
  });
  for (const u of plan.untouched) sentences.push(render(cat, "untouched", { name: your(u.policy_id) }));
  for (const o of plan.ineligible) {
    const first = o.reasons[0]!;
    if (first.code === "fixed_benefit_no_match") continue;
    const reason = first.text.charAt(0).toLowerCase() + first.text.slice(1);
    sentences.push(render(cat, "cannot_pay", { name: your(o.policy_id), reason }));
  }
  for (const f of plan.fixed_benefits)
    sentences.push(render(cat, "fixed_pays", { name: your(f.policy_id), amount: f.payout }));
  sentences.push(
    plan.out_of_pocket > 0 ? render(cat, "you_pay", { amount: plan.out_of_pocket }) : render(cat, "you_pay_nothing"),
  );
  return { headline, sentences };
}
