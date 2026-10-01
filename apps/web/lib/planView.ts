import { formatINR, type ClaimPlan } from "@stacked/claim-engine";

export interface Segment {
  key: string;
  kind: "covered" | "deducted" | "above";
  amount: number;
  label: string;
  policy_id?: string;
}

/**
 * The bill as ClaimSplitBar segments: one per paying policy in cascade order,
 * then deductions no later policy recovered, then whatever is above all cover.
 * The last two sum to the plan's out_of_pocket.
 */
export function planSegments(plan: ClaimPlan, nameOf: (policyId: string) => string): Segment[] {
  const segs: Segment[] = plan.allocation.map((a) => ({
    key: a.policy_id,
    kind: "covered",
    amount: a.payout,
    label: nameOf(a.policy_id),
    policy_id: a.policy_id,
  }));
  const last = plan.allocation.at(-1);
  let deducted = 0;
  let above = plan.out_of_pocket;
  if (last) {
    const aboveSI = last.deductions.filter((d) => d.code === "above_si").reduce((s, d) => s + d.amount, 0);
    deducted = Math.max(0, plan.out_of_pocket - aboveSI);
    above = plan.out_of_pocket - deducted;
  }
  if (deducted > 0) segs.push({ key: "deducted", kind: "deducted", amount: deducted, label: "Deducted, you pay" });
  if (above > 0)
    segs.push({
      key: "above",
      kind: "above",
      amount: above,
      label: last ? "Above your cover, you pay" : "Not covered, you pay",
    });
  return segs;
}

export function splitSentence(plan: ClaimPlan, segs: Segment[]): string {
  const parts = segs.map((s) =>
    s.kind === "covered"
      ? `${s.label} pays ${formatINR(s.amount)}`
      : `${s.label.replace(", you pay", "")}: you pay ${formatINR(s.amount)}`,
  );
  if (plan.out_of_pocket === 0) parts.push("you pay ₹0");
  return `${parts.join(", ")} of ${formatINR(plan.total_bill)}.`;
}
