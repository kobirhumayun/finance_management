import { expect } from "@playwright/test";

const buildSession = (role = "user") => ({
  user: {
    name: role === "admin" ? "Finance Admin" : "FinTrack User",
    email: "user@example.com",
    role,
  },
  accessToken: "test-access-token",
});

const dashboardSummaryPayload = {
  summary: {
    income: 120000,
    expense: 45000,
    balance: 75000,
    counts: {
      income: 3,
      expense: 2,
      total: 5,
    },
  },
  transactions: [
    {
      id: "txn-income",
      date: "2024-08-15",
      type: "Income",
      amount: 60000,
      projectId: "proj-alpha",
      projectName: "Alpha Rollout",
    },
    {
      id: "txn-expense",
      date: "2024-08-18",
      type: "Expense",
      amount: 15000,
      projectId: "proj-beta",
      projectName: "Beta Expansion",
    },
  ],
  aggregates: {
    byProject: [
      { projectId: "proj-alpha", projectName: "Alpha Rollout" },
      { projectId: "proj-beta", projectName: "Beta Expansion" },
    ],
  },
  pageInfo: {
    hasNextPage: false,
    nextCursor: null,
    limit: 5,
  },
  totalCount: 2,
  capabilities: { export: true },
};

const summaryTablePage = {
  ...dashboardSummaryPayload,
  transactions: [
    ...dashboardSummaryPayload.transactions,
    {
      id: "txn-expense-2",
      date: "2024-08-20",
      type: "Expense",
      amount: 20000,
      projectId: "proj-beta",
      projectName: "Beta Expansion",
      subcategory: "Vendors",
    },
  ],
};

export async function mockCredentials(page, { redirectUrl = "/dashboard" } = {}) {
  await page.route("**/api/auth/callback/credentials", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, status: 200, url: redirectUrl }),
    });
  });
}

export async function mockSession(page, role = "user") {
  await page.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildSession(role)),
    });
  });
}

export async function mockDashboardData(page) {
  await page.route("**/api/proxy/api/reports/summary**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboardSummaryPayload),
    });
  });
}

export async function mockReportFilters(page) {
  await page.route("**/api/proxy/api/reports/filters**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        projects: [
          { id: "proj-alpha", name: "Alpha Rollout", label: "Alpha Rollout", value: "proj-alpha" },
          { id: "proj-beta", name: "Beta Expansion", label: "Beta Expansion", value: "proj-beta" },
        ],
        transactionTypes: [
          { label: "Income", value: "Income" },
          { label: "Expense", value: "Expense" },
        ],
        dateRange: { earliest: "2024-01-01", latest: "2024-12-31" },
      }),
    });
  });
}

export async function mockReportCharts(page) {
  await page.route("**/api/proxy/api/reports/charts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        incomeVsExpense: [
          { month: "Jan", income: 30000, expense: 12000 },
          { month: "Feb", income: 40000, expense: 15000 },
        ],
        cashFlow: [
          { month: "Jan", cashIn: 28000, cashOut: 11000 },
          { month: "Feb", cashIn: 42000, cashOut: 16000 },
        ],
        incomeByCategory: [
          { name: "Consulting", value: 55000 },
          { name: "Support", value: 15000 },
        ],
        expenseByCategory: [
          { name: "Payroll", value: 20000 },
          { name: "Vendors", value: 8000 },
        ],
        summary: {
          income: 70000,
          expense: 28000,
          balance: 42000,
          counts: { income: 4, expense: 3, total: 7 },
        },
        dateRange: { start: "2024-01-01", end: "2024-12-31" },
        filters: { projectId: null, type: null, storageType: null },
      }),
    });
  });
}

export async function mockSummaryFilters(page) {
  await page.route("**/api/proxy/api/reports/summary/filters**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        projects: [
          { id: "proj-alpha", label: "Alpha Rollout", value: "proj-alpha" },
          { id: "proj-beta", label: "Beta Expansion", value: "proj-beta" },
        ],
        transactionTypes: [
          { label: "Income", value: "Income" },
          { label: "Expense", value: "Expense" },
        ],
        subcategories: ["SaaS", "Vendors"],
        dateRange: { earliest: "2024-01-01", latest: "2024-12-31" },
        capabilities: { export: true },
      }),
    });
  });
}

export async function mockSummaryReport(page) {
  await page.route("**/api/proxy/api/reports/summary**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(summaryTablePage),
    });
  });
}

export async function mockPlan(page) {
  await page.route("**/api/proxy/api/plans/my-plan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: {
          name: "Pro",
          limits: {
            summary: { allowFilters: true, allowPagination: true, allowExport: true },
          },
        },
      }),
    });
  });
}

export async function expectToast(page, message) {
  await expect(page.getByText(message)).toBeVisible();
}
