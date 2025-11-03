// File: src/lib/queries/dashboard.js
import { fetchSummaryReport } from "@/lib/queries/reports";

const RECENT_TRANSACTIONS_LIMIT = 5;
const EPSILON = 0.000_001;

const toISODate = (date) => {
  if (!(date instanceof Date)) {
    return null;
  }

  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return copy.toISOString().slice(0, 10);
};

const getCurrentMonthRange = (reference = new Date()) => {
  const now = reference instanceof Date ? reference : new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return { start: toISODate(start), end: toISODate(end) };
};

const getPreviousMonthRange = (reference = new Date()) => {
  const now = reference instanceof Date ? reference : new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);

  return { start: toISODate(start), end: toISODate(end) };
};

const toSafeNumber = (value) => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return value;
};

const computePeriodComparison = (currentValue, previousValue) => {
  const current = toSafeNumber(currentValue);
  const previous = toSafeNumber(previousValue);
  const delta = current - previous;
  const hasMeaningfulPrevious = Math.abs(previous) > EPSILON;
  const hasMeaningfulCurrent = Math.abs(current) > EPSILON;

  let percentChange = 0;
  if (hasMeaningfulPrevious) {
    percentChange = (delta / Math.abs(previous)) * 100;
  } else if (hasMeaningfulCurrent) {
    percentChange = delta >= 0 ? 100 : -100;
  }

  return {
    current,
    previous,
    delta,
    percentChange,
    direction: delta >= 0 ? "up" : "down",
  };
};

const normalizeRecentTransactions = (transactions) => {
  if (!Array.isArray(transactions)) {
    return [];
  }

  return transactions
    .slice(0, RECENT_TRANSACTIONS_LIMIT)
    .map((transaction) => ({
      id: transaction.id ?? "",
      date: transaction.date ?? null,
      type: transaction.type ?? "Expense",
      amount: Number.isFinite(transaction.amount) ? transaction.amount : 0,
      projectId: transaction.projectId ?? "",
      projectName: transaction.projectName ?? null,
    }))
    .filter((transaction) => Boolean(transaction.id));
};

const countActiveProjects = ({ transactions = [], aggregates = {} }) => {
  const ids = new Set();

  transactions.forEach((transaction) => {
    if (transaction.projectId) {
      ids.add(transaction.projectId);
    }
  });

  const aggregateProjects = Array.isArray(aggregates.byProject) ? aggregates.byProject : [];
  aggregateProjects.forEach((aggregate) => {
    if (aggregate?.projectId) {
      ids.add(aggregate.projectId);
    }
  });

  return ids.size;
};

export async function fetchDashboardOverview({ signal } = {}) {
  const currentRange = getCurrentMonthRange();
  const previousRange = getPreviousMonthRange();

  const [currentPeriod, previousPeriod] = await Promise.all([
    fetchSummaryReport({
      startDate: currentRange.start ?? undefined,
      endDate: currentRange.end ?? undefined,
      limit: RECENT_TRANSACTIONS_LIMIT,
      signal,
    }),
    fetchSummaryReport({
      startDate: previousRange.start ?? undefined,
      endDate: previousRange.end ?? undefined,
      limit: 1,
      signal,
    }),
  ]);

  const { summary, transactions, aggregates } = currentPeriod;
  const previousSummary = previousPeriod?.summary ?? {};

  return {
    summary,
    recentTransactions: normalizeRecentTransactions(transactions),
    projectCount: countActiveProjects({ transactions, aggregates }),
    comparisons: {
      income: computePeriodComparison(summary?.income, previousSummary?.income),
      expense: computePeriodComparison(summary?.expense, previousSummary?.expense),
      balance: computePeriodComparison(summary?.balance, previousSummary?.balance),
    },
  };
}
