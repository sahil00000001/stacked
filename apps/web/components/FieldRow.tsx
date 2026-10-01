"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { formatINR } from "@stacked/claim-engine";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n/en";

/** Read mode: plain-language label and value; null shows "Not known". */
export function FieldRow({
  label,
  value,
  note,
  unknown,
}: {
  label: string;
  value: ReactNode | null;
  note?: string;
  unknown?: boolean;
}) {
  const missing = value == null || value === "" || value === t.common.notKnown;
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-edge py-3 last:border-b-0 min-[390px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] min-[390px]:gap-4">
      <dt className="text-14 text-ash font-medium">{label}</dt>
      <dd className={cx("text-16", missing ? "text-ash font-medium" : "text-bone")}>
        {missing ? t.common.notKnown : value}
        {unknown && !missing && <span className="block text-14 text-ash font-medium">{t.vault.unknownBadge}</span>}
        {note && <span className="block text-14 text-ash font-medium">{note}</span>}
      </dd>
    </div>
  );
}

interface FieldShell {
  label: string;
  hint?: string;
  error?: string | null;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Edit mode shell: label, control, hint, error — wired with aria-describedby. */
export function Field({ label, hint, error, children }: FieldShell) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-14 font-medium text-bone">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-14 text-ash font-medium">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-14 font-medium text-risk" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className="field"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...input}
        />
      )}
    </Field>
  );
}

/** Rupee input: digits only; shows the Indian-grouped value beside the hint. */
export function MoneyField({
  label,
  hint,
  error,
  value,
  onValue,
  name,
  disabled,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  value: number | null;
  onValue: (v: number | null) => void;
  name?: string;
  disabled?: boolean;
}) {
  const shown = value != null && value > 0 ? formatINR(value) : null;
  return (
    <Field label={label} hint={[shown, hint].filter(Boolean).join(" — ") || undefined} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          name={name}
          className="field money"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={value == null ? "" : String(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "");
            onValue(digits === "" ? null : Number(digits));
          }}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...select
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          className="field"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...select}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

/** Radio group drawn as choice chips. */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  hint,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-1.5 text-14 font-medium text-bone">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-14 text-ash font-medium">
          {hint}
        </p>
      )}
    </fieldset>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <ChoiceGroup
      legend={label}
      name={label}
      hint={hint}
      value={checked ? "yes" : "no"}
      options={[
        { value: "yes", label: t.common.yes },
        { value: "no", label: t.common.no },
      ]}
      onChange={(v) => onChange(v === "yes")}
    />
  );
}
