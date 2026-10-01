"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { allocateClaim, en, formatINR, policyNames, type InsurerMetrics } from "@stacked/claim-engine";
import { ClaimSplitBar } from "@/components/ClaimSplitBar";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { DeductionLedger } from "@/components/DeductionLedger";
import { EmptyState } from "@/components/EmptyState";
import { MoneyField } from "@/components/FieldRow";
import { PlinthButton, PlinthLink } from "@/components/PlinthButton";
import { Disclaimer, Money, Section, SourceNote } from "@/components/primitives";
import { useToast } from "@/components/Toast";
import { useHydrated } from "@/lib/hydrated";
import { t } from "@/lib/i18n/en";
import { useInsurers } from "@/lib/queries";
import { buildScenario } from "@/lib/simulate";
import { useStore, type CurrentPlan } from "@/lib/store";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ClaimPlanView() {
  const hydrated = useHydrated();
  const current = useStore((s) => s.current);
  const { data: insurers } = useInsurers();
  if (!hydrated) return <h1 className="text-28">{t.plan.title}</h1>;
  if (!current)
    return (
      <>
        <h1 className="mb-6 text-28">{t.plan.title}</h1>
        <EmptyState
          title={t.plan.title}
          body={t.plan.none}
          action={<PlinthLink href="/simulate">{t.plan.toSimulate}</PlinthLink>}
        />
      </>
    );
  return <PlanBody current={current} insurers={insurers ?? []} />;
}

