"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { allocateClaim, type Policy } from "@stacked/claim-engine";
import { demoScenario } from "@stacked/seed-data/demo-scenario";
import { useInsurers } from "./queries";
import { todayISO } from "./simulate";
import { useStore } from "./store";

/** Loads the sample vault (from the database when connected) and its sample claim plan. */
export function useLoadDemo() {
  const router = useRouter();
  const loadDemo = useStore((s) => s.loadDemo);
  const { data: insurers } = useInsurers();
  const [busy, setBusy] = useState(false);

  const load = async (to: "/" | "/plan" = "/plan") => {
    if (!insurers) return;
    setBusy(true);
    try {
      const res = await fetch("/api/demo");
      const { policies } = (await res.json()) as { policies: Policy[] };
      const scenario = demoScenario(todayISO());
      loadDemo(policies, { scenario, policies, plan: allocateClaim(policies, scenario, insurers), saved_id: null });
      router.push(to);
    } finally {
      setBusy(false);
    }
  };
  return { load, busy, ready: Boolean(insurers) };
}
