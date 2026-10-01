import {
  addDaysISO,
  addMonthsISO,
  availableSI,
  formatDateLong,
  formatINR,
  roomCap,
  shortInsurerName,
  type InsurerMetrics,
  type Policy,
} from "@stacked/claim-engine";
import { t } from "./i18n/en";

/*
 * Plain-language readings of Policy fields, for chips and the terms sheet.
 * Written for someone who has never read a policy wording.
 */

const inr = (n: number) => formatINR(n);
const inrC = (n: number) => formatINR(n, { compact: true });
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
export const formatMonthYear = (iso: string) => monthYear.format(new Date(`${iso}T00:00:00Z`));

export const isUnknown = (p: Policy, path: string): boolean =>
  (p.unknown_fields ?? []).some((f) => f === path || f.startsWith(`${path}.`) || path.startsWith(`${f}.`));

export function relationshipTag(p: Policy): string {
  if (!p.indemnity) return t.relationship.fixed;
  if (p.policy_type === "super_top_up") return t.relationship.super_top_up;
  if (p.policy_type === "top_up") return t.relationship.top_up;
  return t.relationship[p.holder_relationship];
}

export function displayName(p: Policy, insurer?: InsurerMetrics): string {
  if (p.label) return p.label;
  return insurer
    ? `${shortInsurerName(insurer.insurer_name)} ${t.policyType[p.policy_type].toLowerCase()}`
    : t.policyType[p.policy_type];
}

export function siText(p: Policy): string {
  return p.sum_insured === "unlimited" ? t.vault.unlimitedCover : inr(p.sum_insured);
}

export function availableText(p: Policy): string {
  const a = availableSI(p).amount;
  return Number.isFinite(a) ? inr(a) : t.common.unlimited;
}

/* ── Room rent ────────────────────────────────────────────────── */

export function roomRentText(p: Policy): string {
  const r = p.room_rent;
  switch (r.rule) {
    case "no_cap":
      return "No room rent limit";
    case "single_pvt_ac":
      return "Up to a single private AC room";
    case "any_except_suite":
      return "Any room except a suite";
    case "pct_si_per_day": {
      const cap = roomCap(p);
      const max = r.max_per_day ? `, up to ${inr(r.max_per_day)}` : "";
      return cap
        ? `${r.value}% of sum insured a day${max} (${inr(cap.cap)} a day)`
        : `${r.value ?? "?"}% of sum insured a day`;
    }
    case "fixed_amount":
      return r.value != null ? `${inr(r.value)} a day` : t.common.notKnown;
    case "category":
      return r.value != null
        ? `Eligible room category, up to ${inr(r.value)} a day`
        : "Limited to a room category (rate not known)";
  }
}

export function roomChip(p: Policy): string {
  if (isUnknown(p, "room_rent")) return `Room rent: ${t.common.notKnown.toLowerCase()}`;
  const r = p.room_rent;
  switch (r.rule) {
    case "no_cap":
      return "No room cap";
    case "single_pvt_ac":
      return "Room: single private AC";
    case "any_except_suite":
      return "Room: any except suite";
    case "pct_si_per_day":
      return `Room: ${r.value}% of SI a day`;
    case "fixed_amount":
      return r.value != null ? `Room: ${inrC(r.value)} a day` : "Room: capped";
    case "category":
      return "Room: category limit";
  }
}

export function icuText(p: Policy): string {
  const r = p.room_rent;
  if (r.icu_value == null) return r.rule === "no_cap" ? "No ICU limit" : t.common.notKnown;
  const max = r.icu_max_per_day ? `, up to ${inr(r.icu_max_per_day)}` : "";
  return r.rule === "pct_si_per_day" ? `${r.icu_value}% of sum insured a day${max}` : `${inr(r.icu_value)} a day`;
}

export function proportionateText(p: Policy): string {
  if (p.room_rent.rule === "no_cap") return "Not applicable";
  return p.room_rent.proportionate_deduction
    ? "Yes — a costlier room cuts doctor, nursing, OT and test charges in the same ratio"
    : "No — only the room charge above the cap is cut";
}

/* ── Co-pay ───────────────────────────────────────────────────── */

const COPAY_TEXT: Record<Policy["copay"][number]["trigger"], (pct: number, c: Policy["copay"][number]) => string> = {
  all_claims: (pct) => `${pct}% of every claim`,
  age_at_entry: (pct, c) => `${pct}% if the member joined at ${c.age_threshold ?? 61} or older`,
  zone: (pct) => `${pct}% if treated in a higher-cost city than your policy's zone`,
  non_network: (pct) => `${pct}% at hospitals outside the network`,
  room_upgrade: (pct) => `${pct}% if you take a room above your category`,
  voluntary: (pct) => `${pct}% voluntary co-pay (you chose it for a lower premium)`,
};

export function copayText(p: Policy): string {
  if (isUnknown(p, "copay")) return t.common.notKnown;
  if (p.copay.length === 0) return "No co-pay";
  return p.copay.map((c) => COPAY_TEXT[c.trigger](c.pct, c)).join("; ");
}

