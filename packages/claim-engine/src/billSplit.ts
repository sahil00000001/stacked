import type { BillHead, BillItem, ScenarioCategory } from "./schemas.js";

type Part = { head: BillHead; label?: string; weight: number; room_linked: boolean };

const part = (head: BillHead, weight: number, room_linked: boolean, label?: string): Part =>
  label ? { head, weight, room_linked, label } : { head, weight, room_linked };

/** Weights for [room, doctor, nursing, OT, investigations, medicines, implants, consumables]. */
const shape = (w: [number, number, number, number, number, number, number, number]): Part[] => [
  part("room", w[0], true),
  part("doctor", w[1], true),
  part("other", w[2], true, "Nursing"),
  part("ot", w[3], true),
  part("investigations", w[4], true),
  part("medicines", w[5], false),
  part("implants", w[6], false),
  part("consumables", w[7], false),
];

/**
 * Default bill split when only a total is known. The generic shape is the
 * section 8.1 shared bill (₹32k/40k/8k/50k/30k/80k/35k/25k of ₹3L); the
 * per-scenario shapes lean on Table C (implants for joints and stents,
 * medicines for chemo, room and tests for medical admissions).
 */
const GENERIC = shape([32, 40, 8, 50, 30, 80, 35, 25]);
const SPLITS: Partial<Record<ScenarioCategory, Part[]>> = {
  S1: shape([8, 14, 3, 18, 6, 12, 30, 9]),
  S2: shape([10, 14, 3, 15, 10, 18, 20, 10]),
  S3: shape([30, 15, 7, 0, 20, 20, 0, 8]),
  S4: shape([8, 12, 3, 15, 10, 14, 28, 10]),
  S5: shape([5, 10, 3, 0, 12, 62, 0, 8]),
  S6: shape([25, 25, 7, 15, 8, 12, 0, 8]),
  S7: shape([28, 16, 7, 0, 20, 21, 0, 8]),
  S8: shape([30, 18, 8, 0, 14, 18, 0, 12]),
};

export const DEFAULT_NIGHTS: Record<ScenarioCategory, number> = {
  S1: 3,
  S2: 4,
  S3: 4,
  S4: 4,
  S5: 1,
  S6: 3,
  S7: 4,
  S8: 6,
  S9: 4,
  S10: 5,
  S11: 6,
};

/**
 * Splits a total bill into heads. When room rate and nights are known, the
 * room line is rate × nights and the rest is shared by the remaining weights.
 */
export function defaultBillSplit(
  total: number,
  category: ScenarioCategory,
  opts: { roomRatePerDay?: number; nights?: number } = {},
): BillItem[] {
  const parts = SPLITS[category] ?? GENERIC;
  const amount = Math.max(0, Math.round(total));
  const roomFixed =
    opts.roomRatePerDay && opts.nights ? Math.min(amount, Math.round(opts.roomRatePerDay * opts.nights)) : null;

  const shares = parts.map((p) => (roomFixed != null && p.head === "room" ? 0 : p.weight));
  const shareSum = shares.reduce((a, b) => a + b, 0);
  const pool = roomFixed != null ? amount - roomFixed : amount;

  const amounts = parts.map((p, i) =>
    roomFixed != null && p.head === "room" ? roomFixed : Math.round((pool * shares[i]!) / shareSum),
  );
  // put rounding drift on the largest line so the split sums to the total
  const drift = amount - amounts.reduce((a, b) => a + b, 0);
  const largest = amounts.indexOf(Math.max(...amounts));
  amounts[largest]! += drift;

  return parts
    .map((p, i): BillItem => {
      const item: BillItem = { head: p.head, amount: amounts[i]!, room_linked: p.room_linked };
      if (p.label) item.label = p.label;
      return item;
    })
    .filter((b) => b.amount > 0);
}
