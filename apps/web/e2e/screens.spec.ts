import { expect, test } from "@playwright/test";
import { FIVE, GROUP, OWN, PARENTS, seed } from "./fixtures";

test.describe("Vault (§5.1)", () => {
  test("renders 0 policies with the empty-state copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Add your employer cover first — it's usually the one to claim from.")).toBeVisible();
    await expect(page.getByTestId("policy-card")).toHaveCount(0);
  });

  test("renders 1 policy", async ({ page }) => {
    await seed(page, [OWN]);
    await page.goto("/");
    await expect(page.getByTestId("policy-card")).toHaveCount(1);
    await expect(page.getByTestId("policy-card")).toContainText("₹10,00,000");
  });

  test("renders 5 policies in wallet order and expands one to every term", async ({ page }) => {
    await seed(page, FIVE);
    await page.goto("/");
    const cards = page.getByTestId("policy-card");
    await expect(cards).toHaveCount(5);
    await expect(cards.first()).toContainText("Employer");
    await expect(cards.nth(4)).toContainText("Parents' floater");
    await cards.first().getByRole("button", { expanded: false }).click();
    const terms = page.getByRole("region", { name: "Employer cover terms" });
    for (const section of [
      "Cover",
      "Room and co-pay",
      "Waiting periods",
      "Limits and extras",
      "Bonus and restoration",
      "Data source",
    ]) {
      await expect(terms.getByRole("heading", { name: section })).toBeVisible();
    }
    await expect(terms.getByText("Not known").first()).toBeVisible();
    await expect(terms).toContainText("1% of sum insured a day");
  });
});

test.describe("Insurers (§5.5)", () => {
  test("every figure shows its period and source", async ({ page }) => {
    await page.goto("/insurers");
    await expect(page.getByText("Insurer claim record (FY24–26 average, NL-37)").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /scorecard/ })).toHaveCount(31);
    await page.getByLabel("Search insurers").fill("hdfc");
    await page.getByRole("link", { name: "HDFC ERGO General Insurance scorecard" }).click();
    await expect(page.getByRole("heading", { name: "Insurer claim record (FY24–26 average, NL-37)" })).toBeVisible();
    await expect(page.getByText("97.61%")).toBeVisible();
    await expect(page.getByText(/Source: Ditto Data Lab compilation/)).toBeVisible();
    await expect(page.getByText("Not insurance advice.").first()).toBeVisible();
  });

  test("new insurers show Insufficient history", async ({ page }) => {
    await page.goto("/insurers/galaxy-health");
    await expect(page.getByText("Insufficient history").first()).toBeVisible();
  });
});

test.describe("Simulate and Claim plan (§5.3, §5.4)", () => {
  test("a total-only entry produces a default split, and changing the room rate updates the plan", async ({ page }) => {
    await seed(page, [GROUP, OWN, PARENTS]);
    await page.goto("/simulate");
    await page.getByLabel("Expected total bill (₹)").fill("300000");
    const split = page.getByTestId("default-split");
    await expect(split).toContainText("Room");
    await expect(split).toContainText("Medicines");
    await page.getByRole("button", { name: "Show claim order" }).click();
    await expect(page).toHaveURL("/plan");
    const first = page.getByTestId("allocation").first();
    await expect(first).toContainText("Room rent above 1% cap — proportionate cut");
    await page.getByLabel("Room rate per day (₹)").fill("5000");
    await expect(first).not.toContainText("Room rent above 1% cap — proportionate cut");
  });

  test("Why this order is generated from engine reasons", async ({ page }) => {
    await seed(page, [GROUP, OWN, PARENTS]);
    await page.goto("/simulate");
    await page.getByRole("button", { name: "Show claim order" }).click();
    await expect(page.getByTestId("why")).toContainText("Parents' Mediclaim");
  });

  test("errors say what went wrong and what to do", async ({ page }) => {
    await seed(page, [GROUP]);
    await page.goto("/simulate");
    await page.getByLabel("Room rate per day (₹)").fill("");
    await page.getByRole("button", { name: "Show claim order" }).click();
    await expect(
      page.getByText("Room rate is missing. Enter the per-day room charge so we can check the room-rent cap."),
    ).toBeVisible();
  });
});
