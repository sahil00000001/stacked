/*
 * Parsers that turn the research doc's tables into seed rows. Kept separate
 * from extract.ts so the tests can run them against the doc directly.
 */
import {
  InsurerMetricsSchema,
  ProductSchema,
  ScenarioSchema,
  type InsurerMetrics,
  type PolicyType,
  type Product,
  type Scenario,
} from "@stacked/claim-engine";

export const AS_OF_METRICS = "2026-09-07"; // "Ditto Data Lab … updated 7 Sept 2026"
export const AS_OF_PRODUCTS = "2026-09-30"; // "Treat Table B values as a snapshot dated September 2026"
export const METRICS_SOURCE_URL = "https://joinditto.in/health-insurance/data-lab/";
export const METRIC_DEFINITION = "NL-37 Ditto method";

/* ── Markdown helpers ─────────────────────────────────────────── */

/** Text from a heading line that starts with `heading` up to the next heading of the same or higher level. */
export function section(md: string, heading: string): string {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start < 0) throw new Error(`Heading not found: ${heading}`);
  const level = heading.match(/^#+/)![0].length;
  const end = lines.findIndex((l, i) => i > start && /^#+ /.test(l) && l.match(/^#+/)![0].length <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

/** Rows of the first pipe table in `text`, header excluded, cells trimmed. */
export function tableRows(text: string): string[][] {
  const rows = text.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  return rows
    .slice(2) // header + separator
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0]!);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [header[i]!, v])));
}

const num = (v: string | undefined): number | null => (v == null || v === "" || v === "NA" ? null : Number(v));
export const notFound = (v: string | undefined): boolean => !v || /^(not found|—|-)$/i.test(v.trim());
const orNull = (v: string | undefined): string | null => (notFound(v) ? null : v!.trim());

export const slug = (v: string): string =>
  v
    .toLowerCase()
    .replace(/[+]/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ── Table A ──────────────────────────────────────────────────── */

export function parseInsurers(md: string): InsurerMetrics[] {
  const block = md.match(/#### Table A as CSV[\s\S]*?```csv\r?\n([\s\S]*?)```/);
  if (!block) throw new Error("Table A CSV block not found");
  return parseCSV(block[1]!).map((r) =>
    InsurerMetricsSchema.parse({
      insurer_id: r.insurer_id,
      insurer_name: r.insurer_name,
      insurer_type: r.insurer_type,
      csr_fy24: num(r.csr_fy24),
      csr_fy25: num(r.csr_fy25),
      csr_fy26: num(r.csr_fy26),
      csr_3yr_avg: num(r.csr_3yr_avg),
      icr_fy23: num(r.icr_fy23),
      icr_fy24: num(r.icr_fy24),
      icr_fy25: num(r.icr_fy25),
      health_gwp_fy26_cr: num(r.health_gwp_fy26_cr),
      complaints_per_10k_fy26: num(r.complaints_per_10k_fy26),
      complaints_3yr_avg: num(r.complaints_3yr_avg),
      network_hospitals_min: num(r.network_hospitals_min),
      flags: r.flags ?? "",
      as_of: AS_OF_METRICS,
      source_url: METRICS_SOURCE_URL,
      metric_definition: METRIC_DEFINITION,
    }),
  );
}

/* ── Field readers for Table B free text ──────────────────────── */

const INSURER_IDS: [RegExp, string][] = [
  [/^hdfc ergo/i, "hdfc-ergo"],
  [/^care health/i, "care-health"],
  [/^niva bupa/i, "niva-bupa"],
  [/^aditya birla/i, "aditya-birla-health"],
  [/^icici lombard/i, "icici-lombard"],
  [/^star/i, "star-health"],
  [/^bajaj/i, "bajaj-general"],
  [/^tata aig/i, "tata-aig"],
  [/^sbi/i, "sbi-general"],
  [/^manipalcigna/i, "manipalcigna"],
  [/^new india/i, "new-india"],
  [/^indusind/i, "indusind-general"],
  [/^royal sundaram/i, "royal-sundaram"],
  [/^acko/i, "acko"],
  [/^digit/i, "go-digit"],
  [/^generali central/i, "generali-central"],
  [/^oriental/i, "oriental"],
  [/^united india/i, "united-india"],
  [/^national insurance/i, "national"],
  [/^galaxy health/i, "galaxy-health"],
  [/^narayana health/i, "narayana-health"],
  [/^all insurers/i, "*"],
];

export function insurerIdFor(name: string): string {
  const hit = INSURER_IDS.find(([re]) => re.test(name.trim()));
  if (!hit) throw new Error(`Unknown insurer: ${name}`);
  return hit[1];
}

const UNIT: Record<string, number> = { k: 1e3, l: 1e5, cr: 1e7 };

export function readSI(text: string): { min: number | "unlimited" | null; max: number | "unlimited" | null } {
  if (notFound(text)) return { min: null, max: null };
  const amounts = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(k|L|Cr)\b/gi)].map(
    (m) => Number(m[1]) * UNIT[m[2]!.toLowerCase()]!,
  );
  const unlimited = /unlimited/i.test(text);
  const upTo = /^up to/i.test(text.trim());
  const min = upTo ? null : (amounts[0] ?? null);
  const max = unlimited ? "unlimited" : (amounts.at(-1) ?? null);
  return { min, max };
}

