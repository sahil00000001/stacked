import { expect, test, type Page } from "@playwright/test";

/*
 * BUILD_PROMPT §11.5 — add three policies → simulate S4 → see the cascade → save plan.
 * Everything goes through the real UI: employer quick form plus two product presets.
 */

async function addMember(page: Page, name: string, dob: string) {
  await page.getByRole("button", { name: "Add a member" }).click();
  await page.getByLabel("Name", { exact: true }).last().fill(name);
  await page.getByLabel("Date of birth").last().fill(dob);
}

async function addPreset(
  page: Page,
  opts: { search: string; pick: RegExp; relationship?: string; si: string; members: [string, string][]; since: string },
) {
  await page.goto("/add");
  await page.getByLabel("Search by insurer or product").fill(opts.search);
  await page.getByRole("button", { name: opts.pick }).click();
  if (opts.relationship) await page.getByText(opts.relationship, { exact: true }).click();
  await page.getByLabel("Sum insured (₹)").fill(opts.si);
  for (const [n, d] of opts.members) await addMember(page, n, d);
  await page.getByLabel("Covered continuously since").fill(opts.since);
  await page.getByRole("button", { name: "Show the terms" }).click();
  await expect(page.getByText(/aggregator data, Sept 2026/).first()).toBeVisible();
  await page.getByRole("button", { name: "Add a policy" }).click();
  await expect(page.getByTestId("toast")).toHaveText("Policy added");
  await expect(page).toHaveURL("/");
}

test("add three policies, simulate a cardiac admission, see the cascade, save the plan", async ({ page }) => {
  // 1. Employer group policy via the quick form
  await page.goto("/");
  await expect(page.getByText("No policies yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add a policy" }).click();
  await expect(page).toHaveURL(/way=employer/);
  await page.getByLabel("Which insurer runs it?").selectOption({ label: "ICICI Lombard General Insurance" });
  await page.getByLabel("Sum insured (₹)").fill("500000");
  await addMember(page, "Asha", "1994-05-10");
  await page.getByLabel("Covered continuously since").fill("2024-04-01");
  await page.getByRole("button", { name: "Add a policy" }).click();
  await expect(page.getByTestId("toast")).toHaveText("Policy added");

  // 2. Own policy from a preset
  await addPreset(page, {
    search: "reassure 2",
    pick: /ReAssure 2\.0/,
    si: "1000000",
    members: [["Asha", "1994-05-10"]],
    since: "2022-01-01",
  });

  // 3. Parents' floater from a preset
  await addPreset(page, {
    search: "floater mediclaim",
    pick: /Floater Mediclaim/,
    relationship: "My parents' floater (I'm a member)",
    si: "500000",
    members: [
      ["Asha", "1994-05-10"],
      ["Ravi", "1962-01-02"],
      ["Meena", "1965-07-19"],
    ],
    since: "2015-04-01",
  });

  await expect(page.getByTestId("policy-card")).toHaveCount(3);
  await expect(page.getByTestId("gap-banner")).toBeVisible();

  // 4. Simulate S4 with a ₹9L total
  await page.getByRole("link", { name: "Simulate" }).first().click();
  await page.getByLabel("What kind of admission?").selectOption("S4");
  await page.getByLabel("Expected total bill (₹)").fill("900000");
  await expect(page.getByTestId("default-split")).toBeVisible();
  await page.getByRole("button", { name: "Show claim order" }).click();

  // 5. The cascade
  await expect(page).toHaveURL("/plan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claim from your Employer cover first.");
  await expect(page.getByTestId("claim-split-bar")).toBeVisible();
  const allocations = page.getByTestId("allocation");
  await expect(allocations.first()).toContainText("Employer cover");
  await expect(allocations.first()).toContainText("Claim first");
  await expect(allocations.nth(1)).toContainText("ReAssure");
  await expect(allocations.nth(1)).toContainText("Reimbursement");
  await expect(page.getByTestId("explanation")).toContainText("Your Employer cover pays");
  await expect(page.getByTestId("explanation")).toContainText("Your ReAssure 2.0 pays the");
  await expect(page.getByText("Not insurance advice.").first()).toBeVisible();

  // 6. Save the plan, then find it under You
  await page.getByRole("button", { name: "Save claim plan" }).click();
  await expect(page.getByTestId("toast")).toHaveText("Claim plan saved");
  await page.getByRole("link", { name: "Show claim-day checklist" }).click();
  await expect(page.getByRole("heading", { name: "Insurer decides within 1 hour" })).toBeVisible();
  await page.getByRole("link", { name: "You", exact: true }).first().click();
  await expect(page.getByTestId("saved-plans")).toContainText("Claim from your Employer cover first.");
});