export function copayChip(p: Policy): string {
  if (isUnknown(p, "copay")) return `Co-pay: ${t.common.notKnown.toLowerCase()}`;
  const all = p.copay.filter((c) => c.trigger === "all_claims" || c.trigger === "voluntary");
  if (all.length) return `Co-pay ${all.reduce((s, c) => s + c.pct, 0)}%`;
  if (p.copay.length) return "Co-pay in some cases";
  return "No co-pay";
}

/* ── Waiting periods ──────────────────────────────────────────── */

export interface WaitStatus {
  kind: "initial" | "specific" | "ped" | "maternity";
  until: string;
  served: boolean;
}

export function waits(p: Policy, today: string): WaitStatus[] {
  const w = p.waiting_periods;
  const out: WaitStatus[] = [];
  const push = (kind: WaitStatus["kind"], until: string) => out.push({ kind, until, served: today >= until });
  if (w.initial_days > 0) push("initial", addDaysISO(w.continuity_start, w.initial_days));
  if (!p.indemnity) return out;
  if (w.specific_months > 0) push("specific", addMonthsISO(w.continuity_start, w.specific_months));
  if (w.ped_months > 0) push("ped", addMonthsISO(w.continuity_start, w.ped_months));
  if (p.maternity.covered && w.maternity_months)
    push("maternity", addMonthsISO(w.continuity_start, w.maternity_months));
  return out;
}

export function waitChip(p: Policy, today: string): string {
  const open = waits(p, today).filter((x) => !x.served);
  const pick =
    open.find((x) => x.kind === "ped") ??
    open.find((x) => x.kind === "specific") ??
    open.find((x) => x.kind === "initial");
  if (!pick) return "All waits served";
  const label = { ped: "PED wait", specific: "Disease wait", initial: "Initial wait", maternity: "Maternity wait" }[
    pick.kind
  ];
  return `${label} ends ${formatMonthYear(pick.until)}`;
}

export function waitText(p: Policy, kind: WaitStatus["kind"], today: string): string {
  const w = p.waiting_periods;
  const length = {
    initial: w.initial_days ? `${w.initial_days} days (accidents covered from day 1)` : null,
    specific: w.specific_months ? `${w.specific_months} months` : null,
    ped: w.ped_months ? `${w.ped_months} months` : null,
    maternity: w.maternity_months ? `${w.maternity_months} months` : null,
  }[kind];
  if (kind === "maternity" && !p.maternity.covered) return "Not applicable";
  if (!length) return "None";
  const status = waits(p, today).find((x) => x.kind === kind);
  if (!status) return length;
  return status.served ? `${length} — served` : `${length} — ends ${formatDateLong(status.until)}`;
}

/* ── Limits and extras ────────────────────────────────────────── */

export function prePostText(p: Policy): string {
  const { pre, post } = p.pre_post_days;
  if (!pre && !post) return "Not covered";
  return `${pre} days before admission and ${post} days after discharge`;
}

export function maternityText(p: Policy): string {
  const m = p.maternity;
  if (!m.covered) return "Not covered";
  const limits = [
    m.limit_normal != null ? `${inr(m.limit_normal)} normal delivery` : null,
    m.limit_csection != null ? `${inr(m.limit_csection)} C-section` : null,
  ].filter(Boolean);
  return limits.length ? `Covered: ${limits.join(", ")}` : "Covered (limit not known)";
}

export function sublimitsText(p: Policy): string {
  if (p.sublimits.length === 0) return isUnknown(p, "sublimits") ? t.common.notKnown : "None";
  return p.sublimits
    .map((s) => `${s.procedure}: ${s.cap_amount != null ? inr(s.cap_amount) : `${s.cap_pct_si}% of sum insured`}`)
    .join("; ");
}

export function deductibleText(p: Policy): string {
  if (p.deductible.type === "none") return "None";
  const what = p.deductible.type === "aggregate" ? "of the year's total claims" : "of each hospitalisation";
  const met = p.deductible_met_this_year ? `; ${inr(p.deductible_met_this_year)} used up so far` : "";
  return `${inr(p.deductible.amount)} ${what}${met}`;
}

export function bonusText(p: Policy): string {
  const b = p.bonus_rule;
  if (isUnknown(p, "bonus_rule")) return t.common.notKnown;
  if (!b.pct_per_year && !b.max_pct) return "No bonus";
  const max = b.max_pct ? ` up to ${b.max_pct}%` : ", no upper limit";
  return `+${b.pct_per_year}% of sum insured a year${max}; ${b.reduces_on_claim ? "reduces after a claim" : "kept whether or not you claim"}`;
}

export function restorationText(p: Policy): string {
  if (isUnknown(p, "restoration")) return t.common.notKnown;
  const r = p.restoration;
  if (r.type === "none") return "None";
  const base =
    r.type === "unlimited" ? "Unlimited restoration of the sum insured" : "Restores the sum insured once a year";
  const extras = [
    r.same_illness ? "including for the same illness" : "not for the same illness",
    r.first_claim_eligible ? null : "not after the first claim",
  ]
    .filter(Boolean)
    .join(", ");
  return `${base} (${extras})`;
}

