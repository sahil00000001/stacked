import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n/en";

/** Web app manifest: makes Stacked installable on Android, iOS and desktop. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${t.app.name} — ${t.app.tagline}`,
    short_name: t.app.name,
    description: t.pwa.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1012",
    theme_color: "#0f1012",
    lang: "en-IN",
    dir: "ltr",
    categories: ["finance", "health", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t.simulate.title, url: "/simulate", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.vault.add, url: "/add", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.insurers.title, url: "/insurers", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
