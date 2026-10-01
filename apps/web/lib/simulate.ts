import {
  DEFAULT_NIGHTS,
  defaultBillSplit,
  type BillHead,
  type BillItem,
  type CityTier,
  type ClaimScenario,
  type Policy,
  type ScenarioCategory,
} from "@stacked/claim-engine";

/** Everything the Simulate form holds; turned into a ClaimScenario by buildScenario. */
export interface SimulateDraft {
  claimant: string;
  admission_date: string;
  category: ScenarioCategory;
  is_ped: boolean;
  is_accident: boolean;
  admission_type: "planned" | "emergency";
  city_tier: CityTier;
  abroad: boolean;
  network: Record<string, "yes" | "no" | "unknown">;
  room_rate_per_day: number | null;
  nights: number;
  bill_mode: "total" | "items";
  total: number | null;
  items: Record<ItemKey, number>;
  pre_hosp_amount: number;
  post_hosp_amount: number;
}

export type ItemKey = BillHead | "nursing";

export const ITEM_KEYS: { key: ItemKey; head: BillHead; room_linked: boolean; label?: string }[] = [
  { key: "room", head: "room", room_linked: true },
  { key: "icu", head: "icu", room_linked: false },
  { key: "doctor", head: "doctor", room_linked: true },
  { key: "nursing", head: "other", room_linked: true, label: "Nursing" },
  { key: "ot", head: "ot", room_linked: true },
  { key: "investigations", head: "investigations", room_linked: true },
  { key: "medicines", head: "medicines", room_linked: false },
  { key: "implants", head: "implants", room_linked: false },
  { key: "consumables", head: "consumables", room_linked: false },
  { key: "other", head: "other", room_linked: false },
];

/** Typical bill sizes per scenario, used only as a starting value. */
export const DEFAULT_TOTAL: Record<ScenarioCategory, number> = {
  S1: 350000,
  S2: 200000,
  S3: 60000,
  S4: 400000,
  S5: 150000,
  S6: 100000,
  S7: 100000,
  S8: 150000,
  S9: 300000,
  S10: 1000000,
  S11: 900000,
};

export const DEFAULT_ROOM_RATE: Record<CityTier, number> = { metro: 8000, tier2: 5000, tier3: 3000 };

export const todayISO = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
};

export function defaultDraft(policies: Policy[], category: ScenarioCategory = "S4"): SimulateDraft {
  const first = policies.flatMap((p) => p.members)[0]?.name ?? "";
  const zeros = Object.fromEntries(ITEM_KEYS.map((k) => [k.key, 0])) as Record<ItemKey, number>;
  return {
    claimant: first,
    admission_date: todayISO(),
    category,
    is_ped: false,
    is_accident: category === "S2",
    admission_type: category === "S2" ? "emergency" : "planned",
    city_tier: "metro",
    abroad: category === "S10",
    network: Object.fromEntries(policies.map((p) => [p.insurer_id, "unknown" as const])),
    room_rate_per_day: DEFAULT_ROOM_RATE.metro,
    nights: DEFAULT_NIGHTS[category],
    bill_mode: "total",
    total: DEFAULT_TOTAL[category],
    items: zeros,
    pre_hosp_amount: 0,
    post_hosp_amount: 0,
  };
}

/** Bill items for the draft: the user's lines, or the engine's default split of the total. */
export function draftBillItems(d: SimulateDraft): BillItem[] {
  if (d.bill_mode === "total") {
    return defaultBillSplit(d.total ?? 0, d.category, {
      roomRatePerDay: d.room_rate_per_day ?? undefined,
      nights: d.nights,
    });
  }
  return ITEM_KEYS.filter((k) => (d.items[k.key] ?? 0) > 0).map((k) => {
    const item: BillItem = { head: k.head, amount: d.items[k.key], room_linked: k.room_linked };
    if (k.label) item.label = k.label;
    return item;
  });
}

export function buildScenario(d: SimulateDraft): ClaimScenario {
  return {
    scenario_id: `sim_${d.admission_date}_${d.category}`,
    claimant: d.claimant,
    category: d.category,
    is_ped: d.is_ped,
    is_accident: d.is_accident,
    admission_date: d.admission_date,
    admission_type: d.admission_type,
    hospital: {
      id: null,
      city_tier: d.city_tier,
      abroad: d.abroad,
      in_network_by_insurer: Object.fromEntries(
        Object.entries(d.network)
          .filter(([, v]) => v !== "unknown")
          .map(([k, v]) => [k, v === "yes"]),
      ),
    },
    room_rate_per_day: d.room_rate_per_day ?? 0,
    length_of_stay_days: d.nights,
    bill_items: draftBillItems(d),
    pre_hosp_amount: d.pre_hosp_amount,
    post_hosp_amount: d.post_hosp_amount,
  };
}

/** Every member name across the vault, for the "who is being admitted" picker. */
export function memberNames(policies: Policy[]): string[] {
  return [...new Set(policies.flatMap((p) => p.members.map((m) => m.name.trim())).filter(Boolean))];
}
