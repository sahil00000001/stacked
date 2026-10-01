"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ClaimPlan, ClaimScenario, Policy } from "@stacked/claim-engine";
import type { SimulateDraft } from "./simulate";

export interface SavedPlan {
  id: string;
  saved_at: string;
  scenario: ClaimScenario;
  policies: Policy[];
  plan: ClaimPlan;
  engine_version: string;
}

export interface CurrentPlan {
  scenario: ClaimScenario;
  policies: Policy[];
  plan: ClaimPlan;
  saved_id: string | null;
  /** the Simulate form that produced this plan, so the plan screen can re-run it */
  draft?: SimulateDraft;
}

interface State {
  policies: Policy[];
  plans: SavedPlan[];
  draft: SimulateDraft | null;
  current: CurrentPlan | null;
  settings: { usualRoomRate: number };
  addPolicy: (p: Policy) => void;
  updatePolicy: (p: Policy) => void;
  removePolicy: (id: string) => void;
  setDraft: (d: SimulateDraft) => void;
  setCurrent: (c: CurrentPlan | null) => void;
  savePlan: () => SavedPlan | null;
  deletePlan: (id: string) => void;
  setSettings: (s: Partial<State["settings"]>) => void;
  clearAll: () => void;
}

import { newId } from "./ids";
export { newId };

/**
 * Phase 1 keeps user data on the device (DECISIONS W1). Only policies, the
 * simulation draft, plans and settings are stored; no diagnosis text.
 */
export const useStore = create<State>()(
  persist(
    (set, get) => ({
      policies: [],
      plans: [],
      draft: null,
      current: null,
      settings: { usualRoomRate: 8000 },
      addPolicy: (p) => set((s) => ({ policies: [...s.policies, p] })),
      updatePolicy: (p) => set((s) => ({ policies: s.policies.map((x) => (x.policy_id === p.policy_id ? p : x)) })),
      removePolicy: (id) => set((s) => ({ policies: s.policies.filter((x) => x.policy_id !== id) })),
      setDraft: (d) => set({ draft: d }),
      setCurrent: (c) => set({ current: c }),
      savePlan: () => {
        const cur = get().current;
        if (!cur) return null;
        const saved: SavedPlan = {
          id: cur.saved_id ?? newId("plan"),
          saved_at: new Date().toISOString(),
          scenario: cur.scenario,
          policies: cur.policies,
          plan: cur.plan,
          engine_version: cur.plan.engine_version,
        };
        set((s) => ({
          plans: [saved, ...s.plans.filter((p) => p.id !== saved.id)],
          current: { ...cur, saved_id: saved.id },
        }));
        return saved;
      },
      deletePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      setSettings: (x) => set((s) => ({ settings: { ...s.settings, ...x } })),
      clearAll: () => set({ policies: [], plans: [], draft: null, current: null }),
    }),
    {
      name: "stacked-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
