import { expect, test } from "@playwright/test";

test.describe("Intro and sample policies", () => {
  test("first visit shows the intro with name, slogan and the two ways in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("intro")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Three covers. One clear claim.");
    await expect(page.getByText("Stacked — the wallet-stack of covers")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try with sample policies" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a policy" })).toBeVisible();
  });

  test("with reduced motion the intro shows its final numbers at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/welcome");
    await expect(page.getByText("₹4,53,652", { exact: true })).toBeVisible();
    await expect(page.getByText("₹61,739", { exact: true })).toBeVisible();
  });

  test("Try with sample policies fills the vault and opens a real claim plan", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try with sample policies" }).click();
    await expect(page).toHaveURL("/plan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claim from your Employer cover first.");
    await expect(page.getByTestId("allocation")).toHaveCount(2);
    await expect(page.getByText("Lump-sum benefits")).toBeVisible();

    await page.getByRole("link", { name: "Vault" }).first().click();
    await expect(page.getByTestId("policy-card")).toHaveCount(4);
    await expect(page.getByTestId("demo-banner")).toBeVisible();
    await page.getByRole("button", { name: "Clear sample policies" }).click();
    await expect(page.getByTestId("intro")).toBeVisible();
  });
});
