import { defaultBillSplit, type ClaimScenario } from "@stacked/claim-engine";

/** A cardiac admission in a Bengaluru hospital: ₹6L bill, ₹8,000 room, 4 nights. */
export function demoScenario(admission_date: string): ClaimScenario {
  return {
    scenario_id: "demo-s4",
    claimant: "Asha",
    category: "S4",
    is_ped: false,
    is_accident: false,
    admission_date,
    admission_type: "emergency",
    hospital: {
      id: null,
      city_tier: "metro",
      in_network_by_insurer: { "icici-lombard": true, "niva-bupa": true },
      abroad: false,
    },
    room_rate_per_day: 8000,
    length_of_stay_days: 4,
    bill_items: defaultBillSplit(600000, "S4", { roomRatePerDay: 8000, nights: 4 }),
    pre_hosp_amount: 8000,
    post_hosp_amount: 12000,
  };
}
