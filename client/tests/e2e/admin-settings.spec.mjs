import { test, expect } from "@playwright/test";
import { expectToast, mockSession } from "./helpers/api.js";

test("admin settings actions surface feedback", async ({ page }) => {
  await mockSession(page, "admin");

  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: /App settings/i })).toBeVisible();

  await page.getByRole("button", { name: /Reload policies/i }).click();
  await expectToast(page, "Policies reloaded (mock).");

  await page.getByRole("button", { name: /Sync now/i }).click();
  await expectToast(page, "Plan sync scheduled.");
});
