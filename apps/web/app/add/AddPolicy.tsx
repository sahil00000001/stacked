"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { shortInsurerName, type InsurerMetrics, type Policy, type Product } from "@stacked/claim-engine";
import { presetFromProduct } from "@stacked/seed-data/preset";
import { ChoiceGroup, MoneyField, SelectField, TextField, Toggle } from "@/components/FieldRow";
import { PlinthButton } from "@/components/PlinthButton";
import { MembersField, PolicyForm } from "@/components/PolicyForm";
import { PageHeader } from "@/components/primitives";
import { useToast } from "@/components/Toast";
import { useHydrated } from "@/lib/hydrated";
import { t } from "@/lib/i18n/en";
import {
  blankPolicy,
  employerPolicy,
  nextYear,
  validatePolicy,
  verifyAll,
  type EmployerInput,
  type Errors,
} from "@/lib/policyDraft";
import { useInsurers, useProducts } from "@/lib/queries";
import { todayISO } from "@/lib/simulate";
import { newId, useStore } from "@/lib/store";

type Way = "preset" | "employer" | "manual";

export function AddPolicy() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const editId = params.get("edit");
  const policies = useStore((s) => s.policies);
  const { data: insurers = [] } = useInsurers();
  const { data: products = [] } = useProducts();
  const [way, setWay] = useState<Way>((params.get("way") as Way) || "preset");

  if (!hydrated) return <PageHeader title={t.add.title} />;

  const editing = editId ? policies.find((p) => p.policy_id === editId) : undefined;
  if (editing) return <EditPolicy policy={editing} insurers={insurers} />;

  return (
    <>
      <PageHeader title={t.add.title} />
      <div className="mb-6">
        <ChoiceGroup
          legend={t.add.how}
          name="way"
          value={way}
          onChange={setWay}
          hint={t.add.waysHint[way]}
          options={[
            { value: "preset", label: t.add.ways.preset },
            { value: "employer", label: t.add.ways.employer },
            { value: "manual", label: t.add.ways.manual },
          ]}
        />
      </div>
      {way === "preset" && <PresetFlow products={products} insurers={insurers} />}
      {way === "employer" && <EmployerFlow insurers={insurers} />}
      {way === "manual" && <ManualFlow insurers={insurers} />}
    </>
  );
}

function useSave() {
  const router = useRouter();
  const toast = useToast();
  const addPolicy = useStore((s) => s.addPolicy);
  const updatePolicy = useStore((s) => s.updatePolicy);
  return (p: Policy, mode: "add" | "edit") => {
    if (mode === "add") addPolicy(p);
    else updatePolicy(p);
    toast(mode === "add" ? t.add.saved : t.add.savedEdit);
    router.push("/");
  };
}

function VerifyBox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-16">
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-[var(--mint)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      I&apos;ve checked every term above against my policy schedule.
    </label>
  );
}

function finish(p: Policy, verified: boolean): Policy {
  return verified ? verifyAll(p, new Date().toISOString()) : p;
}

/* ── Edit an existing policy ─────────────────────────────────── */

function EditPolicy({ policy, insurers }: { policy: Policy; insurers: InsurerMetrics[] }) {
  const save = useSave();
  const [draft, setDraft] = useState(policy);
  const [errors, setErrors] = useState<Errors>({});
  const [verified, setVerified] = useState(policy.data_status === "user_verified");
  return (
    <>
      <PageHeader title={policy.label ?? t.add.title} intro={t.add.termsFromPreset} />
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          const errs = validatePolicy(draft, todayISO());
          setErrors(errs);
          if (Object.keys(errs).length === 0) save(finish(draft, verified), "edit");
        }}
      >
        <PolicyForm value={draft} onChange={setDraft} errors={errors} insurers={insurers} />
        <VerifyBox checked={verified} onChange={setVerified} />
        <PlinthButton type="submit" size="lg" className="self-start">
          {t.add.saveEdit}
        </PlinthButton>
      </form>
    </>
  );
}

/* ── Manual ───────────────────────────────────────────────────── */

