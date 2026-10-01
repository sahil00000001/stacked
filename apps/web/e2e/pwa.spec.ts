import { expect, test } from "@playwright/test";
import { GROUP, OWN, seed } from "./fixtures";

test.describe("Installable app (PWA)", () => {
  test.use({ serviceWorkers: "allow" });

  test("serves a valid manifest and icons", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ short_name: "Stacked", display: "standalone", start_url: "/", theme_color: "#0f1012" });
    expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)).toEqual([
      "192x192:any",
      "512x512:any",
      "512x512:maskable",
    ]);
    for (const icon of [...m.icons.map((i: { src: string }) => i.src), "/icons/apple-touch-icon.png"]) {
      const r = await request.get(icon);
      expect(r.headers()["content-type"], icon).toContain("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toContain("no-cache");
  });

  test("works offline after the first visit", async ({ page, context }) => {
    await seed(page, [GROUP, OWN]);
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the service worker
    await expect(page.getByTestId("policy-card")).toHaveCount(2);
    await page.goto("/insurers");
    await page.locator("h1").waitFor();

    await context.setOffline(true);
    await page.goto("/");
    await expect(page.getByTestId("policy-card")).toHaveCount(2);
    await expect(page.getByText("You're offline.")).toBeVisible();
    await page.goto("/insurers");
    await expect(page.getByRole("heading", { level: 1, name: "Insurers" })).toBeVisible();
    await page.goto("/simulate");
    await page.getByRole("button", { name: "Show claim order" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claim from your Employer cover first.");
    await context.setOffline(false);
  });

  test("You shows how to install", async ({ page }) => {
    await page.goto("/you");
    await expect(page.getByRole("heading", { name: "Use Stacked as an app" })).toBeVisible();
    await expect(page.getByTestId("install-card")).toBeVisible();
  });
});
