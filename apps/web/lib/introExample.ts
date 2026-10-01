/**
 * The numbers the intro animation shows. They are the engine's real result for
 * the sample vault on its sample admission; test/lib.test.ts fails if they drift.
 */
export const INTRO_EXAMPLE = {
  bill: 620000,
  split: [
    { policy_id: "demo-employer", label: "Employer cover", amount: 453652 },
    { policy_id: "demo-own", label: "ReAssure 2.0", amount: 104609 },
  ],
  youPay: 61739,
  lumpSum: 1000000,
} as const;