function ManualFlow({ insurers }: { insurers: InsurerMetrics[] }) {
  const save = useSave();
  const [draft, setDraft] = useState(() => blankPolicy(todayISO()));
  const [errors, setErrors] = useState<Errors>({});
  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const errs = validatePolicy(draft, todayISO());
        setErrors(errs);
        if (Object.keys(errs).length === 0) save(verifyAll(draft, new Date().toISOString()), "add");
      }}
    >
      <PolicyForm value={draft} onChange={setDraft} errors={errors} insurers={insurers} />
      <PlinthButton type="submit" size="lg" className="self-start">
        {t.add.save}
      </PlinthButton>
    </form>
  );
}

/* ── Preset ───────────────────────────────────────────────────── */

const productLabel = (p: Product) => [p.product_name, p.variant].filter(Boolean).join(" ");

function PresetFlow({ products, insurers }: { products: Product[]; insurers: InsurerMetrics[] }) {
  const save = useSave();
  const [q, setQ] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [verified, setVerified] = useState(false);
  const today = todayISO();

  const insurerName = (id: string) =>
    id === "*" ? "All insurers" : shortInsurerName(insurers.find((i) => i.insurer_id === id)?.insurer_name ?? id);
  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return products
      .filter((p) => {
        const hay = `${insurerName(p.insurer_id)} ${p.product_name} ${p.variant ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, products, insurers]);

  const [basics, setBasics] = useState({
    holder_relationship: "self" as Policy["holder_relationship"],
    insurer_id: "",
    sum_insured: null as number | null,
    members: [] as Policy["members"],
    continuity_start: today,
    renewal_date: nextYear(today),
    deductible_amount: null as number | null,
  });
  const [basicErrors, setBasicErrors] = useState<Errors>({});

  if (!product) {
    return (
      <div className="flex flex-col gap-4">
        <TextField
          label={t.add.search}
          hint={t.add.searchHint}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        {q.trim() && results.length === 0 && <p className="text-16 text-ash font-medium">{t.add.noResults}</p>}
        {results.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Matching products">
            {results.map((p) => (
              <li key={p.product_id}>
                <button
                  type="button"
                  onClick={() => setProduct(p)}
                  className="grain flex w-full flex-col gap-1 rounded-card border border-edge p-4 text-left"
                >
                  <span className="text-16 font-medium text-bone">{productLabel(p)}</span>
                  <span className="text-14 font-medium text-ash">
                    {insurerName(p.insurer_id)}, {t.policyType[p.product_type ?? "individual"].toLowerCase()},{" "}
                    {t.add.dataStatus[p.data_status].toLowerCase()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const needsInsurer = product.insurer_id === "*";
  const isTop = product.product_type === "super_top_up" || product.product_type === "top_up";

  if (!draft) {
    return (
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          const errs: Errors = {};
          if (needsInsurer && !basics.insurer_id) errs.insurer_id = t.errors.required(t.add.insurer);
          if (!(basics.sum_insured && basics.sum_insured > 0)) errs.sum_insured = t.errors.positive("Sum insured");
          if (isTop && !(basics.deductible_amount && basics.deductible_amount > 0))
            errs.deductible = t.errors.positive("Deductible");
          if (basics.continuity_start > today) errs.continuity_start = t.errors.beforeToday(t.add.since);
          setBasicErrors(errs);
          if (Object.keys(errs).length) return;
          const p = presetFromProduct(product, {
            policy_id: newId("pol"),
            holder_relationship: basics.holder_relationship,
            insurer_id: needsInsurer ? basics.insurer_id : undefined,
            sum_insured: basics.sum_insured!,
            members: basics.members,
            continuity_start: basics.continuity_start,
            renewal_date: basics.renewal_date,
            deductible_amount: basics.deductible_amount ?? undefined,
          });
          setDraft({
            ...p,
            policy_type:
              basics.holder_relationship === "parents_floater" && p.policy_type === "individual"
                ? "family_floater"
                : p.policy_type,
          });
        }}
      >
        <div className="grain flex flex-col gap-1 rounded-card border border-edge p-4">
          <span className="text-14 font-medium text-ash">{t.add.chosen}</span>
          <span className="text-20">{productLabel(product)}</span>
          <span className="text-14 font-medium text-ash">
            {insurerName(product.insurer_id)}, {t.add.dataStatus[product.data_status].toLowerCase()}
          </span>
          {product.data_status === "name_only" && <p className="text-14 font-medium text-ash">{t.add.nameOnlyNote}</p>}
          <button
            type="button"
            className="mt-2 min-h-11 self-start text-14 font-medium text-mint underline underline-offset-4"
            onClick={() => setProduct(null)}
          >
            {t.add.change}
          </button>
        </div>
        <ChoiceGroup
          legend={t.add.relationship}
          name="relationship"
          value={basics.holder_relationship}
          onChange={(v) => setBasics({ ...basics, holder_relationship: v })}
          options={[
            { value: "self", label: t.add.relationshipOptions.self },
            { value: "parents_floater", label: t.add.relationshipOptions.parents_floater },
            { value: "spouse", label: t.add.relationshipOptions.spouse },
            { value: "other", label: t.add.relationshipOptions.other },
          ]}
        />
        {needsInsurer && (
          <SelectField
            label={t.add.insurer}
            hint={t.add.insurerHint}
            value={basics.insurer_id}
            onChange={(e) => setBasics({ ...basics, insurer_id: e.target.value })}
            error={basicErrors.insurer_id}
          >
            <option value="">—</option>
            {insurers.map((i) => (
              <option key={i.insurer_id} value={i.insurer_id}>
                {i.insurer_name}
              </option>
            ))}
          </SelectField>
        )}
        <MoneyField
          label={t.add.sumInsured}
          hint={t.add.sumInsuredHint}
          value={basics.sum_insured}
          onValue={(v) => setBasics({ ...basics, sum_insured: v })}
          error={basicErrors.sum_insured}
        />
        {isTop && (
          <MoneyField
            label={t.add.deductible}
            hint={t.add.deductibleHint}
            value={basics.deductible_amount}
            onValue={(v) => setBasics({ ...basics, deductible_amount: v })}
            error={basicErrors.deductible}
          />
        )}
        <MembersField members={basics.members} onChange={(m) => setBasics({ ...basics, members: m })} errors={{}} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t.add.since}
            hint={t.add.sinceHint}
            type="date"
            value={basics.continuity_start}
            onChange={(e) => setBasics({ ...basics, continuity_start: e.target.value })}
            error={basicErrors.continuity_start}
          />
          <TextField
            label={t.add.renewal}
            type="date"
            value={basics.renewal_date}
            onChange={(e) => setBasics({ ...basics, renewal_date: e.target.value })}
          />
        </div>
        <PlinthButton type="submit" className="self-start">
          {t.add.showTerms}
        </PlinthButton>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const errs = validatePolicy(draft, today);
        setErrors(errs);
        if (Object.keys(errs).length === 0) save(finish(draft, verified), "add");
      }}
    >
      <p className="text-16 text-bone">{t.vault.presetNote}</p>
      <PolicyForm
        value={draft}
        onChange={setDraft}
        errors={errors}
        insurers={insurers}
        insurerLocked={!needsInsurer}
        termsOpen={false}
        intro={t.add.termsFromPreset}
      />
      <VerifyBox checked={verified} onChange={setVerified} />
      <div className="flex flex-wrap gap-3">
        <PlinthButton type="submit" size="lg">
          {t.add.save}
        </PlinthButton>
        <PlinthButton variant="secondary" size="lg" onClick={() => setDraft(null)}>
          {t.common.back}
        </PlinthButton>
      </div>
    </form>
  );
}

/* ── Employer quick form ─────────────────────────────────────── */

function EmployerFlow({ insurers }: { insurers: InsurerMetrics[] }) {
  const save = useSave();
  const today = todayISO();
  const [e, setE] = useState<EmployerInput>({
    policy_id: newId("pol"),
    insurer_id: "",
    label: "Employer cover",
    sum_insured: null,
    room: "pct",
    room_value: 1,
    copay_pct: 0,
    maternity: true,
    maternity_limit: 50000,
    ped_day1: true,
    ped_months: 12,
    consumables: "unknown",
    family: false,
    members: [],
    continuity_start: today,
    renewal_date: nextYear(today),
  });
  const [errors, setErrors] = useState<Errors>({});
  const em = t.add.employer;
  const up = (x: Partial<EmployerInput>) => setE({ ...e, ...x });

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        const p = employerPolicy(e);
        const errs = validatePolicy(p, today);
        setErrors(errs);
        if (Object.keys(errs).length === 0) save(p, "add");
      }}
    >
      <SelectField
        label={em.insurer}
        hint={em.insurerHint}
        value={e.insurer_id}
        onChange={(x) => up({ insurer_id: x.target.value })}
        error={errors.insurer_id}
      >
        <option value="">—</option>
        {insurers.map((i) => (
          <option key={i.insurer_id} value={i.insurer_id}>
            {i.insurer_name}
          </option>
        ))}
        <option value="unknown">{t.add.insurerUnknown}</option>
      </SelectField>
      <TextField
        label={t.add.label}
        hint={t.add.labelHint}
        value={e.label}
        onChange={(x) => up({ label: x.target.value })}
        autoComplete="off"
      />
      <MoneyField
        label={t.add.sumInsured}
        hint={t.add.sumInsuredHint}
        value={e.sum_insured}
        onValue={(v) => up({ sum_insured: v })}
        error={errors.sum_insured}
      />
      <ChoiceGroup
        legend={em.roomCap}
        name="room"
        value={e.room}
        onChange={(v) => up({ room: v, room_value: v === "pct" ? 1 : v === "amount" ? 5000 : null })}
        options={[
          { value: "none", label: em.roomCapOptions.none },
          { value: "pct", label: em.roomCapOptions.pct },
          { value: "amount", label: em.roomCapOptions.amount },
        ]}
      />
      {e.room !== "none" && (
        <TextField
          label={e.room === "pct" ? em.roomCapPct : em.roomCapAmount}
          type="number"
          inputMode="decimal"
          min={0}
          step={e.room === "pct" ? 0.5 : 500}
          value={e.room_value ?? ""}
          onChange={(x) => up({ room_value: x.target.value === "" ? null : Number(x.target.value) })}
          error={errors.room_value}
        />
      )}
      <TextField
        label={em.copay}
        hint={em.copayHint}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        value={e.copay_pct}
        onChange={(x) => up({ copay_pct: Number(x.target.value || 0) })}
      />
      <Toggle label={em.maternity} checked={e.maternity} onChange={(v) => up({ maternity: v })} />
      {e.maternity && (
        <MoneyField label={em.maternityLimit} value={e.maternity_limit} onValue={(v) => up({ maternity_limit: v })} />
      )}
      <Toggle label={em.ped} checked={e.ped_day1} onChange={(v) => up({ ped_day1: v })} />
      {!e.ped_day1 && (
        <TextField
          label={em.pedMonths}
          type="number"
          inputMode="numeric"
          min={0}
          max={48}
          value={e.ped_months}
          onChange={(x) => up({ ped_months: Number(x.target.value || 0) })}
        />
      )}
      <ChoiceGroup
        legend={em.consumables}
        name="consumables"
        value={e.consumables}
        onChange={(v) => up({ consumables: v })}
        options={[
          { value: "yes", label: t.common.yes },
          { value: "no", label: t.common.no },
          { value: "unknown", label: t.common.notSure },
        ]}
      />
      <Toggle label={em.covers} checked={e.family} onChange={(v) => up({ family: v })} />
      <MembersField members={e.members} onChange={(m) => up({ members: m })} errors={errors} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label={t.add.since}
          hint={t.add.sinceHint}
          type="date"
          value={e.continuity_start}
          onChange={(x) => up({ continuity_start: x.target.value })}
          error={errors.continuity_start}
        />
        <TextField
          label={t.add.renewal}
          type="date"
          value={e.renewal_date}
          onChange={(x) => up({ renewal_date: x.target.value })}
          error={errors.renewal_date}
        />
      </div>
      <PlinthButton type="submit" size="lg" className="self-start">
        {t.add.save}
      </PlinthButton>
    </form>
  );
}
