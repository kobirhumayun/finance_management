// File: src/lib/queries/dashboard.js
import { fetchSummaryReport } from "@/lib/queries/reports";

const RECENT_TRANSACTIONS_LIMIT = 5;

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
  const { summary, transactions, aggregates } = await fetchSummaryReport({
    limit: RECENT_TRANSACTIONS_LIMIT,
    signal,
  });

  return {
    summary,
    recentTransactions: normalizeRecentTransactions(transactions),
    projectCount: countActiveProjects({ transactions, aggregates }),
  };
}
