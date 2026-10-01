import { shortInsurerName } from "./confidence.js";
import { render, type Catalogue } from "./messages.en.js";
import type { InsurerMetrics, Policy } from "./schemas.js";

const TYPE_NAMED = new Set(["super_top_up", "top_up", "critical_illness", "hospital_cash", "personal_accident"]);

export function defaultNameCode(p: Policy): string {
  return TYPE_NAMED.has(p.policy_type) ? `name_${p.policy_type}` : `name_${p.holder_relationship}`;
}

/**
 * Display name per policy, used in every sentence: the user's label, else a
 * relationship noun ("employer policy"). Duplicates get the insurer appended.
 */
export function policyNames(
  policies: Policy[],
  insurers: Map<string, InsurerMetrics>,
  cat: Catalogue,
): Map<string, string> {
  const base = policies.map((p) => p.label?.trim() || render(cat, defaultNameCode(p)));
  const count = (list: string[], v: string) => list.filter((x) => x === v).length;
  const withInsurer = base.map((b, i) => {
    if (count(base, b) === 1) return b;
    const p = policies[i]!;
    const ins = insurers.get(p.insurer_id);
    return `${b} (${ins ? shortInsurerName(ins.insurer_name) : p.insurer_id})`;
  });
  const seen = new Map<string, number>();
  return new Map(
    policies.map((p, i) => {
      const n = withInsurer[i]!;
      if (count(withInsurer, n) === 1) return [p.policy_id, n];
      const k = (seen.get(n) ?? 0) + 1;
      seen.set(n, k);
      return [p.policy_id, `${n} ${k}`];
    }),
  );
}

/** "your employer policy", "your ReAssure" */
export const yourName = (name: string, cat: Catalogue): string => render(cat, "your", { name });
