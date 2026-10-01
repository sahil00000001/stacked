"use client";

import { Intro } from "@/components/Intro";
import { useLoadDemo } from "@/lib/demo";
import { useHydrated } from "@/lib/hydrated";

/** The intro on its own page, so returning users can watch it again (You → Watch the intro). */
export function Welcome() {
  const hydrated = useHydrated();
  const sample = useLoadDemo();
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <Intro onTryDemo={() => sample.load("/plan")} demoBusy={sample.busy} demoReady={sample.ready} />;
}
