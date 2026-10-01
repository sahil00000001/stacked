"use client";

import { useEffect, useState } from "react";

/** True after the first client render, once persisted state can be read without a hydration mismatch. */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
