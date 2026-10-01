"use client";

import { useState, type ReactNode } from "react";
import {
  en,
  policyNames,
  type ClaimPlan,
  type Confidence,
  type InsurerMetrics,
  type Policy,
} from "@stacked/claim-engine";
import { ClaimSplitBar } from "@/components/ClaimSplitBar";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { DeductionLedger } from "@/components/DeductionLedger";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup, FieldRow, MoneyField, SelectField, TextField } from "@/components/FieldRow";
import { InsurerRow, InsurerScorecard } from "@/components/InsurerScorecard";
import { PlinthButton } from "@/components/PlinthButton";
import { PolicyCard } from "@/components/PolicyCard";
import { Chip, Disclaimer, Money, SourceNote } from "@/components/primitives";
import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";
import { useToast } from "@/components/Toast";
import { t } from "@/lib/i18n/en";

const SWATCHES: [string, string, string][] = [
  ["--ink", "#0F1012", "Page background"],
  ["--graphite", "#17181C", "Cards, sheets"],
  ["--slate", "#22242A", "Raised surfaces, inputs"],
  ["--edge", "#2E3138", "Borders, plinth"],
  ["--bone", "#EDE9E1", "Text, primary face — 14.65:1 on graphite"],
  ["--ash", "#9A9CA3", "Secondary text — 6.47:1 on graphite"],
  ["--mint", "#A8E6C3", "Focus, active tab, links"],
  ["--covered", "#7BD88F", "Paid by insurer"],
  ["--partial", "#E0B458", "Deducted"],
  ["--risk", "#E06C6C", "Out of pocket"],
];

function Demo({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="mt-12 flex flex-col gap-4 border-t border-edge pt-6">
      <h2 className="text-20">{title}</h2>
      {note && <p className="text-14 font-medium text-ash">{note}</p>}
      {children}
    </section>
  );
}

function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-14 font-medium text-ash">{label}</p>
      {children}
    </div>
  );
}