function PlanBody({ current, insurers }: { current: CurrentPlan; insurers: InsurerMetrics[] }) {
  const { plan, policies, scenario } = current;
  const vault = useStore((s) => s.policies);
  const setCurrent = useStore((s) => s.setCurrent);
  const savePlan = useStore((s) => s.savePlan);
  const toast = useToast();
  const [rate, setRate] = useState<number | null>(scenario.room_rate_per_day || null);
  const firstRender = useRef(true);

  const names = useMemo(
    () => policyNames(policies, new Map(insurers.map((i) => [i.insurer_id, i])), en),
    [policies, insurers],
  );
  const nameOf = (id: string) => cap(names.get(id) ?? id);
  const stale = JSON.stringify(vault) !== JSON.stringify(policies);

  const rerun = (next: { rate?: number | null; usePolicies?: typeof policies }) => {
    if (!insurers.length) return;
    const r = next.rate === undefined ? rate : next.rate;
    const draft = current.draft ? { ...current.draft, room_rate_per_day: r } : undefined;
    const sc = draft ? buildScenario(draft) : { ...scenario, room_rate_per_day: r ?? 0 };
    const ps = next.usePolicies ?? policies;
    setCurrent({ scenario: sc, policies: ps, plan: allocateClaim(ps, sc, insurers), saved_id: null, draft });
  };

  // §5.3 AC: changing the room rate updates the result
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => rerun({ rate }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  const allocated = plan.allocation.length > 0;

  return (
    <article className="flex flex-col" aria-labelledby="plan-headline">
      <p className="text-14 font-medium text-ash">{t.plan.title}</p>
      <h1 id="plan-headline" className="mt-1 text-28">
        {plan.headline}
      </h1>

      <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-14 font-medium text-ash">{t.plan.insurersPay}</p>
          <p className="font-medium leading-none" style={{ fontSize: "var(--money-hero-size)" }}>
            <Money amount={plan.indemnity_paid} />
          </p>
          <p className="mt-1 text-14 font-medium text-ash">
            {t.plan.of} <Money amount={plan.total_bill} />
          </p>
        </div>
        <div>
          <p className="text-14 font-medium text-ash">{t.plan.youPay}</p>
          <p className="text-28 font-medium">
            <Money amount={plan.out_of_pocket} />
          </p>
        </div>
        {plan.fixed_benefit_payout > 0 && (
          <div>
            <p className="text-14 font-medium text-ash">{t.plan.lumpSum}</p>
            <p className="text-28 font-medium">
              <Money amount={plan.fixed_benefit_payout} />
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <ClaimSplitBar key={JSON.stringify(plan.allocation.map((a) => a.payout))} plan={plan} nameOf={nameOf} />
      </div>

      <div className="mt-6 flex flex-col gap-2" data-testid="explanation">
        {plan.explanation_sentences.map((s) => (
          <p key={s} className="text-16 text-bone">
            {s}
          </p>
        ))}
      </div>

      {stale && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-edge p-4">
          <p className="text-16">{t.plan.stale}</p>
          <PlinthButton variant="secondary" onClick={() => rerun({ usePolicies: vault })}>
            {t.plan.rerun}
          </PlinthButton>
        </div>
      )}

      <div className="mt-6 max-w-sm">
        <MoneyField label={t.plan.roomRate} hint={t.plan.roomRateHint} value={rate} onValue={setRate} />
      </div>

      {allocated && (
        <Section title={t.plan.order} id="order">
          <ol className="flex flex-col gap-4">
            {plan.allocation.map((a, i) => {
              const last = i === plan.allocation.length - 1;
              return (
                <li
                  key={a.policy_id}
                  className="grain flex flex-col gap-4 rounded-card border border-edge p-5"
                  data-testid="allocation"
                >
                  <header className="flex flex-col gap-1">
                    <p className="text-14 font-medium text-ash">
                      {i + 1}. {i === 0 ? t.plan.first : t.plan.then},{" "}
                      {a.mode === "cashless" ? t.plan.cashless : t.plan.reimbursement}
                    </p>
                    <h3 className="text-20">{nameOf(a.policy_id)}</h3>
                  </header>
                  <DeductionLedger
                    allocation={a}
                    youPay={last ? plan.out_of_pocket : undefined}
                    caption={t.plan.ledger}
                  />
                  <ConfidenceMeter confidence={a.confidence_detail} />
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {(plan.untouched.length > 0 || plan.ineligible.length > 0) && (
        <Section title={plan.untouched.length ? t.plan.untouched : t.plan.cannotPay} id="others">
          <ul className="flex flex-col gap-3">
            {[...plan.untouched, ...plan.ineligible].map((o) => (
              <li key={o.policy_id} className="rounded-card border border-edge p-4">
                <p className="text-16 font-medium">{nameOf(o.policy_id)}</p>
                {o.reasons.map((r) => (
                  <p key={r.code} className="text-14 font-medium text-ash">
                    {r.text}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.fixed_benefits.length > 0 && (
        <Section title={t.plan.fixed} id="fixed">
          <ul className="flex flex-col gap-3">
            {plan.fixed_benefits.map((f) => (
              <li
                key={`${f.policy_id}-${f.event}`}
                className="grain flex flex-col gap-3 rounded-card border border-edge p-5"
              >
                <p className="text-16 font-medium">
                  {nameOf(f.policy_id)}: {f.event}, <Money amount={f.payout} />
                </p>
                {f.conditions.map((c) => (
                  <p key={c.code} className="text-14 font-medium text-ash">
                    {c.text}
                  </p>
                ))}
                <ConfidenceMeter confidence={f.confidence_detail} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.why_this_order.length > 0 && (
        <Section title={t.plan.why} id="why">
          <ul className="flex list-disc flex-col gap-2 pl-5" data-testid="why">
            {plan.why_this_order.map((r, i) => (
              <li key={`${r.code}-${i}`} className="text-16">
                {r.text}
                {r.params.policy_id && r.code === "bonus_not_reduced" ? ` (${nameOf(String(r.params.policy_id))})` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.warnings.length > 0 && (
        <Section title={t.plan.warnings} id="warnings">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {plan.warnings.map((w) => (
              <li key={w.text} className="text-16">
                {w.text}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="actions no-print mt-10">
        <PlinthButton
          size="lg"
          onClick={() => {
            savePlan();
            toast(t.plan.saved);
          }}
        >
          {t.plan.save}
        </PlinthButton>
        {allocated && (
          <PlinthLink href="/plan/checklist" variant="secondary" size="lg">
            {t.plan.checklist}
          </PlinthLink>
        )}
        <PlinthLink href="/simulate" variant="secondary" size="lg">
          {t.plan.edit}
        </PlinthLink>
      </div>

      <SourceNote className="mt-6">
        {t.plan.engine(plan.engine_version)}. Bill {formatINR(plan.total_bill)}, {scenario.category}, admission{" "}
        {scenario.admission_date}.
      </SourceNote>
      <Disclaimer />
    </article>
  );
}
