/*
 * Stacked service worker — lets the installed app open and work offline.
 * Pages: network first, falling back to the last copy. Built assets: cache
 * first (their names are content-hashed). Reference data: stale while
 * revalidate. Your policies live in localStorage, so they need no caching.
 * Bump VERSION when this file's caching rules change.
 */
const VERSION = "stacked-v1";
const PAGES = ["/", "/add", "/simulate", "/plan", "/plan/checklist", "/insurers", "/you"];
const DATA = ["/api/insurers", "/api/products", "/api/scenarios", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(DATA);
      // cache each page and the scripts, styles and fonts it needs
      for (const url of PAGES) {
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (!res.ok) continue;
          await cache.put(url, res.clone());
          const html = await res.text();
          const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
          await Promise.all([...new Set(assets)].map((a) => cache.add(a).catch(() => {})));
        } catch {
          /* offline during install: the page is cached on first visit instead */
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (fallbackUrl && (await cache.match(fallbackUrl))) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit || Response.error());
  return hit || fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // React Server Component payloads depend on router state; let them fail over to a full page load
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    const fallback = url.pathname.startsWith("/insurers") ? "/insurers" : "/";
    return event.respondWith(networkFirst(request, fallback));
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))
    return event.respondWith(cacheFirst(request));
  if (url.pathname.startsWith("/api/") || url.pathname === "/manifest.webmanifest")
    return event.respondWith(staleWhileRevalidate(request));
});
