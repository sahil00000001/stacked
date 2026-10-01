"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DEFAULT_NIGHTS,
  allocateClaim,
  formatINR,
  roomCap,
  shortInsurerName,
  type ScenarioCategory,
} from "@stacked/claim-engine";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup, MoneyField, SelectField, TextField, Toggle } from "@/components/FieldRow";
import { PlinthButton, PlinthLink } from "@/components/PlinthButton";
import { PageHeader } from "@/components/primitives";
import { useHydrated } from "@/lib/hydrated";
import { t } from "@/lib/i18n/en";
import { useInsurers, useScenarios } from "@/lib/queries";
import {
  DEFAULT_ROOM_RATE,
  DEFAULT_TOTAL,
  ITEM_KEYS,
  buildScenario,
  defaultDraft,
  draftBillItems,
  memberNames,
  type SimulateDraft,
} from "@/lib/simulate";
import { useStore } from "@/lib/store";

const OTHER = "__other__";

export function Simulate() {
  const hydrated = useHydrated();
  const router = useRouter();
  const policies = useStore((s) => s.policies);
  const saved = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const setCurrent = useStore((s) => s.setCurrent);
  const { data: insurers } = useInsurers();
  const loading = !insurers;
  const { data: scenarios = [] } = useScenarios();
  const [d, setD] = useState<SimulateDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otherName, setOtherName] = useState(false);

  useEffect(() => {
    if (!hydrated || d) return;
    const base = saved ?? defaultDraft(policies);
    // keep a network answer for every insurer now in the vault
    const network = Object.fromEntries(policies.map((p) => [p.insurer_id, base.network[p.insurer_id] ?? "unknown"]));
    const names = memberNames(policies);
    setD({ ...base, network, claimant: base.claimant || names[0] || "" });
    setOtherName(Boolean(base.claimant) && names.length > 0 && !names.includes(base.claimant));
  }, [hydrated, d, saved, policies]);

  if (!hydrated || !d) return <PageHeader title={t.simulate.title} intro={t.simulate.intro} />;

  if (policies.length === 0) {
    return (
      <>
        <PageHeader title={t.simulate.title} />
        <EmptyState
          title={t.vault.empty.title}
          body={t.simulate.needPolicies}
          action={<PlinthLink href="/add">{t.vault.add}</PlinthLink>}
        />
      </>
    );
  }

  const s = t.simulate;
  const up = (x: Partial<SimulateDraft>) => setD({ ...d, ...x });
  const names = memberNames(policies);
  const scenario = scenarios.find((x) => x.scenario_id === d.category);
  const anyCap = policies.some((p) => roomCap(p) !== null);
  const insurerIds = [...new Set(policies.map((p) => p.insurer_id))];
  const split = d.bill_mode === "total" ? draftBillItems(d) : [];

  const changeCategory = (c: ScenarioCategory) =>
    up({
      category: c,
      total: DEFAULT_TOTAL[c],
      nights: DEFAULT_NIGHTS[c],
      is_accident: c === "S2",
      is_ped: c === "S7" || d.is_ped,
      abroad: c === "S10",
      admission_type: c === "S2" ? "emergency" : d.admission_type,
    });

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!d.claimant.trim()) errs.claimant = t.errors.required(s.who);
    if (anyCap && !(d.room_rate_per_day && d.room_rate_per_day > 0)) errs.room_rate = s.roomRateMissing;
    if (d.bill_mode === "total" && !(d.total && d.total > 0)) errs.total = s.totalMissing;
    if (d.bill_mode === "items" && draftBillItems(d).length === 0) errs.total = s.totalMissing;
    setErrors(errs);
    if (Object.keys(errs).length || !insurers) return;
    const sc = buildScenario(d);
    const plan = allocateClaim(policies, sc, insurers);
    setDraft(d);
    setCurrent({ scenario: sc, policies, plan, saved_id: null, draft: d });
    router.push("/plan");
  };

  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {names.length > 0 ? (
          <SelectField
            label={s.who}
            value={otherName ? OTHER : d.claimant}
            onChange={(e) => {
              const v = e.target.value;
              setOtherName(v === OTHER);
              up({ claimant: v === OTHER ? "" : v });
            }}
            error={otherName ? undefined : errors.claimant}
          >
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={OTHER}>{s.whoOther}</option>
          </SelectField>
        ) : null}
        {(otherName || names.length === 0) && (
          <TextField
            label={names.length ? s.whoOtherName : s.who}
            value={d.claimant}
            onChange={(e) => up({ claimant: e.target.value })}
            error={errors.claimant}
            autoComplete="off"
          />
        )}

        <TextField
          label={s.date}
          type="date"
          value={d.admission_date}
          onChange={(e) => up({ admission_date: e.target.value })}
        />

        <SelectField
          label={s.scenario}
          value={d.category}
          onChange={(e) => changeCategory(e.target.value as ScenarioCategory)}
        >
          {(scenarios.length ? scenarios : []).map((x) => (
            <option key={x.scenario_id} value={x.scenario_id}>
              {x.scenario_name}
            </option>
          ))}
        </SelectField>
        {scenario && (
          <p className="-mt-3 text-14 font-medium text-ash">
            {s.whatMatters}: {scenario.notes}
          </p>
        )}

        <Toggle label={s.ped} hint={s.pedHint} checked={d.is_ped} onChange={(v) => up({ is_ped: v })} />
        <Toggle label={s.accident} checked={d.is_accident} onChange={(v) => up({ is_accident: v })} />
        <ChoiceGroup
          legend={s.admission}
          name="admission"
          value={d.admission_type}
          onChange={(v) => up({ admission_type: v })}
          options={[
            { value: "planned", label: s.planned },
            { value: "emergency", label: s.emergency },
          ]}
        />
        <ChoiceGroup
          legend={s.city}
          name="city"
          value={d.city_tier}
          onChange={(v) => up({ city_tier: v, room_rate_per_day: DEFAULT_ROOM_RATE[v] })}
          options={[
            { value: "metro", label: s.cityOptions.metro },
            { value: "tier2", label: s.cityOptions.tier2 },
            { value: "tier3", label: s.cityOptions.tier3 },
          ]}
        />
        <label className="-mt-2 flex min-h-11 items-center gap-3 text-14 font-medium">
          <input
            type="checkbox"
            className="size-5 accent-[var(--mint)]"
            checked={d.abroad}
            onChange={(e) => up({ abroad: e.target.checked })}
          />
          {s.abroad}
        </label>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-14 font-medium text-bone">{s.network}</legend>
          <p className="-mt-2 text-14 font-medium text-ash">{s.networkHint}</p>
          {insurerIds.map((id) => {
            const name =
              id === "unknown"
                ? t.add.insurerUnknown
                : shortInsurerName(insurers?.find((i) => i.insurer_id === id)?.insurer_name ?? id);
            return (
              <ChoiceGroup
                key={id}
                legend={name}
                name={`net-${id}`}
                value={d.network[id] ?? "unknown"}
                onChange={(v) => up({ network: { ...d.network, [id]: v } })}
                options={[
                  { value: "yes", label: s.networkOptions.yes },
                  { value: "no", label: s.networkOptions.no },
                  { value: "unknown", label: s.networkOptions.unknown },
                ]}
              />
            );
          })}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyField
            label={s.roomRate}
            hint={s.roomRateHint}
            value={d.room_rate_per_day}
            onValue={(v) => up({ room_rate_per_day: v })}
            error={errors.room_rate}
          />
          <TextField
            label={s.nights}
            type="number"
            inputMode="numeric"
            min={0}
            max={90}
            value={d.nights}
            onChange={(e) => up({ nights: Math.max(0, Number(e.target.value || 0)) })}
          />
        </div>

        <ChoiceGroup
          legend={s.billMode}
          name="billmode"
          value={d.bill_mode}
          onChange={(v) => {
            if (v === "items" && d.bill_mode === "total") {
              // start the itemised form from the default split
              const items = { ...d.items };
              for (const k of ITEM_KEYS) items[k.key] = 0;
              for (const b of draftBillItems(d)) {
                const key = ITEM_KEYS.find((k) => k.head === b.head && (k.label ?? null) === (b.label ?? null))?.key;
                if (key) items[key] = b.amount;
              }
              up({ bill_mode: v, items });
            } else up({ bill_mode: v });
          }}
          options={[
            { value: "total", label: s.billTotal },
            { value: "items", label: s.billItems },
          ]}
        />

        {d.bill_mode === "total" ? (
          <>
            <MoneyField label={s.total} value={d.total} onValue={(v) => up({ total: v })} error={errors.total} />
            {split.length > 0 && (
              <div className="grain rounded-card border border-edge p-4">
                <p className="mb-2 text-14 font-medium text-ash">{s.defaultSplit}</p>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-14" data-testid="default-split">
                  {split.map((b) => (
                    <div key={`${b.head}-${b.label ?? ""}`} className="contents">
                      <dt className="text-bone">{b.label ?? s.heads[b.head]}</dt>
                      <dd className="money text-right text-bone">{formatINR(b.amount)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-14 font-medium text-ash">{s.roomLinked}</p>
              </div>
            )}
          </>
        ) : (
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <legend className="mb-1 text-14 font-medium text-bone">{s.billItems}</legend>
            {ITEM_KEYS.map((k) => (
              <MoneyField
                key={k.key}
                label={`${s.heads[k.key]} (₹)`}
                value={d.items[k.key] || null}
                onValue={(v) => up({ items: { ...d.items, [k.key]: v ?? 0 } })}
              />
            ))}
            {errors.total && (
              <p role="alert" className="text-14 font-medium text-risk sm:col-span-2">
                {errors.total}
              </p>
            )}
          </fieldset>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyField
            label={s.pre}
            value={d.pre_hosp_amount || null}
            onValue={(v) => up({ pre_hosp_amount: v ?? 0 })}
          />
          <MoneyField
            label={s.post}
            value={d.post_hosp_amount || null}
            onValue={(v) => up({ post_hosp_amount: v ?? 0 })}
          />
        </div>

        <PlinthButton
          type="submit"
          size="lg"
          className="w-full sm:w-auto sm:self-start"
          disabled={loading}
          busy={loading}
          busyLabel={s.submit}
        >
          {s.submit}
        </PlinthButton>
      </form>
    </>
  );
}
