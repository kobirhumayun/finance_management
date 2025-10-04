// File: src/lib/mock-data.js
const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

const dashboardSummary = {
  income: 68400,
  expenses: 25840,
  netBalance: 42560,
  projects: 12,
};

const recentTransactions = [
  { id: "txn-1", projectId: "proj-1", date: "2025-01-14", type: "Income", category: "Retainer", amount: 4200 },
  { id: "txn-2", projectId: "proj-2", date: "2025-01-12", type: "Expense", category: "Advertising", amount: 940 },
  { id: "txn-3", projectId: "proj-3", date: "2025-01-10", type: "Income", category: "Consulting", amount: 2800 },
  { id: "txn-4", projectId: "proj-1", date: "2025-01-09", type: "Expense", category: "Software", amount: 460 },
  { id: "txn-5", projectId: "proj-4", date: "2025-01-07", type: "Income", category: "Subscription", amount: 1300 },
];

const mockProjects = [
  {
    id: "proj-1",
    name: "Marketing Revamp",
    description: "Rebuilding acquisition funnels across paid and organic channels.",
    createdAt: "2024-11-02",
  },
  {
    id: "proj-2",
    name: "Mobile Application",
    description: "Feature roadmap and release management for the consumer app.",
    createdAt: "2024-12-11",
  },
  {
    id: "proj-3",
    name: "Enterprise Rollout",
    description: "Implementation for enterprise clients with custom integrations.",
    createdAt: "2025-01-05",
  },
  {
    id: "proj-4",
    name: "Support Automation",
    description: "Self-service tooling to reduce inbound support requests.",
    createdAt: "2024-10-24",
  },
];

const mockTransactionsByProject = {
  "proj-1": [
    { id: "txn-10", date: "2025-01-12", type: "Income", description: "Quarterly retainer", subcategory: "Retainer", amount: 4200 },
    { id: "txn-11", date: "2025-01-10", type: "Expense", description: "Design tooling", subcategory: "Software", amount: 340 },
    { id: "txn-12", date: "2025-01-07", type: "Expense", description: "Freelance copy", subcategory: "Contractor", amount: 520 },
  ],
  "proj-2": [
    { id: "txn-20", date: "2025-01-09", type: "Income", description: "iOS release milestone", subcategory: "Milestone", amount: 3200 },
    { id: "txn-21", date: "2025-01-06", type: "Expense", description: "App Store fees", subcategory: "Operations", amount: 299 },
  ],
  "proj-3": [
    { id: "txn-30", date: "2025-01-14", type: "Income", description: "Integration consulting", subcategory: "Consulting", amount: 2800 },
    { id: "txn-31", date: "2025-01-08", type: "Expense", description: "Data warehouse credits", subcategory: "Infrastructure", amount: 620 },
  ],
  "proj-4": [
    { id: "txn-40", date: "2025-01-10", type: "Expense", description: "Automation tooling", subcategory: "Software", amount: 460 },
    { id: "txn-41", date: "2025-01-09", type: "Income", description: "SaaS upsell", subcategory: "Subscription", amount: 1300 },
  ],
};

const reportFilters = {
  projects: mockProjects.map((project) => ({ label: project.name, value: project.id })),
  transactionTypes: [
    { label: "Income", value: "income" },
    { label: "Expense", value: "expense" },
  ],
};

const chartSeries = {
  incomeVsExpense: [
    { month: "Sep", income: 21000, expense: 14000 },
    { month: "Oct", income: 24000, expense: 16500 },
    { month: "Nov", income: 26000, expense: 17800 },
    { month: "Dec", income: 28000, expense: 19000 },
    { month: "Jan", income: 30000, expense: 21300 },
  ],
  expenseByCategory: [
    { name: "Software", value: 28 },
    { name: "Marketing", value: 22 },
    { name: "Operations", value: 18 },
    { name: "Payroll", value: 32 },
  ],
  cashFlow: [
    { month: "Sep", cashIn: 20000, cashOut: 15000 },
    { month: "Oct", cashIn: 23000, cashOut: 16000 },
    { month: "Nov", cashIn: 25000, cashOut: 18000 },
    { month: "Dec", cashIn: 27000, cashOut: 20000 },
    { month: "Jan", cashIn: 29500, cashOut: 21500 },
  ],
};

const plans = [
  {
    id: "plan-free",
    name: "Free",
    price: "$0",
    billingCycle: "Forever",
    description: "Track personal finances with essential tools.",
    features: ["Up to 2 projects", "Manual transactions", "Community support"],
  },
  {
    id: "plan-basic",
    name: "Basic",
    price: "$12",
    billingCycle: "Per month",
    description: "Grow your side business with collaboration features.",
    features: ["10 projects", "Recurring transactions", "Email support"],
  },
  {
    id: "plan-pro",
    name: "Professional",
    price: "$29",
    billingCycle: "Per month",
    description: "Advanced analytics and automations for scaling teams.",
    features: ["Unlimited projects", "Workflow automations", "Priority support"],
  },
  {
    id: "plan-enterprise",
    name: "Enterprise",
    price: "Custom",
    billingCycle: "Annual",
    description: "Enterprise-grade controls with concierge onboarding.",
    features: ["Role-based access", "Dedicated CSM", "Custom integrations"],
  },
];

const adminPlans = plans.map((plan, index) => ({
  ...plan,
  userCount: [134, 82, 56, 12][index] || 0,
  status: index === 0 ? "Active" : index === 3 ? "Pending" : "Active",
}));

const adminPayments = [
  { id: "pay-01", user: "kobirhumayun", amount: 99, method: "Mobile Banking", status: "Pending", submittedAt: "2025-01-12" },
  { id: "pay-02", user: "finops", amount: 249, method: "Wire", status: "Pending", submittedAt: "2025-01-10" },
  { id: "pay-03", user: "strategist", amount: 29, method: "Card", status: "Approved", submittedAt: "2025-01-07" },
];

export async function fetchDashboardSummary() {
  await delay();
  return dashboardSummary;
}

export async function fetchRecentTransactions() {
  await delay();
  return recentTransactions;
}

export async function fetchProjects() {
  await delay();
  return mockProjects;
}

export async function fetchTransactionsByProject(projectId) {
  await delay();
  return mockTransactionsByProject[projectId] || [];
}

export async function fetchReportFilters() {
  await delay();
  return reportFilters;
}

export async function fetchChartSeries() {
  await delay();
  return chartSeries;
}

export async function fetchPlans() {
  await delay();
  return plans;
}

export async function fetchSummaryTable() {
  await delay();
  return recentTransactions.map((transaction) => ({
    id: transaction.id,
    projectId: transaction.projectId,
    date: transaction.date,
    type: transaction.type,
    category: transaction.category,
    amount: transaction.amount,
  }));
}

export async function fetchAdminPlans() {
  await delay();
  return adminPlans;
}

export async function fetchAdminPayments() {
  await delay();
  return adminPayments;
}