export function readRoomRule(text: string): Product["room_rent_rule"] {
  if (notFound(text)) return null;
  const t = text.toLowerCase();
  if (/^(no cap|actuals|no room|no limit)/.test(t)) return "NO_CAP";
  if (/^(silver: )?\d+(\.\d+)?% of si/.test(t)) return "PCT_SI";
  if (/^single private ac/.test(t)) return "SINGLE_PVT_AC";
  if (/^any room except/.test(t)) return "ANY_EXCEPT_SUITE";
  if (/general ward|twin.sharing/.test(t)) return "CATEGORY";
  return null;
}

/** IRDAI maximum PED wait since April 2024 (doc §1 point 4). */
export const MAX_PED_MONTHS = 36;

/**
 * Longest "N yrs" / "N m" figure in months — the conservative reading when a
 * cell lists several variants. A bare leading 0 with no other figure means 0.
 * Day figures ("90 days") are ignored.
 */
export function readMonths(text: string): number | null {
  if (notFound(text)) return null;
  const figures = [...text.matchAll(/(\d+)\s*(yrs?|years?|m\b|months?)/gi)].map((m) =>
    /^y/i.test(m[2]!) ? Number(m[1]) * 12 : Number(m[1]),
  );
  if (figures.length) return Math.max(...figures);
  return /^0\b/.test(text.trim()) ? 0 : null;
}

export const readPed = (text: string): number | null => {
  const m = readMonths(text);
  return m == null ? null : Math.min(m, MAX_PED_MONTHS);
};

export function readBonus(text: string): { pct: number | null; max: number | null; reduces: boolean | null } {
  if (notFound(text)) return { pct: null, max: null, reduces: null };
  if (/^no ncb/i.test(text.trim())) return { pct: 0, max: 0, reduces: false };
  const segment = text.split(";").find((s) => /%/.test(s)) ?? "";
  const pcts = [...segment.matchAll(/(\d[\d,]*)%/g)].map((m) => Number(m[1]!.replace(/,/g, "")));
  const pct = pcts[0] ?? null;
  const rest = pcts.slice(1);
  const max = rest.length ? Math.max(...rest) : null;
  const reduces = /guaranteed|regardless|claims or not|every year/i.test(text)
    ? false
    : /reduces/i.test(text)
      ? true
      : null;
  return { pct, max, reduces };
}

export function readPrePost(text: string): { pre: number | null; post: number | null } {
  const m = text.match(/^(\d+)\s*\/\s*(\d+)/);
  return m ? { pre: Number(m[1]), post: Number(m[2]) } : { pre: null, post: null };
}

export function readConsumables(text: string): Product["consumables"] {
  if (notFound(text)) return null;
  const t = text.toLowerCase();
  if (/^(built-in|covered|specified consumables)/.test(t)) return "BUILT_IN";
  if (/add-on|claims? shield/.test(t)) return "ADDON";
  return null;
}

export function readUIN(text: string): string | null {
  return text.match(/\b[A-Z]{6,}\d{2}\d+V\d+\b/)?.[0] ?? null;
}

function splitNameVariant(name: string): { product_name: string; variant: string | null } {
  const m = name.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { product_name: m[1]!.trim(), variant: m[2]!.trim() } : { product_name: name.trim(), variant: null };
}

const typeFromText = (text: string): PolicyType | null => {
  const t = text.toLowerCase();
  if (/super top-up/.test(t)) return "super_top_up";
  if (/critical|cancer|criti |criti$|fixed benefit/.test(t)) return "critical_illness";
  if (/senior|red carpet/.test(t)) return "senior";
  if (/group/.test(t)) return "group";
  if (/floater/.test(t)) return "family_floater";
  return null;
};

