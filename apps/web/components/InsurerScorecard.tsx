import Link from "next/link";
import type { InsurerMetrics } from "@stacked/claim-engine";
import { complaintsReading, icrReading, isNew, networkText, pct, per10k, sourceLine } from "@/lib/insurer";
import { t } from "@/lib/i18n/en";
import { Disclaimer, SourceNote } from "./primitives";

/** 3-point CSR trend: a 1.5px bone polyline with ash labels. No fill, no gradient. */
export function Sparkline({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const W = 220;
  const H = 64;
  const pad = { x: 24, top: 18, bottom: 18 };
  const known = values.filter((v): v is number => v != null);
  if (known.length === 0) return null;
  const min = Math.min(...known) - 1;
  const max = Math.max(...known) + 1;
  const x = (i: number) => pad.x + (i * (W - pad.x * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => pad.top + ((max - v) / (max - min || 1)) * (H - pad.top - pad.bottom);
  const pts = values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)));
  const line = pts
    .filter(Boolean)
    .map((p) => p!.join(","))
    .join(" ");
  const desc = values.map((v, i) => `${labels[i]} ${v == null ? "not reported" : `${v}%`}`).join(", ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`${t.insurers.trend}: ${desc}`}
      className="overflow-visible"
    >
      <polyline points={line} fill="none" stroke="var(--bone)" strokeWidth="1.5" />
      {pts.map((p, i) =>
        p ? (
          <g key={labels[i]}>
            <circle cx={p[0]} cy={p[1]} r="2.5" fill="var(--bone)" />
            <text x={p[0]} y={p[1] - 7} textAnchor="middle" fontSize="11" fill="var(--ash)" className="money">
              {values[i]}
            </text>
          </g>
        ) : null,
      )}
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - 2} textAnchor="middle" fontSize="11" fill="var(--ash)">
          {l}
        </text>
      ))}
    </svg>
  );
}

function Metric({
  label,
  value,
  note,
  sub,
  small,
}: {
  label: string;
  value: string;
  note?: string | null;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-edge pt-4">
      <h3 className="text-14 font-medium text-ash">{label}</h3>
      <p className={small ? "money text-20" : "money text-28"}>{value}</p>
      {sub && <p className="text-14 font-medium text-ash">{sub}</p>}
      {note && <p className="text-16 text-bone">{note}</p>}
    </div>
  );
}

/** List row: name, type, the headline figures, each with its period. */
export function InsurerRow({ insurer }: { insurer: InsurerMetrics }) {
  const fresh = isNew(insurer);
  return (
    <li>
      <Link
        href={`/insurers/${insurer.insurer_id}`}
        className="grain flex flex-col gap-2 rounded-card border border-edge p-4 text-bone no-underline"
        aria-label={t.insurers.view(insurer.insurer_name)}
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-16 font-medium">{insurer.insurer_name}</span>
          <span className="text-14 font-medium text-ash">{t.insurers.type[insurer.insurer_type]}</span>
        </span>
        <span className="flex flex-wrap gap-x-6 gap-y-1 text-14 font-medium">
          <span>
            <span className="text-ash">{t.insurers.claimRecordShort}: </span>
            <span className="money">{fresh ? t.insurers.insufficient : pct(insurer.csr_3yr_avg)}</span>
          </span>
          <span>
            <span className="text-ash">{t.insurers.complaints}, 3-yr: </span>
            <span className="money">{per10k(insurer.complaints_3yr_avg)}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Full scorecard. Every figure carries its FY and source; insurer-level only. */
export function InsurerScorecard({ insurer }: { insurer: InsurerMetrics }) {
  const fresh = isNew(insurer);
  const over100 = [insurer.csr_fy24, insurer.csr_fy25, insurer.csr_fy26].some((v) => v != null && v > 100);
  return (
    <article className="flex flex-col gap-5" aria-labelledby="insurer-name">
      <header className="flex flex-col gap-1">
        <h1 id="insurer-name" className="text-28">
          {insurer.insurer_name}
        </h1>
        <p className="text-16 font-medium text-ash">{t.insurers.type[insurer.insurer_type]}</p>
      </header>

      <div className="flex flex-col gap-1 border-t border-edge pt-4">
        <h2 className="text-14 font-medium text-ash">{t.insurers.claimRecord}</h2>
        {fresh ? (
          <>
            <p className="text-28">{t.insurers.insufficient}</p>
            <p className="text-16 text-bone">{t.insurers.insufficientDetail}</p>
          </>
        ) : (
          <p className="money text-40 font-medium">{pct(insurer.csr_3yr_avg)}</p>
        )}
        <div className="mt-2">
          <Sparkline
            values={[insurer.csr_fy24, insurer.csr_fy25, insurer.csr_fy26]}
            labels={["FY24", "FY25", "FY26"]}
          />
        </div>
        {over100 && <p className="text-14 font-medium text-ash">{t.insurers.over100}</p>}
        <SourceNote>Claims settled by number, NL-37 Ditto method, FY24–FY26.</SourceNote>
      </div>

      <Metric
        label={`${t.insurers.complaints}, FY24–26 average`}
        value={per10k(insurer.complaints_3yr_avg)}
        sub={`FY26: ${per10k(insurer.complaints_per_10k_fy26)}. Source: NL-45 grievance disclosures.`}
        note={complaintsReading(insurer)}
      />
      <Metric
        label={t.insurers.icr}
        value={pct(insurer.icr_fy25)}
        sub={`${t.insurers.icrHint} FY23 ${pct(insurer.icr_fy23)}, FY24 ${pct(insurer.icr_fy24)}. Source: IRDAI annual reports.`}
        note={icrReading(insurer.icr_fy25)}
      />
      <Metric label={t.insurers.network} value={networkText(insurer)} sub="As stated by the insurer." small />

      <div className="flex flex-col gap-2 border-t border-edge pt-4">
        <h2 className="text-14 font-medium text-ash">{t.insurers.flags}</h2>
        {insurer.flags ? (
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {insurer.flags.split(";").map((f) => (
              <li key={f} className="text-16">
                {f.trim()}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-16 text-ash font-medium">{t.insurers.noFlags}</p>
        )}
      </div>

      <SourceNote>{sourceLine(insurer)}</SourceNote>
      <Disclaimer />
    </article>
  );
}
