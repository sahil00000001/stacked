"use client";

import { useMemo, useState } from "react";
import { formatDateLong, type InsurerMetrics } from "@stacked/claim-engine";
import { SelectField, TextField } from "@/components/FieldRow";
import { InsurerRow } from "@/components/InsurerScorecard";
import { SourceNote } from "@/components/primitives";
import { isNew } from "@/lib/insurer";
import { t } from "@/lib/i18n/en";

type Sort = "csr" | "complaints" | "name";

export function InsurerList({ insurers }: { insurers: InsurerMetrics[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("csr");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = insurers.filter((i) => !needle || i.insurer_name.toLowerCase().includes(needle));
    const rated = (i: InsurerMetrics) => (isNew(i) ? 1 : 0);
    return [...list].sort((a, b) => {
      if (sort === "name") return a.insurer_name.localeCompare(b.insurer_name);
      if (rated(a) !== rated(b)) return rated(a) - rated(b);
      if (sort === "csr") return (b.csr_3yr_avg ?? 0) - (a.csr_3yr_avg ?? 0);
      return (a.complaints_3yr_avg ?? Infinity) - (b.complaints_3yr_avg ?? Infinity);
    });
  }, [insurers, q, sort]);
  const asOf = insurers[0]?.as_of;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField
          label={t.insurers.search}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <SelectField label={t.insurers.sort} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="csr">{t.insurers.sortOptions.csr}</option>
          <option value="complaints">{t.insurers.sortOptions.complaints}</option>
          <option value="name">{t.insurers.sortOptions.name}</option>
        </SelectField>
      </div>
      <SourceNote>
        {t.insurers.claimRecord}. Complaints per 10,000 claims, FY24–26 average (NL-45).
        {asOf ? ` As of ${formatDateLong(asOf)}.` : ""}
      </SourceNote>
      <ul className="flex flex-col gap-3" aria-label={t.insurers.title}>
        {rows.map((i) => (
          <InsurerRow key={i.insurer_id} insurer={i} />
        ))}
      </ul>
    </div>
  );
}
