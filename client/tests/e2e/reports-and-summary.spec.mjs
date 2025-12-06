import { test, expect } from "@playwright/test";
import {
  mockPlan,
  mockReportCharts,
  mockReportFilters,
  mockSession,
  mockSummaryFilters,
  mockSummaryReport,
} from "./helpers/api.js";

test("reports page renders filtered charts", async ({ page }) => {
  await mockSession(page, "user");
  await mockReportFilters(page);
  await mockReportCharts(page);

  await page.goto("/reports");

  await expect(page.getByRole("heading", { name: /Financial Reports/i })).toBeVisible();
  await expect(page.getByText(/Total Income/i)).toBeVisible();
  await expect(page.getByText(/৳70,000\.00/)).toBeVisible();
  await expect(page.getByText(/Cash Flow/i)).toBeVisible();
});

test("summary export links honor filters", async ({ page }) => {
  await mockSession(page, "user");
  await mockPlan(page);
  await mockSummaryFilters(page);
  await mockSummaryReport(page);

  await page.goto("/summary");

  const exportButton = page.getByRole("button", { name: /Export/i });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();

  const pdfLink = page.getByRole("link", { name: /Download PDF/i });
  const xlsxLink = page.getByRole("link", { name: /Download Excel/i });

  await expect(pdfLink).toHaveAttribute("href", /summary\.pdf/);
  await expect(xlsxLink).toHaveAttribute("href", /summary\.xlsx/);
  await expect(page.getByText(/Net balance/i)).toBeVisible();
});
