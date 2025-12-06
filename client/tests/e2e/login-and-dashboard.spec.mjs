import { test, expect } from "@playwright/test";
import { mockCredentials, mockDashboardData, mockSession } from "./helpers/api.js";

test("user can log in and view dashboard insights", async ({ page }) => {
  await mockCredentials(page);
  await mockSession(page, "user");
  await mockDashboardData(page);

  await page.goto("/login");
  await page.fill("#identifier", "demo@fintrack.test");
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await expect(page.getByText(/Total Income/i)).toBeVisible();
  await expect(page.getByText(/৳1,?20,?000\.00/)).toBeVisible();
  await expect(page.getByText(/Recent transactions/i)).toBeVisible();

  const incomeRow = page.getByRole("row", { name: /Alpha Rollout/ });
  await expect(incomeRow).toBeVisible();
  await expect(incomeRow.getByText(/Income/)).toBeVisible();
});
