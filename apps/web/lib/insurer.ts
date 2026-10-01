import { formatDateLong, hasInsufficientHistory, type InsurerMetrics } from "@stacked/claim-engine";
import { t } from "./i18n/en";

/** ICR reading (DECISIONS D5). */
export function icrReading(icr: number | null): string | null {
  if (icr == null) return null;
  if (icr > 100) return t.insurers.icrReading.over100;
  if (icr >= 85) return t.insurers.icrReading.high;
  if (icr >= 55) return t.insurers.icrReading.healthy;
  return t.insurers.icrReading.low;
}

/** Ditto benchmark: under 40 complaints per 10k for SAHIs, under 20 for general insurers. */
export function complaintsReading(m: InsurerMetrics): string | null {
  const v = m.complaints_3yr_avg ?? m.complaints_per_10k_fy26;
  if (v == null) return null;
  const sahi = m.insurer_type === "SAHI";
  const limit = sahi ? 40 : 20;
  const label = sahi ? t.insurers.benchmarkSahi : t.insurers.benchmarkGi;
  return v < limit ? t.insurers.belowBenchmark(label) : t.insurers.aboveBenchmark(label);
}

export const pct = (v: number | null): string => (v == null ? t.insurers.notReported : `${Number(v.toFixed(2))}%`);
export const per10k = (v: number | null): string => (v == null ? t.insurers.notReported : String(Number(v.toFixed(2))));

export const isNew = (m: InsurerMetrics): boolean => hasInsufficientHistory(m);

export const sourceLine = (m: InsurerMetrics): string => t.insurers.source(formatDateLong(m.as_of));

export function networkText(m: InsurerMetrics): string {
  return m.network_hospitals_min == null
    ? t.insurers.notReported
    : t.insurers.networkValue(new Intl.NumberFormat("en-IN").format(m.network_hospitals_min));
}
