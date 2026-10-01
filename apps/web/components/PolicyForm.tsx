"use client";

import type { ReactNode } from "react";
import type { InsurerMetrics, Policy, ScenarioCategory } from "@stacked/claim-engine";
import { isUnknown } from "@/lib/describe";
import { t } from "@/lib/i18n/en";
import { editField, type Errors } from "@/lib/policyDraft";
import { ChoiceGroup, MoneyField, SelectField, TextField, Toggle } from "./FieldRow";
import { PlinthButton } from "./PlinthButton";

const SCENARIO_NAMES: Record<ScenarioCategory, string> = t.form.scenarios;

function NumberField({
  label,
  value,
  onValue,
  hint,
  error,
  min = 0,
  max,
  unknown,
}: {
  label: string;
  value: number | null;
  onValue: (v: number | null) => void;
  hint?: string;
  error?: string | null;
  min?: number;
  max?: number;
  unknown?: boolean;
}) {
  return (
    <TextField
      label={label}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value ?? ""}
      onChange={(e) => onValue(e.target.value === "" ? null : Number(e.target.value))}
      hint={[unknown ? t.vault.unknownBadge : null, hint].filter(Boolean).join(" — ") || undefined}
      error={error}
    />
  );
}

function Group({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="grain rounded-card border border-edge">
      <summary className="cursor-pointer px-4 py-3 text-16 font-medium">{title}</summary>
      <div className="flex flex-col gap-5 border-t border-edge p-4">{children}</div>
    </details>
  );
}

function RemoveRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 self-start text-14 font-medium text-mint underline underline-offset-4"
    >
      {label}
    </button>
  );
}

