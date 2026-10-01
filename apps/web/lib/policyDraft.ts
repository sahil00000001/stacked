import { PolicySchema, type Policy } from "@stacked/claim-engine";
import { t } from "./i18n/en";
import { newId } from "./ids";

/** A blank policy for the manual form. Nothing is assumed beyond IRDAI's standard 30-day initial wait. */
export function blankPolicy(today: string): Policy {
  return {
    policy_id: newId("pol"),
    holder_relationship: "self",
    insurer_id: "",
    product_id: null,
    uin: null,
    policy_type: "individual",
    indemnity: true,
    members: [],
    sum_insured: 0,
    bonus_accrued: 0,
    bonus_rule: { pct_per_year: 0, max_pct: 0, reduces_on_claim: true },
    restoration: { type: "none", same_illness: false, first_claim_eligible: false },
    si_used_this_year: 0,
    deductible: { amount: 0, type: "none" },
    room_rent: { rule: "no_cap", value: null, icu_value: null, proportionate_deduction: false },
    copay: [],
    waiting_periods: {
      initial_days: 30,
      specific_months: 24,
      ped_months: 36,
      maternity_months: null,
      continuity_start: today,
    },
    sublimits: [],
    pre_post_days: { pre: 30, post: 60 },
    consumables_covered: false,
    maternity: { covered: false, limit_normal: null, limit_csection: null, newborn_day1: false },
    international_cover: false,
    fixed_benefits: [],
    renewal_date: nextYear(today),
    data_status: "user_verified",
    field_status: {},
  };
}

export const nextYear = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y + 1, m - 1, d - 1));
  return date.toISOString().slice(0, 10);
};

/** Immutable nested set: setIn(policy, "room_rent.value", 5000). */
export function setIn<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".") as [string, ...string[]];
  const src = (obj ?? {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = Array.isArray(obj)
    ? ([...(obj as unknown[])] as unknown as Record<string, unknown>)
    : { ...src };
  copy[head] = rest.length ? setIn(src[head], rest.join("."), value) : value;
  return copy as T;
}

/**
 * Records that the user edited a field: it becomes user_verified and is no
 * longer an unknown default (§5 AC: "edited fields become user_verified").
 */
export function touch(p: Policy, path: string): Policy {
  const top = path.split(".").slice(0, 2).join(".");
  return {
    ...p,
    field_status: { ...(p.field_status ?? {}), [top]: "user_verified" },
    unknown_fields: (p.unknown_fields ?? []).filter(
      (f) => !(f === top || f.startsWith(`${top}.`) || top.startsWith(`${f}.`) || f === path.split(".")[0]),
    ),
  };
}

export const editField = (p: Policy, path: string, value: unknown): Policy => touch(setIn(p, path, value), path);

/** Marks the whole policy as checked against the schedule. */
export function verifyAll(p: Policy, now: string): Policy {
  return { ...p, data_status: "user_verified", verified_by_user_at: now, unknown_fields: [] };
}

export interface EmployerInput {
  policy_id: string;
  insurer_id: string;
  label: string;
  sum_insured: number | null;
  room: "none" | "pct" | "amount";
  room_value: number | null;
  copay_pct: number;
  maternity: boolean;
  maternity_limit: number | null;
  ped_day1: boolean;
  ped_months: number;
  consumables: "yes" | "no" | "unknown";
  family: boolean;
  members: Policy["members"];
  continuity_start: string;
  renewal_date: string;
}

/** Section 3.1(c): the employer quick form → a full Policy. Group policies: no initial or disease waits. */
export function employerPolicy(e: EmployerInput): Policy {
  const unknown = ["sublimits", "pre_post_days", "restoration"];
  if (e.consumables === "unknown") unknown.push("consumables_covered");
  if (e.insurer_id === "unknown") unknown.push("insurer_id");
  return {
    policy_id: e.policy_id,
    holder_relationship: "employer_group",
    insurer_id: e.insurer_id,
    product_id: null,
    uin: null,
    policy_type: e.family ? "family_floater" : "group",
    indemnity: true,
    members: e.members,
    sum_insured: e.sum_insured ?? 0,
    bonus_accrued: 0,
    bonus_rule: { pct_per_year: 0, max_pct: 0, reduces_on_claim: false },
    restoration: { type: "none", same_illness: false, first_claim_eligible: false },
    si_used_this_year: 0,
    deductible: { amount: 0, type: "none" },
    room_rent:
      e.room === "none"
        ? { rule: "no_cap", value: null, icu_value: null, proportionate_deduction: false }
        : {
            rule: e.room === "pct" ? "pct_si_per_day" : "fixed_amount",
            value: e.room_value,
            icu_value: e.room === "pct" && e.room_value ? e.room_value * 2 : null,
            proportionate_deduction: true,
          },
    copay: e.copay_pct > 0 ? [{ trigger: "all_claims", pct: e.copay_pct }] : [],
    waiting_periods: {
      initial_days: 0,
      specific_months: 0,
      ped_months: e.ped_day1 ? 0 : e.ped_months,
      maternity_months: e.maternity ? 0 : null,
      continuity_start: e.continuity_start,
    },
    sublimits: [],
    pre_post_days: { pre: 30, post: 60 },
    consumables_covered: e.consumables === "yes",
    maternity: {
      covered: e.maternity,
      limit_normal: e.maternity_limit,
      limit_csection: e.maternity_limit,
      newborn_day1: e.maternity,
    },
    international_cover: false,
    fixed_benefits: [],
    renewal_date: e.renewal_date,
    data_status: "user_verified",
    label: e.label || "Employer cover",
    unknown_fields: unknown,
  };
}

export type Errors = Partial<Record<string, string>>;

/** Errors say what went wrong and what to do (§4.6). */
export function validatePolicy(p: Policy, today: string): Errors {
  const e: Errors = {};
  const f = t.fields;
  if (!p.insurer_id) e.insurer_id = t.errors.required(f.insurer);
  if (p.sum_insured !== "unlimited" && !(p.sum_insured > 0))
    e.sum_insured = t.errors.positive(t.add.sumInsured.replace(" (₹)", ""));
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(p.waiting_periods.continuity_start)) e.continuity_start = t.errors.date(t.add.since);
  else if (p.waiting_periods.continuity_start > today) e.continuity_start = t.errors.beforeToday(t.add.since);
  if (!iso.test(p.renewal_date)) e.renewal_date = t.errors.date(t.add.renewal);
  if ((p.policy_type === "super_top_up" || p.policy_type === "top_up") && !(p.deductible.amount > 0)) {
    e.deductible = t.errors.positive(t.add.deductible.replace(" (₹)", ""));
  }
  if (["pct_si_per_day", "fixed_amount"].includes(p.room_rent.rule) && !(Number(p.room_rent.value) > 0)) {
    e.room_value = t.errors.required(f.room_rent);
  }
  p.members.forEach((m, i) => {
    if (!m.name.trim()) e[`member_${i}_name`] = t.errors.required(t.add.memberName);
    if (!iso.test(m.dob)) e[`member_${i}_dob`] = t.errors.date(t.add.memberDob);
  });
  if (Object.keys(e).length === 0) {
    const parsed = PolicySchema.safeParse(p);
    if (!parsed.success) e.form = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  return e;
}