function product(row: Omit<Product, "as_of" | "source_url">): Product {
  return ProductSchema.parse({ ...row, as_of: AS_OF_PRODUCTS, source_url: null });
}

const EMPTY = {
  uin: null,
  si_min: null,
  si_max: null,
  room_rent_rule: null,
  room_rent_value: null,
  copay_rule: null,
  ped_wait_months: null,
  specific_wait_months: null,
  restoration: null,
  bonus_pct_per_year: null,
  bonus_max_pct: null,
  bonus_reduces_on_claim: null,
  pre_days: null,
  post_days: null,
  consumables: null,
  maternity: null,
  indicative_premium: null,
  known_features: null,
  sources: null,
} as const;

/* ── Table B1 ─────────────────────────────────────────────────── */

export function parseB1(md: string): Product[] {
  const rows = tableRows(section(md, "### 3.2 Table B1"));
  return rows.map((c) => {
    const [
      insurer,
      name,
      uin,
      si,
      room,
      copay,
      ped,
      specific,
      restoration,
      bonus,
      prepost,
      consumables,
      maternity,
      premium,
      sources,
    ] = c as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const insurer_id = insurerIdFor(insurer);
    const { product_name, variant } = splitNameVariant(name);
    const range = readSI(si);
    const b = readBonus(bonus);
    const pp = readPrePost(prepost);
    return product({
      ...EMPTY,
      product_id: insurer_id === "*" ? slug(product_name) : `${insurer_id}-${slug(product_name)}`,
      insurer_id,
      product_name,
      variant,
      product_type: typeFromText(name) ?? "individual",
      uin: readUIN(uin),
      si_min: range.min,
      si_max: range.max,
      room_rent_rule: readRoomRule(room),
      room_rent_value: orNull(room),
      copay_rule: orNull(copay),
      ped_wait_months: readPed(ped),
      specific_wait_months: readMonths(specific),
      restoration: orNull(restoration),
      bonus_pct_per_year: b.pct,
      bonus_max_pct: b.max,
      bonus_reduces_on_claim: b.reduces,
      pre_days: pp.pre,
      post_days: pp.post,
      consumables: readConsumables(consumables),
      maternity: orNull(maternity),
      indicative_premium: orNull(premium),
      sources: orNull(sources),
      data_status: "partial",
    });
  });
}

/* ── Table B2 and the name-only list ──────────────────────────── */

const B2_TYPES: Record<string, PolicyType> = {
  "individual/floater": "individual",
  "super top-up": "super_top_up",
  "critical illness (fixed)": "critical_illness",
  "critical illness": "critical_illness",
  "critical illness / cardiac": "critical_illness",
  "fixed benefit": "critical_illness",
  "diabetes/ped plan": "individual",
  senior: "senior",
  "young/fitness plan": "individual",
  floater: "family_floater",
  "women-specific": "individual",
  "disease-specific": "individual",
  indemnity: "individual",
};

function featuresToFields(f: string, productName: string, rowNames: string[]): Partial<Product> {
  const t = f.toLowerCase();
  const out: Partial<Product> = {};
  if (/no room-rent limit|no room limit|no room-type limit|no room-rent cap/.test(t)) {
    out.room_rent_rule = "NO_CAP";
    out.room_rent_value = "No cap";
  } else if (/single private ac/.test(t)) {
    out.room_rent_rule = "SINGLE_PVT_AC";
    out.room_rent_value = "Single private AC";
  } else if (/any room except suite/.test(t)) {
    out.room_rent_rule = "ANY_EXCEPT_SUITE";
    out.room_rent_value = "Any room except suite";
  } else if (/twin-sharing/.test(t)) {
    out.room_rent_rule = "CATEGORY";
    out.room_rent_value = "Twin-sharing room";
  }
  const copay = f.match(/(\d+)% co-pay/i);
  if (copay) out.copay_rule = `${copay[1]}% on all claims`;
  else if (/no co-pay/.test(t)) out.copay_rule = "None";
  const ped = f.match(/(\d+)-m PED/i);
  if (ped) out.ped_wait_months = Number(ped[1]);
  // "consumables (Infinity)" on a two-product row applies only to the product it names
  const scope = f.match(/consumables \(([^)]+)\)/i)?.[1];
  const scoped = scope !== undefined && rowNames.some((n) => n.includes(scope));
  if (/consumables/.test(t) && (!scoped || productName.includes(scope))) out.consumables = "BUILT_IN";
  const si = f.match(/(?:SI\s*)?₹[\d.]+(?:k|L|Cr)[–-][\d.]+(?:k|L|Cr)/);
  if (si) {
    const r = readSI(si[0]);
    out.si_min = r.min;
    out.si_max = r.max;
  }
  const pp = f.match(/(\d+)\/(\d+) days/);
  if (pp) {
    out.pre_days = Number(pp[1]);
    out.post_days = Number(pp[2]);
  }
  if (/unlimited restoration/.test(t)) out.restoration = "Unlimited";
  return out;
}

