import { defineConfig, devices } from "@playwright/test";

// Set BASE_URL to test a deployment (e.g. BASE_URL=https://stacked-rose.vercel.app npm run e2e)
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  // service workers are blocked except in pwa.spec.ts, so each test's fresh
  // browser doesn't pre-cache the whole app while other tests run
  use: { baseURL: BASE_URL, trace: "retain-on-failure", serviceWorkers: "block" },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run start", url: BASE_URL, reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "mobile-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 } } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
});
