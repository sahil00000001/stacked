"use client";

import { useCallback } from "react";
import { t } from "@/lib/i18n/en";
import { useInstallPrompt } from "@/lib/pwa";
import { PlinthButton } from "./PlinthButton";
import { useToast } from "./Toast";

/** "Use Stacked as an app": the install button, or the right instructions for this browser. */
export function InstallCard() {
  const toast = useToast();
  const onInstalled = useCallback(() => toast(t.pwa.installed), [toast]);
  const { state, install } = useInstallPrompt(onInstalled);
  const note = {
    installed: t.pwa.running,
    ios: t.pwa.ios,
    insecure: t.pwa.insecure,
    unsupported: t.pwa.unsupported,
    available: null,
  }[state];
  return (
    <div
      className="grain flex flex-col items-start gap-3 rounded-card border border-edge p-5"
      data-testid="install-card"
    >
      <p className="text-16 text-bone">{t.pwa.body}</p>
      {state === "available" && <PlinthButton onClick={install}>{t.pwa.install}</PlinthButton>}
      {note && <p className="text-14 font-medium text-ash">{note}</p>}
    </div>
  );
}