export function MembersField({
  members,
  onChange,
  errors,
}: {
  members: Policy["members"];
  onChange: (m: Policy["members"]) => void;
  errors: Errors;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-14 font-medium text-bone">{t.add.members}</legend>
      {members.map((m, i) => (
        <div key={i} className="grid grid-cols-1 gap-3 rounded-button border border-edge p-3 sm:grid-cols-2">
          <TextField
            label={t.add.memberName}
            value={m.name}
            autoComplete="off"
            onChange={(e) => onChange(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            error={errors[`member_${i}_name`]}
          />
          <TextField
            label={t.add.memberDob}
            type="date"
            value={m.dob}
            onChange={(e) => onChange(members.map((x, j) => (j === i ? { ...x, dob: e.target.value } : x)))}
            error={errors[`member_${i}_dob`]}
          />
          <RemoveRow label={t.add.removeMember(m.name)} onClick={() => onChange(members.filter((_, j) => j !== i))} />
        </div>
      ))}
      <PlinthButton
        variant="secondary"
        className="self-start"
        onClick={() => onChange([...members, { name: "", dob: "" }])}
      >
        {t.add.addMember}
      </PlinthButton>
    </fieldset>
  );
}

/**
 * Every Policy field as a form control (§5.2 "manual field form driven by the
 * Policy schema"). Each edit marks that field user_verified.
 */
export function PolicyForm({
  value,
  onChange,
  errors,
  insurers,
  insurerLocked,
  termsOpen = true,
  intro,
}: {
  value: Policy;
  onChange: (p: Policy) => void;
  errors: Errors;
  insurers: InsurerMetrics[];
  insurerLocked?: boolean;
  termsOpen?: boolean;
  intro?: string;
}) {
  const p = value;
  const set = (path: string, v: unknown) => onChange(editField(p, path, v));
  const unk = (path: string) => isUnknown(p, path);
  const f = t.fields;
  const isTop = p.policy_type === "super_top_up" || p.policy_type === "top_up";
  const roomNeedsValue = ["pct_si_per_day", "fixed_amount", "category"].includes(p.room_rent.rule);

  return (
    <div className="flex flex-col gap-4">
      <Group title={f.sections.cover}>
        <TextField
          label={t.add.label}
          hint={t.add.labelHint}
          value={p.label ?? ""}
          onChange={(e) => set("label", e.target.value)}
          autoComplete="off"
        />
        <ChoiceGroup
          legend={t.add.relationship}
          name="relationship"
          value={p.holder_relationship}
          onChange={(v) => set("holder_relationship", v)}
          options={[
            { value: "self", label: t.add.relationshipOptions.self },
            { value: "employer_group", label: t.relationship.employer_group },
            { value: "parents_floater", label: t.add.relationshipOptions.parents_floater },
            { value: "spouse", label: t.add.relationshipOptions.spouse },
            { value: "other", label: t.add.relationshipOptions.other },
          ]}
        />
        <SelectField
          label={t.add.insurer}
          value={p.insurer_id}
          disabled={insurerLocked}
          onChange={(e) => set("insurer_id", e.target.value)}
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
        <SelectField
          label={f.policy_type}
          value={p.policy_type}
          onChange={(e) => {
            const type = e.target.value as Policy["policy_type"];
            const fixed = ["critical_illness", "hospital_cash", "personal_accident"].includes(type);
            let next = editField(p, "policy_type", type);
            next = editField(next, "indemnity", !fixed);
            next = editField(
              next,
              "deductible.type",
              type === "super_top_up" ? "aggregate" : type === "top_up" ? "per_claim" : "none",
            );
            onChange(next);
          }}
        >
          {Object.entries(t.policyType).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </SelectField>
        <MoneyField
          label={t.add.sumInsured}
          hint={t.add.sumInsuredHint}
          value={p.sum_insured === "unlimited" ? null : p.sum_insured || null}
          disabled={p.sum_insured === "unlimited"}
          onValue={(v) => set("sum_insured", v ?? 0)}
          error={errors.sum_insured}
        />
        <label className="flex min-h-11 items-center gap-3 text-14 font-medium">
          <input
            type="checkbox"
            className="size-5 accent-[var(--mint)]"
            checked={p.sum_insured === "unlimited"}
            onChange={(e) => set("sum_insured", e.target.checked ? "unlimited" : 0)}
          />
          {t.add.unlimitedSI}
        </label>
        <MembersField members={p.members} onChange={(m) => set("members", m)} errors={errors} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t.add.since}
            hint={t.add.sinceHint}
            type="date"
            value={p.waiting_periods.continuity_start}
            onChange={(e) => set("waiting_periods.continuity_start", e.target.value)}
            error={errors.continuity_start}
          />
          <TextField
            label={t.add.renewal}
            type="date"
            value={p.renewal_date}
            onChange={(e) => set("renewal_date", e.target.value)}
            error={errors.renewal_date}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyField
            label={t.add.bonusAccrued}
            hint={t.add.bonusAccruedHint}
            value={p.bonus_accrued || null}
            onValue={(v) => set("bonus_accrued", v ?? 0)}
          />
          <MoneyField
            label={t.add.siUsed}
            value={p.si_used_this_year || null}
            onValue={(v) => set("si_used_this_year", v ?? 0)}
          />
        </div>
        {isTop && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              label={t.add.deductible}
              hint={t.add.deductibleHint}
              value={p.deductible.amount || null}
              onValue={(v) => set("deductible.amount", v ?? 0)}
              error={errors.deductible}
            />
            {p.policy_type === "super_top_up" && (
              <MoneyField
                label={t.add.deductibleMet}
                value={p.deductible_met_this_year ?? null}
                onValue={(v) => set("deductible_met_this_year", v ?? 0)}
              />
            )}
          </div>
        )}
      </Group>

      {intro && <p className="text-14 font-medium text-ash">{intro}</p>}

      {p.indemnity && (
        <Group title={f.sections.room} open={termsOpen}>
          <SelectField
            label={f.room_rent}
            hint={unk("room_rent") ? t.vault.unknownBadge : undefined}
            value={p.room_rent.rule}
            onChange={(e) => {
              const rule = e.target.value as Policy["room_rent"]["rule"];
              onChange(
                editField(editField(p, "room_rent.rule", rule), "room_rent.proportionate_deduction", rule !== "no_cap"),
              );
            }}
          >
            <option value="no_cap">{t.form.roomNoLimit}</option>
            <option value="single_pvt_ac">{t.form.roomSingle}</option>
            <option value="any_except_suite">{t.form.roomAnyExceptSuite}</option>
            <option value="pct_si_per_day">{t.form.roomPct}</option>
            <option value="fixed_amount">{t.form.roomFixed}</option>
            <option value="category">{t.form.roomCategory}</option>
          </SelectField>
          {roomNeedsValue && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                label={p.room_rent.rule === "pct_si_per_day" ? t.form.roomLimitPct : t.form.roomLimitAmount}
                value={p.room_rent.value}
                onValue={(v) => set("room_rent.value", v)}
                error={errors.room_value}
                unknown={unk("room_rent.value")}
              />
              <NumberField
                label={p.room_rent.rule === "pct_si_per_day" ? t.form.icuLimitPct : t.form.icuLimitAmount}
                value={p.room_rent.icu_value}
                onValue={(v) => set("room_rent.icu_value", v)}
              />
            </div>
          )}
          {p.room_rent.rule !== "no_cap" && (
            <Toggle
              label={f.proportionate}
              hint={t.form.proportionateHint}
              checked={p.room_rent.proportionate_deduction}
              onChange={(v) => set("room_rent.proportionate_deduction", v)}
            />
          )}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-14 font-medium text-bone">
              {f.copay}
              {unk("copay") ? ` — ${t.vault.unknownBadge}` : ""}
            </legend>
            {p.copay.map((c, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-button border border-edge p-3 sm:grid-cols-2">
                <SelectField
                  label={t.form.copayWhen}
                  value={c.trigger}
                  onChange={(e) =>
                    set(
                      "copay",
                      p.copay.map((x, j) => (j === i ? { ...x, trigger: e.target.value as typeof c.trigger } : x)),
                    )
                  }
                >
                  <option value="all_claims">{t.form.copayAll}</option>
                  <option value="age_at_entry">{t.form.copayAge}</option>
                  <option value="zone">{t.form.copayZone}</option>
                  <option value="non_network">{t.form.copayNonNetwork}</option>
                  <option value="room_upgrade">{t.form.copayRoom}</option>
                  <option value="voluntary">{t.form.copayVoluntary}</option>
                </SelectField>
                <NumberField
                  label={t.form.copayPct}
                  value={c.pct}
                  max={100}
                  onValue={(v) =>
                    set(
                      "copay",
                      p.copay.map((x, j) => (j === i ? { ...x, pct: v ?? 0 } : x)),
                    )
                  }
                />
                {c.trigger === "age_at_entry" && (
                  <NumberField
                    label={t.form.copayAgeFrom}
                    value={c.age_threshold ?? 61}
                    onValue={(v) =>
                      set(
                        "copay",
                        p.copay.map((x, j) => (j === i ? { ...x, age_threshold: v ?? 61 } : x)),
                      )
                    }
                  />
                )}
                <RemoveRow
                  label={t.form.copayRemove}
                  onClick={() =>
                    set(
                      "copay",
                      p.copay.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
            <PlinthButton
              variant="secondary"
              className="self-start"
              onClick={() => set("copay", [...p.copay, { trigger: "all_claims", pct: 10 }])}
            >
              {t.form.copayAdd}
            </PlinthButton>
          </fieldset>
        </Group>
      )}

      <Group title={f.sections.waits} open={termsOpen}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label={`${f.initial} (days)`}
            value={p.waiting_periods.initial_days}
            onValue={(v) => set("waiting_periods.initial_days", v ?? 0)}
            hint={t.form.initialHint}
          />
          {p.indemnity && (
            <>
              <NumberField
                label={`${f.ped} (months)`}
                value={p.waiting_periods.ped_months}
                max={48}
                onValue={(v) => set("waiting_periods.ped_months", v ?? 0)}
                unknown={unk("waiting_periods.ped_months")}
              />
              <NumberField
                label={`${f.specific} (months)`}
                value={p.waiting_periods.specific_months}
                onValue={(v) => set("waiting_periods.specific_months", v ?? 0)}
                hint={t.form.specificHint}
                unknown={unk("waiting_periods.specific_months")}
              />
              <NumberField
                label={`${f.maternity_wait} (months)`}
                value={p.waiting_periods.maternity_months}
                onValue={(v) => set("waiting_periods.maternity_months", v)}
              />
            </>
          )}
        </div>
      </Group>

      {p.indemnity ? (
        <Group title={f.sections.limits} open={termsOpen}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label={t.form.preDays}
              value={p.pre_post_days.pre}
              onValue={(v) => set("pre_post_days.pre", v ?? 0)}
              unknown={unk("pre_post_days")}
            />
            <NumberField
              label={t.form.postDays}
              value={p.pre_post_days.post}
              onValue={(v) => set("pre_post_days.post", v ?? 0)}
              unknown={unk("pre_post_days")}
            />
          </div>
          <Toggle
            label={`Covers ${f.consumables.toLowerCase()} (gloves, PPE, disposables)`}
            checked={p.consumables_covered}
            onChange={(v) => set("consumables_covered", v)}
            hint={unk("consumables_covered") ? t.vault.unknownBadge : undefined}
          />
          <Toggle
            label={`Covers ${f.maternity.toLowerCase()}`}
            checked={p.maternity.covered}
            onChange={(v) => set("maternity.covered", v)}
            hint={unk("maternity") ? t.vault.unknownBadge : undefined}
          />
          {p.maternity.covered && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MoneyField
                label={t.form.normalLimit}
                value={p.maternity.limit_normal}
                onValue={(v) => set("maternity.limit_normal", v)}
              />
              <MoneyField
                label={t.form.csectionLimit}
                value={p.maternity.limit_csection}
                onValue={(v) => set("maternity.limit_csection", v)}
              />
              <Toggle
                label={f.newborn}
                checked={p.maternity.newborn_day1}
                onChange={(v) => set("maternity.newborn_day1", v)}
              />
            </div>
          )}
          <Toggle
            label={`Covers ${f.international.toLowerCase()}`}
            checked={p.international_cover}
            onChange={(v) => set("international_cover", v)}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-14 font-medium text-bone">
              {f.sublimits}
              {unk("sublimits") ? ` — ${t.common.notKnown.toLowerCase()} until you add them` : ""}
            </legend>
            {p.sublimits.map((s, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-button border border-edge p-3 sm:grid-cols-2">
                <TextField
                  label={t.form.procedure}
                  hint={t.form.procedureHint}
                  value={s.procedure}
                  onChange={(e) =>
                    set(
                      "sublimits",
                      p.sublimits.map((x, j) => (j === i ? { ...x, procedure: e.target.value } : x)),
                    )
                  }
                />
                <MoneyField
                  label={t.form.limit}
                  value={s.cap_amount}
                  onValue={(v) =>
                    set(
                      "sublimits",
                      p.sublimits.map((x, j) => (j === i ? { ...x, cap_amount: v } : x)),
                    )
                  }
                />
                <RemoveRow
                  label={t.form.sublimitRemove}
                  onClick={() =>
                    set(
                      "sublimits",
                      p.sublimits.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
            <PlinthButton
              variant="secondary"
              className="self-start"
              onClick={() => set("sublimits", [...p.sublimits, { procedure: "", cap_amount: null, cap_pct_si: null }])}
            >
              {t.form.sublimitAdd}
            </PlinthButton>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-14 font-medium text-bone">{f.exclusions}</legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {(Object.keys(SCENARIO_NAMES) as ScenarioCategory[]).map((c) => (
                <label key={c} className="flex min-h-11 items-center gap-3 text-14 font-medium">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--mint)]"
                    checked={p.permanent_exclusions?.includes(c) ?? false}
                    onChange={(e) => {
                      const cur = p.permanent_exclusions ?? [];
                      set("permanent_exclusions", e.target.checked ? [...cur, c] : cur.filter((x) => x !== c));
                    }}
                  />
                  {SCENARIO_NAMES[c]}
                </label>
              ))}
            </div>
          </fieldset>
        </Group>
      ) : (
        <Group title={f.fixed_benefits} open={termsOpen}>
          {p.fixed_benefits.map((b, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 rounded-button border border-edge p-3 sm:grid-cols-2">
              <TextField
                label={t.form.paysOn}
                hint={t.form.paysOnHint}
                value={b.event}
                onChange={(e) =>
                  set(
                    "fixed_benefits",
                    p.fixed_benefits.map((x, j) => (j === i ? { ...x, event: e.target.value } : x)),
                  )
                }
              />
              <MoneyField
                label={t.form.amount}
                value={b.amount || null}
                onValue={(v) =>
                  set(
                    "fixed_benefits",
                    p.fixed_benefits.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)),
                  )
                }
              />
              <NumberField
                label={t.form.survival}
                value={b.survival_days}
                onValue={(v) =>
                  set(
                    "fixed_benefits",
                    p.fixed_benefits.map((x, j) => (j === i ? { ...x, survival_days: v } : x)),
                  )
                }
              />
              <Toggle
                label={t.form.perDay}
                checked={b.per_day ?? false}
                onChange={(v) =>
                  set(
                    "fixed_benefits",
                    p.fixed_benefits.map((x, j) => (j === i ? { ...x, per_day: v } : x)),
                  )
                }
              />
              <RemoveRow
                label={t.form.benefitRemove}
                onClick={() =>
                  set(
                    "fixed_benefits",
                    p.fixed_benefits.filter((_, j) => j !== i),
                  )
                }
              />
            </div>
          ))}
          <PlinthButton
            variant="secondary"
            className="self-start"
            onClick={() =>
              set("fixed_benefits", [
                ...p.fixed_benefits,
                { event: "Cancer", amount: typeof p.sum_insured === "number" ? p.sum_insured : 0, survival_days: null },
              ])
            }
          >
            {t.form.benefitAdd}
          </PlinthButton>
        </Group>
      )}

      {p.indemnity && (
        <Group title={f.sections.bonus} open={termsOpen}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label={t.form.bonusPerYear}
              value={p.bonus_rule.pct_per_year}
              onValue={(v) => set("bonus_rule.pct_per_year", v ?? 0)}
              unknown={unk("bonus_rule.pct_per_year")}
            />
            <NumberField
              label={t.form.bonusMax}
              value={p.bonus_rule.max_pct}
              max={2000}
              onValue={(v) => set("bonus_rule.max_pct", v ?? 0)}
              unknown={unk("bonus_rule.max_pct")}
            />
          </div>
          <Toggle
            label={t.form.bonusReduces}
            checked={p.bonus_rule.reduces_on_claim}
            onChange={(v) => set("bonus_rule.reduces_on_claim", v)}
            hint={unk("bonus_rule.reduces_on_claim") ? t.vault.unknownBadge : undefined}
          />
          <SelectField
            label={f.restoration}
            value={p.restoration.type}
            onChange={(e) => set("restoration.type", e.target.value)}
            hint={unk("restoration") ? t.vault.unknownBadge : undefined}
          >
            <option value="none">{t.form.restorationNone}</option>
            <option value="once">{t.form.restorationOnce}</option>
            <option value="unlimited">{t.form.restorationUnlimited}</option>
          </SelectField>
          {p.restoration.type !== "none" && (
            <>
              <Toggle
                label={t.form.restoreSame}
                checked={p.restoration.same_illness}
                onChange={(v) => set("restoration.same_illness", v)}
              />
              <Toggle
                label={t.form.restoreFirst}
                checked={p.restoration.first_claim_eligible}
                onChange={(v) => set("restoration.first_claim_eligible", v)}
              />
            </>
          )}
        </Group>
      )}
      {errors.form && (
        <p role="alert" className="text-14 font-medium text-risk">
          {errors.form}
        </p>
      )}
    </div>
  );
}
