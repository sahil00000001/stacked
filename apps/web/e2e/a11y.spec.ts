import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { GROUP, OWN, PARENTS, seed } from "./fixtures";

/* §12: axe reports no violations, at 360px and 1280px (one project each). */

const ROUTES = [
  "/",
  "/add",
  "/add?way=employer",
  "/add?way=manual",
  "/simulate",
  "/plan",
  "/plan/checklist",
  "/insurers",
  "/insurers/hdfc-ergo",
  "/insurers/galaxy-health",
  "/you",
  "/design",
];

test("no axe violations on any screen", async ({ page }) => {
  test.setTimeout(240_000);
  await seed(page, [GROUP, OWN, PARENTS]);
  // make a plan so /plan and /plan/checklist have content
  await page.goto("/simulate");
  await page.getByRole("button", { name: "Show claim order" }).click();
  await expect(page).toHaveURL("/plan");

  for (const route of ROUTES) {
    await page.goto(route);
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(700); // let the split-bar fill finish
    // expand the first card so the terms sheet is checked too
    if (route === "/") await page.getByTestId("policy-card").first().getByRole("button").first().click();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = results.violations.map(
      (v) =>
        `${route} ${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    );
    expect(summary, summary.join("\n")).toEqual([]);
  }
});

test("no horizontal scroll at this width", async ({ page }) => {
  await seed(page, [GROUP, OWN, PARENTS]);
  for (const route of ["/", "/simulate", "/insurers", "/insurers/hdfc-ergo", "/design", "/add?way=manual"]) {
    await page.goto(route);
    await page.locator("h1").first().waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});

test("keyboard focus is visible", async ({ page }) => {
  await page.goto("/insurers");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
});
