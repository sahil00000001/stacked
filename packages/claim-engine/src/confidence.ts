import { METRIC_PERIOD, METRIC_SOURCE } from "./config.js";
import { render, type Catalogue } from "./messages.en.js";
import type { ClaimScenario, InsurerMetrics } from "./schemas.js";
import type { Confidence, ConfidenceLevel, Weights } from "./types.js";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const oneDecimal = (v: number) => String(Number(v.toFixed(1)));

/** "HDFC ERGO General Insurance" → "HDFC ERGO"; "The New India Assurance" → "New India Assurance". */
export function shortInsurerName(name: string): string {
  return name
    .replace(/\s*\(formerly[^)]*\)/i, "")
    .replace(/^The\s+/i, "")
    .replace(/\s+(General Insurance|Health Insurance|Insurance Company|Insurance)$/i, "")
    .trim();
}

export function historyYears(m: InsurerMetrics): number {
  return [m.csr_fy24, m.csr_fy25, m.csr_fy26].filter((v) => v != null).length;
}

export function hasInsufficientHistory(m: InsurerMetrics): boolean {
  return historyYears(m) < 3 || m.csr_3yr_avg == null;
}

export function cashlessStatus(insurerId: string, s: ClaimScenario): 0 | 0.5 | 1 {
  const v = s.hospital.in_network_by_insurer[insurerId];
  return v === true ? 1 : v === false ? 0 : 0.5;
}

function levelFor(value: number, t: Weights["level_thresholds"]): 1 | 2 | 3 | 4 | 5 {
  if (value >= t[0]) return 5;
  if (value >= t[1]) return 4;
  if (value >= t[2]) return 3;
  if (value >= t[3]) return 2;
  return 1;
}

/**
 * Section 8 step 3:
 *   conf = 0.4·CSR_3yr + 0.3·(1 − repudiation) + 0.2·(1 − complaints_norm) + 0.1·cashless
 * with the CSR and complaints weights multiplied by the scenario's csr_weight
 * (Table C), then renormalised so conf stays in 0–1.
 */
export function computeConfidence(
  insurerId: string,
  insurer: InsurerMetrics | undefined,
  s: ClaimScenario,
  w: Weights,
  cat: Catalogue,
): Confidence {
  const csrWeight = w.csr_weight_by_category[s.category];
  const cashless = cashlessStatus(insurerId, s);

  const years = insurer
    ? [insurer.csr_fy24, insurer.csr_fy25, insurer.csr_fy26].filter((v): v is number => v != null)
    : [];
  const csrPct =
    insurer?.csr_3yr_avg ?? (years.length ? years.reduce((a, b) => a + b, 0) / years.length : w.industry_mean_csr);
  const csr = clamp01(csrPct / 100);
  const repudiation = insurer?.repudiation_ratio != null ? insurer.repudiation_ratio / 100 : 1 - csr;
  const complaints = insurer?.complaints_3yr_avg ?? insurer?.complaints_per_10k_fy26 ?? w.industry_mean_complaints;
  const complaintsNorm = clamp01(complaints / w.complaints_cap);

  const a = w.w_csr * csrWeight;
  const c = w.w_complaints * csrWeight;
  let value =
    (a * csr + w.w_repudiation * (1 - repudiation) + c * (1 - complaintsNorm) + w.w_cashless * cashless) /
    (a + w.w_repudiation + c + w.w_cashless);

  const insufficient = !insurer || hasInsufficientHistory(insurer);
  if (insufficient) value = Math.min(value, w.insufficient_history_cap);

  const level: ConfidenceLevel = insufficient ? "insufficient_history" : levelFor(value, w.level_thresholds);
  const label = render(cat, `level_${level}`);
  const name = insurer ? shortInsurerName(insurer.insurer_name) : insurerId;

  let text: string;
  if (!insurer) text = render(cat, "confidence_unknown_insurer");
  else if (insufficient) text = render(cat, "confidence_insufficient", { insurer: name });
  else
    text = render(cat, "confidence_text", {
      level: label,
      insurer: name,
      csr: oneDecimal(csrPct),
      period: METRIC_PERIOD,
      complaints: oneDecimal(complaints),
    });

  return {
    value,
    level,
    label,
    insurer_id: insurerId,
    insurer_name: name,
    csr_3yr: insurer?.csr_3yr_avg ?? null,
    complaints_3yr: insurer?.complaints_3yr_avg ?? null,
    cashless,
    period: METRIC_PERIOD,
    source: METRIC_SOURCE,
    as_of: insurer?.as_of ?? null,
    text,
  };
}