export function DesignShowcase({
  policies,
  plans,
  confidences,
  insurers,
}: {
  policies: Policy[];
  plans: Record<"cascade" | "covered" | "shortfall" | "none" | "withLumpSum", ClaimPlan>;
  confidences: Confidence[];
  insurers: { top: InsurerMetrics; fresh: InsurerMetrics; artefact: InsurerMetrics; all: InsurerMetrics[] };
}) {
  const [open, setOpen] = useState<string | null>("s-own");
  const [sheet, setSheet] = useState(false);
  const [choice, setChoice] = useState<"a" | "b">("a");
  const [money, setMoney] = useState<number | null>(300000);
  const toast = useToast();
  const byId = new Map(insurers.all.map((i) => [i.insurer_id, i]));
  const names = policyNames(policies, byId, en);
  const nameOf = (id: string) => {
    const n = names.get(id) ?? id;
    return n.charAt(0).toUpperCase() + n.slice(1);
  };
  const tc1 = plans.shortfall.allocation[0]!;

  return (
    <>
      <h1 className="text-28">{t.design.title}</h1>
      <p className="mt-2 text-16 font-medium text-ash">{t.design.intro}</p>

      <Demo title="Colour tokens" note="Semantic colours appear only in the split bar, ledger and confidence meter.">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SWATCHES.map(([v, hex, use]) => (
            <li key={v} className="flex items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-button border border-edge"
                style={{ background: `var(${v})` }}
              />
              <span className="flex flex-col">
                <span className="text-14 font-medium">
                  {v} {hex}
                </span>
                <span className="text-14 font-medium text-ash">{use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Demo>

      <Demo title="Type scale" note="Space Grotesk 400 / 500 / 700. Rupee figures use tabular numbers.">
        {[56, 40, 28, 20, 16, 14, 12].map((s) => (
          <p
            key={s}
            className={s >= 28 ? "font-medium" : undefined}
            style={{ fontSize: `${s / 16}rem`, lineHeight: s >= 28 ? 1.15 : 1.45 }}
          >
            {s}px — Claim from your employer policy first. <Money amount={120000} />
          </p>
        ))}
        <p className="eyebrow">Insurer eyebrow, the only uppercase</p>
        <p className="text-16">
          <Money amount={120000} /> in ledgers, <Money amount={120000} compact /> in compact contexts.
        </p>
      </Demo>

      <Demo title="PlinthButton" note="Press any button to see it depress 4px onto its plinth over 90ms.">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {(["primary", "secondary"] as const).map((v) => (
            <div key={v} className="flex flex-col gap-4">
              <State label={`${v}: rest`}>
                <PlinthButton variant={v} className="self-start">
                  Simulate a claim
                </PlinthButton>
              </State>
              <State label={`${v}: pressed`}>
                <PlinthButton variant={v} data-pressed="true" className="self-start">
                  Simulate a claim
                </PlinthButton>
              </State>
              <State label={`${v}: focus`}>
                <PlinthButton variant={v} className="self-start outline-2 outline-offset-2 outline-mint">
                  Simulate a claim
                </PlinthButton>
              </State>
              <State label={`${v}: disabled`}>
                <PlinthButton variant={v} disabled className="self-start">
                  Simulate a claim
                </PlinthButton>
              </State>
              <State label={`${v}: busy`}>
                <PlinthButton variant={v} busy busyLabel="Saving claim plan" className="self-start">
                  Save claim plan
                </PlinthButton>
              </State>
              <State label={`${v}: large`}>
                <PlinthButton variant={v} size="lg" className="self-start">
                  Show claim order
                </PlinthButton>
              </State>
            </div>
          ))}
        </div>
      </Demo>

      <Demo
        title="PolicyCard"
        note="Wallet stack: 12px offset, alternating ±2° tilt. Tap a card to expand the full terms sheet."
      >
        <ul className="flex flex-col gap-3">
          {policies.map((p, i) => (
            <li key={p.policy_id}>
              <PolicyCard
                policy={p}
                insurer={byId.get(p.insurer_id)}
                productName={p.label ?? null}
                today="2026-10-01"
                stackIndex={i}
                expanded={open === p.policy_id}
                onToggle={() => setOpen(open === p.policy_id ? null : p.policy_id)}
              />
            </li>
          ))}
        </ul>
      </Demo>

      <Demo title="ClaimSplitBar" note="The one orchestrated animation: segments fill in cascade order over 500ms.">
        <State label="Cascade across three policies, ₹9L bill">
          <ClaimSplitBar plan={plans.cascade} nameOf={nameOf} />
        </State>
        <State label="Fully covered">
          <ClaimSplitBar plan={plans.covered} nameOf={nameOf} />
        </State>
        <State label="Deductions and amount above cover">
          <ClaimSplitBar plan={plans.shortfall} nameOf={nameOf} />
        </State>
        <State label="No policy can pay">
          <ClaimSplitBar plan={plans.none} nameOf={nameOf} />
        </State>
      </Demo>

      <Demo title="DeductionLedger">
        <State label="With deductions and a final You pay line">
          <DeductionLedger allocation={tc1} youPay={plans.shortfall.out_of_pocket} />
        </State>
        <State label="No deductions">
          <DeductionLedger allocation={plans.covered.allocation[0]!} />
        </State>
      </Demo>

      <Demo
        title="ConfidenceMeter"
        note="Every level, plus Insufficient history. Always a sentence with period and source."
      >
        {confidences.map((c, i) => (
          <State key={i} label={c.label}>
            <ConfidenceMeter confidence={c} />
          </State>
        ))}
      </Demo>

      <Demo title="InsurerScorecard">
        <State label="List rows">
          <ul className="flex flex-col gap-3">
            <InsurerRow insurer={insurers.top} />
            <InsurerRow insurer={insurers.fresh} />
          </ul>
        </State>
        <State label="Detail">
          <div className="grain rounded-card border border-edge p-5">
            <InsurerScorecard insurer={insurers.top} />
          </div>
        </State>
        <State label="Insufficient history">
          <div className="grain rounded-card border border-edge p-5">
            <InsurerScorecard insurer={insurers.fresh} />
          </div>
        </State>
        <State label="Value over 100% (methodology artefact)">
          <div className="grain rounded-card border border-edge p-5">
            <InsurerScorecard insurer={insurers.artefact} />
          </div>
        </State>
      </Demo>

      <Demo title="Stepper">
        <Stepper
          steps={[
            {
              id: "a",
              title: "Ask ICICI Lombard for cashless pre-authorisation",
              detail: "Send it through the hospital desk.",
              status: "done",
            },
            {
              id: "b",
              title: "Insurer decides within 1 hour",
              detail: "Accept or decline within an hour.",
              timing: "Rule: decision within 1 hour",
              status: "current",
            },
            {
              id: "c",
              title: "Discharge authorised within 3 hours",
              detail: "Delays are the insurer's to pay.",
              status: "todo",
            },
          ]}
        />
      </Demo>

      <Demo title="Sheet and Toast">
        <div className="flex flex-wrap gap-3">
          <PlinthButton variant="secondary" onClick={() => setSheet(true)}>
            Open a sheet
          </PlinthButton>
          <PlinthButton variant="secondary" onClick={() => toast("Claim plan saved")}>
            Save claim plan
          </PlinthButton>
        </div>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Remove this policy from your vault?">
          <p className="text-16 text-ash font-medium">
            Esc, the scrim or Close dismisses it, and focus returns to the button.
          </p>
          <PlinthButton onClick={() => setSheet(false)} className="self-start">
            {t.common.close}
          </PlinthButton>
        </Sheet>
      </Demo>

      <Demo title="EmptyState">
        <EmptyState
          title={t.vault.empty.title}
          body={t.vault.empty.body}
          action={<PlinthButton>{t.vault.add}</PlinthButton>}
        />
      </Demo>

      <Demo title="FieldRow">
        <State label="Read mode">
          <dl>
            <FieldRow label="Room rent" value="1% of sum insured a day (₹5,000 a day)" />
            <FieldRow label="Sub-limits" value={null} />
            <FieldRow label="Consumables" value="Not covered" unknown />
          </dl>
        </State>
        <State label="Edit mode">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              label="Room rate per day (₹)"
              hint="Checked against room-rent caps."
              value={money}
              onValue={setMoney}
            />
            <MoneyField
              label="Room rate per day (₹)"
              value={null}
              onValue={() => {}}
              error={t.simulate.roomRateMissing}
            />
            <TextField label="Disabled" disabled value="ICICI Lombard" onChange={() => {}} />
            <SelectField label="Hospital city" defaultValue="metro">
              <option value="metro">Metro</option>
              <option value="tier2">Tier 2 city</option>
            </SelectField>
          </div>
          <ChoiceGroup
            legend="Planned or emergency?"
            name="demo-choice"
            value={choice}
            onChange={setChoice}
            options={[
              { value: "a", label: "Planned" },
              { value: "b", label: "Emergency" },
            ]}
          />
        </State>
      </Demo>

      <Demo title="Chips, SourceNote, Disclaimer">
        <div className="flex flex-wrap gap-2">
          <Chip>No room cap</Chip>
          <Chip>Co-pay 5%</Chip>
          <Chip>PED wait ends Aug 2028</Chip>
        </div>
        <SourceNote>
          Insurer claim record (FY24–26 average, NL-37). Source: Ditto Data Lab, 7 September 2026.
        </SourceNote>
        <Disclaimer />
      </Demo>
    </>
  );
}