export function fixedBenefitsText(p: Policy): string {
  if (p.fixed_benefits.length === 0) return "None";
  return p.fixed_benefits
    .map(
      (f) =>
        `${f.event}: ${inr(f.amount)}${f.per_day ? " a day" : ""}${f.survival_days ? ` (after ${f.survival_days} days' survival)` : ""}`,
    )
    .join("; ");
}

export function membersText(p: Policy): string {
  if (p.members.length === 0) return t.common.notKnown;
  return p.members.map((m) => `${m.name} (born ${formatDateLong(m.dob)})`).join(", ");
}

/* ── The full terms sheet: every Policy field, nulls as "Not known" ── */

export interface TermRow {
  label: string;
  value: string;
  unknown?: boolean;
}
export interface TermSection {
  title: string;
  rows: TermRow[];
}

export function termsSheet(
  p: Policy,
  insurer: InsurerMetrics | undefined,
  productName: string | null,
  today: string,
): TermSection[] {
  const f = t.fields;
  const unk = (path: string) => isUnknown(p, path);
  const s = t.fields.sections;
  return [
    {
      title: s.cover,
      rows: [
        {
          label: f.policy_type,
          value: `${t.policyType[p.policy_type]}${p.indemnity ? " — pays your hospital bills" : " — pays a fixed lump sum"}`,
        },
        { label: f.insurer, value: insurer?.insurer_name ?? t.common.notKnown },
        { label: f.product, value: productName ?? t.common.notKnown },
        { label: f.uin, value: p.uin ?? t.common.notKnown },
        { label: f.sum_insured, value: siText(p) },
        { label: f.available, value: availableText(p) },
        { label: f.bonus_accrued, value: inr(p.bonus_accrued) },
        { label: f.si_used, value: inr(p.si_used_this_year) },
        { label: f.deductible, value: deductibleText(p), unknown: unk("deductible") },
        { label: f.members, value: membersText(p) },
        { label: f.renewal_date, value: formatDateLong(p.renewal_date) },
      ],
    },
    {
      title: s.room,
      rows: [
        {
          label: f.room_rent,
          value: unk("room_rent") ? t.common.notKnown : roomRentText(p),
          unknown: unk("room_rent"),
        },
        { label: f.icu, value: icuText(p) },
        { label: f.proportionate, value: proportionateText(p) },
        { label: f.copay, value: copayText(p), unknown: unk("copay") },
      ],
    },
    {
      title: s.waits,
      rows: [
        { label: f.continuity, value: formatDateLong(p.waiting_periods.continuity_start) },
        { label: f.initial, value: waitText(p, "initial", today) },
        {
          label: f.specific,
          value: unk("waiting_periods.specific_months") ? t.common.notKnown : waitText(p, "specific", today),
          unknown: unk("waiting_periods.specific_months"),
        },
        {
          label: f.ped,
          value: unk("waiting_periods.ped_months") ? t.common.notKnown : waitText(p, "ped", today),
          unknown: unk("waiting_periods.ped_months"),
        },
        { label: f.maternity_wait, value: waitText(p, "maternity", today) },
      ],
    },
    {
      title: s.limits,
      rows: [
        { label: f.sublimits, value: sublimitsText(p), unknown: unk("sublimits") },
        {
          label: f.pre_post,
          value: unk("pre_post_days") ? t.common.notKnown : prePostText(p),
          unknown: unk("pre_post_days"),
        },
        {
          label: f.consumables,
          value: unk("consumables_covered") ? t.common.notKnown : p.consumables_covered ? "Covered" : "Not covered",
          unknown: unk("consumables_covered"),
        },
        {
          label: f.maternity,
          value: unk("maternity") ? t.common.notKnown : maternityText(p),
          unknown: unk("maternity"),
        },
        { label: f.newborn, value: p.maternity.newborn_day1 ? t.common.yes : t.common.no },
        { label: f.international, value: p.international_cover ? "Covered" : "Not covered" },
        { label: f.fixed_benefits, value: fixedBenefitsText(p) },
        {
          label: f.exclusions,
          value: p.permanent_exclusions?.length
            ? p.permanent_exclusions.join(", ")
            : p.data_status === "user_verified"
              ? "None"
              : t.common.notKnown,
        },
      ],
    },
    {
      title: s.bonus,
      rows: [
        { label: f.bonus_rule, value: bonusText(p), unknown: unk("bonus_rule") },
        { label: f.restoration, value: restorationText(p), unknown: unk("restoration") },
      ],
    },
    {
      title: s.source,
      rows: [
        { label: f.data_status, value: t.dataStatus[p.data_status] },
        { label: f.as_of, value: p.as_of ? formatDateLong(p.as_of) : t.common.notKnown },
      ],
    },
  ];
}
