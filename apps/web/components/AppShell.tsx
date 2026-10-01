"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n/en";

/** Registers the service worker (production builds only, so dev never serves stale files). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

/** A quiet line under the header while the device is offline. */
export function OfflineNote() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <p role="status" className="no-print mx-auto max-w-[var(--column)] px-4 pt-3 text-14 font-medium text-ash">
      {t.pwa.offline}
    </p>
  );
}