export function parseB2(md: string): Product[] {
  const sec = section(md, "### 3.3 Table B2");
  const rows = tableRows(sec);
  const products: Product[] = [];
  for (const [insurer, names, type, features] of rows as [string, string, string, string][]) {
    const insurer_id = insurerIdFor(insurer);
    const rowNames = names.split(";").map((n) => n.trim());
    for (const name of rowNames) {
      const { product_name, variant } = splitNameVariant(name);
      products.push(
        product({
          ...EMPTY,
          product_id: `${insurer_id}-${slug(product_name)}`,
          insurer_id,
          product_name,
          variant,
          product_type: B2_TYPES[type.toLowerCase()] ?? null,
          known_features: features,
          ...featuresToFields(features, product_name, rowNames),
          data_status: "partial",
        }),
      );
    }
  }
  return [...products, ...parseNameOnly(sec)];
}

const NAME_ONLY_PREFIXES = [
  "HDFC ERGO",
  "Niva Bupa",
  "Aditya Birla",
  "Star",
  "Bajaj",
  "Tata AIG",
  "ManipalCigna",
  "SBI",
  "Acko",
  "Digit",
  "Generali Central",
  "New India",
  "Oriental",
  "United India",
  "National Insurance",
  "Galaxy Health",
  "Narayana Health",
];

export function parseNameOnly(sec: string): Product[] {
  const line = sec.split(/\r?\n/).find((l) => l.startsWith("**Found by name only"));
  if (!line) throw new Error("Name-only list not found");
  const body = line.replace(/^\*\*Found by name only[^:]*:\*\*\s*/, "").replace(/\.\s*$/, "");
  const out: Product[] = [];
  for (const seg of body.split(";").map((s) => s.trim())) {
    const prefix = NAME_ONLY_PREFIXES.find((p) => seg.startsWith(p));
    if (!prefix) throw new Error(`No insurer prefix in: ${seg}`);
    const insurer_id = insurerIdFor(prefix === "Aditya Birla" ? "Aditya Birla Health" : prefix);
    const names = seg
      .slice(prefix.length)
      .split(/,(?![^(]*\))/)
      .flatMap((n) => n.split(" / "))
      .map((n) => n.trim().replace(new RegExp(`^${prefix}\\s+`), ""))
      .filter(Boolean);
    for (const raw of names) {
      const note = raw.match(/\(([^)]*)\)\s*$/)?.[1] ?? null;
      const name = raw.replace(/\s*\([^)]*\)\s*$/, "");
      const product_name = name.charAt(0).toUpperCase() + name.slice(1);
      out.push(
        product({
          ...EMPTY,
          product_id: `${insurer_id}-${slug(product_name)}`,
          insurer_id,
          product_name,
          variant: null,
          product_type: typeFromText(`${product_name} ${note ?? ""}`),
          known_features: note,
          data_status: "name_only",
        }),
      );
    }
  }
  return out;
}

/* ── Table C ──────────────────────────────────────────────────── */

const lead = (v: string) => Number(v.match(/^\d+/)![0]);

export function parseScenarios(md: string): Scenario[] {
  return tableRows(section(md, "### 4.2 Table C")).map((c) => {
    const [id, name, room, copay, sub, wait, ped, rest, cons, net, pp, mat, csr, notes] = c as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    return ScenarioSchema.parse({
      scenario_id: id,
      scenario_name: name,
      room_rent: lead(room),
      copay: lead(copay),
      sublimit: lead(sub),
      initial_specific_wait: lead(wait),
      ped_wait: lead(ped),
      restoration: lead(rest),
      consumables: lead(cons),
      cashless_network: lead(net),
      pre_post_days: lead(pp),
      maternity: lead(mat),
      csr_weight: Number(csr),
      notes,
    });
  });
}
