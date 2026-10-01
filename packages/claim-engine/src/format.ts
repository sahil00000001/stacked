const fullINR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** One decimal, trailing ".0" dropped. Works on integer tenths to avoid float drift. */
const tenths = (n: number, unit: number): string => {
  const t = Math.round((n * 10) / unit);
  return t % 10 === 0 ? String(t / 10) : (t / 10).toFixed(1);
};

/**
 * Rupee formatting with Indian grouping.
 * full:    ₹1,20,000 (ledgers)
 * compact: ₹1.2L, ₹38k, ₹1.5Cr (bars, cards, sentences)
 */
export function formatINR(amount: number, opts: { compact?: boolean } = {}): string {
  const n = Math.round(amount);
  if (!opts.compact) return fullINR.format(n);
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  // switch units where rounding would otherwise print "₹100k" or "₹100L"
  if (Math.round(a / 1e4) >= 1000) return `${sign}₹${tenths(a, 1e7)}Cr`;
  if (Math.round(a / 1e3) >= 100) return `${sign}₹${tenths(a, 1e5)}L`;
  if (a >= 1000) return `${sign}₹${Math.round(a / 1000)}k`;
  return `${sign}${fullINR.format(a)}`;
}

export function formatPct(value: number, digits = 1): string {
  return `${Number(value.toFixed(digits))}%`;
}
