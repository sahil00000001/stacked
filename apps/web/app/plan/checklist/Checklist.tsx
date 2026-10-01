"use client";

import { shortInsurerName, type ClaimPlan, type InsurerMetrics, type Policy } from "@stacked/claim-engine";
import { EmptyState } from "@/components/EmptyState";
import { PlinthButton, PlinthLink } from "@/components/PlinthButton";
import { Disclaimer, PageHeader } from "@/components/primitives";
import { Stepper, type Step } from "@/components/Stepper";
import { useHydrated } from "@/lib/hydrated";
import { t } from "@/lib/i18n/en";
import { useInsurers } from "@/lib/queries";
import { useStore } from "@/lib/store";

/** Section 3.3: claim-day checklist in the plan's order. */
export function buildSteps(plan: ClaimPlan, policies: Policy[], insurers: InsurerMetrics[], planned: boolean): Step[] {
  const c = t.checklist.steps;
  const insurerOf = (policyId: string) => {
    const p = policies.find((x) => x.policy_id === policyId);
    const i = insurers.find((x) => x.insurer_id === p?.insurer_id);
    return i ? shortInsurerName(i.insurer_name) : t.add.insurerUnknown.toLowerCase();
  };
  const steps: Omit<Step, "status">[] = [];
  const [primary, ...rest] = plan.allocation;
  if (primary) {
    const ins = insurerOf(primary.policy_id);
    if (primary.mode === "cashless") {
      steps.push({
        id: "preauth",
        title: c.preauthTitle(ins),
        detail: planned ? c.preauthPlanned : c.preauthEmergency,
      });
      steps.push({ id: "decision", title: c.decisionTitle, detail: c.decisionDetail, timing: c.decisionTiming });
      steps.push({ id: "discharge", title: c.dischargeTitle, detail: c.dischargeDetail, timing: c.dischargeTiming });
    } else {
      steps.push({ id: "reimburse", title: c.reimburseTitle(ins), detail: c.reimburseDetail });
    }
  }
  if (rest.length) steps.push({ id: "collect", title: c.collectTitle, detail: c.collectDetail });
  for (const a of rest)
    steps.push({ id: `file-${a.policy_id}`, title: c.fileTitle(insurerOf(a.policy_id)), detail: c.fileDetail });
  for (const f of plan.fixed_benefits)
    steps.push({
      id: `fixed-${f.policy_id}-${f.event}`,
      title: c.fixedTitle(insurerOf(f.policy_id)),
      detail: c.fixedDetail,
    });
  return steps.map((s, i) => ({ ...s, status: i === 0 ? "current" : "todo" }));
}

export function Checklist() {
  const hydrated = useHydrated();
  const current = useStore((s) => s.current);
  const { data: insurers = [] } = useInsurers();
  if (!hydrated) return <PageHeader title={t.checklist.title} />;
  if (!current || (current.plan.allocation.length === 0 && current.plan.fixed_benefits.length === 0)) {
    return (
      <>
        <PageHeader title={t.checklist.title} />
        <EmptyState
          title={t.plan.title}
          body={t.plan.none}
          action={<PlinthLink href="/simulate">{t.plan.toSimulate}</PlinthLink>}
        />
      </>
    );
  }
  const steps = buildSteps(current.plan, current.policies, insurers, current.scenario.admission_type !== "emergency");
  return (
    <>
      <PageHeader title={t.checklist.title} intro={t.checklist.intro}>
        <p className="text-16 text-bone">{current.plan.headline}</p>
      </PageHeader>
      <Stepper steps={steps} />
      <div className="actions no-print mt-8">
        <PlinthButton variant="secondary" onClick={() => window.print()}>
          {t.checklist.print}
        </PlinthButton>
        <PlinthLink href="/plan" variant="secondary">
          {t.common.back}
        </PlinthLink>
      </div>
      <Disclaimer />
    </>
  );
}
