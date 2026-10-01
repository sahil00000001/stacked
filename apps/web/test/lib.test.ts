import { describe, expect, it } from "vitest";
import { allocateClaim, type Policy } from "@stacked/claim-engine";
import { INSURERS } from "@stacked/seed-data";
import { copayChip, roomChip, termsSheet, waitChip } from "@/lib/describe";
import { computeGaps } from "@/lib/gaps";
import { icrReading } from "@/lib/insurer";
import { planSegments } from "@/lib/planView";
import { blankPolicy, editField, employerPolicy, setIn, validatePolicy, verifyAll } from "@/lib/policyDraft";
import { buildScenario, defaultDraft } from "@/lib/simulate";

const today = "2026-10-01";
const own = (over: Partial<Policy> = {}): Policy => ({
  ...blankPolicy(today),
  policy_id: "own",
  insurer_id: "niva-bupa",
  label: "ReAssure",
  sum_insured: 1000000,
  members: [{ name: "Asha", dob: "1994-05-10" }],
  waiting_periods: {
    initial_days: 30,
    specific_months: 24,
    ped_months: 36,
    maternity_months: null,
    continuity_start: "2025-08-01",
  },
  ...over,
});
const group = employerPolicy({
  policy_id: "g",
  insurer_id: "icici-lombard",
  label: "Employer cover",
  sum_insured: 500000,
  room: "pct",
  room_value: 1,
  copay_pct: 0,
  maternity: true,
  maternity_limit: 50000,
  ped_day1: true,
  ped_months: 0,
  consumables: "unknown",
  family: false,
  members: [{ name: "Asha", dob: "1994-05-10" }],
  continuity_start: "2024-04-01",
  renewal_date: "2027-03-31",
});

describe("describe", () => {
  it("writes chips in plain language", () => {
    expect(roomChip(group)).toBe("Room: 1% of SI a day");
    expect(copayChip(group)).toBe("No co-pay");
    expect(waitChip(own(), today)).toBe("PED wait ends Aug 2028");
    expect(waitChip(group, today)).toBe("All waits served");
  });

  it("covers every section of the terms sheet and shows Not known for unknowns", () => {
    const sheet = termsSheet(
      group,
      INSURERS.find((i) => i.insurer_id === "icici-lombard"),
      null,
      today,
    );
    expect(sheet.map((s) => s.title)).toEqual([
      "Cover",
      "Room and co-pay",
      "Waiting periods",
      "Limits and extras",
      "Bonus and restoration",
      "Data source",
    ]);
    const rows = sheet.flatMap((s) => s.rows);
    expect(rows.find((r) => r.label === "Disease sub-limits")!.value).toBe("Not known");
    expect(rows.find((r) => r.label === "Consumables")!.value).toBe("Not known");
    expect(rows.find((r) => r.label === "Product")!.value).toBe("Not known");
  });
});

describe("gaps", () => {
  it("finds unserved waits, room caps, consumables and group cover ending", () => {
    const codes = computeGaps([group, own()], INSURERS, { today, usualRoomRate: 8000 }).map(
      (g) => `${g.policy_id}:${g.code}`,
    );
    expect(codes).toEqual(
      expect.arrayContaining(["g:room_cap", "g:consumables", "g:group", "own:wait_ped", "own:wait_specific"]),
    );
    const cap = computeGaps([group], INSURERS, { today, usualRoomRate: 8000 }).find((g) => g.code === "room_cap")!;
    expect(cap.text).toBe(
      "Employer cover's room cap of ₹5,000 a day is below your usual ₹8,000 room, so it would cut about 38% of room-linked charges.",
    );
  });
});

describe("policy drafts", () => {
  it("marks edited fields user_verified and clears their unknown flag", () => {
    const p = { ...own(), data_status: "aggregator" as const, unknown_fields: ["consumables_covered", "sublimits"] };
    const e = editField(p, "consumables_covered", true);
    expect(e.consumables_covered).toBe(true);
    expect(e.field_status).toEqual({ consumables_covered: "user_verified" });
    expect(e.unknown_fields).toEqual(["sublimits"]);
    expect(e.data_status).toBe("aggregator");
    expect(verifyAll(e, "2026-10-01T10:00:00Z")).toMatchObject({ data_status: "user_verified", unknown_fields: [] });
  });

  it("sets nested values immutably", () => {
    const p = own();
    const q = setIn(p, "room_rent.value", 5000);
    expect(q.room_rent.value).toBe(5000);
    expect(p.room_rent.value).toBeNull();
  });

  it("explains what is wrong and what to do", () => {
    const errs = validatePolicy({ ...own(), insurer_id: "", sum_insured: 0 }, today);
    expect(errs.insurer_id).toBe("Insurer is missing. Enter it to continue.");
    expect(errs.sum_insured).toBe("Sum insured must be more than zero.");
    expect(validatePolicy(own(), today)).toEqual({});
    expect(validatePolicy(group, today)).toEqual({});
  });
});

describe("simulate → plan view", () => {
  it("builds a scenario from the draft and splits the bar into who pays", () => {
    const d = { ...defaultDraft([group, own()], "S4"), total: 900000, admission_date: today };
    const s = buildScenario(d);
    expect(s.bill_items.reduce((t, b) => t + b.amount, 0)).toBe(900000);
    expect(s.hospital.in_network_by_insurer).toEqual({});
    const plan = allocateClaim([group, own()], s, INSURERS);
    const segs = planSegments(plan, (id) => id);
    expect(segs.reduce((t, x) => t + x.amount, 0)).toBe(plan.total_bill);
    expect(segs[0]!.policy_id).toBe("g");
  });

  it("reads ICR in plain language", () => {
    expect(icrReading(105)).toMatch(/premium-hike risk/);
    expect(icrReading(90)).toMatch(/watch renewals/);
    expect(icrReading(70)).toBe("Within the healthy range.");
    expect(icrReading(40)).toMatch(/strict on claims/);
    expect(icrReading(null)).toBeNull();
  });
});
