// File: src/lib/queries/reports.js
import { apiJSON } from "@/lib/api";
import { toNumeric } from "@/lib/utils/numbers";

const REPORTS_BASE = "/api/reports";
const REPORT_FILTERS_ENDPOINT = `${REPORTS_BASE}/filters`;
const CHARTS_ENDPOINT = `${REPORTS_BASE}/charts`;
const SUMMARY_ENDPOINT = `${REPORTS_BASE}/summary`;
const SUMMARY_FILTERS_ENDPOINT = `${SUMMARY_ENDPOINT}/filters`;

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const normalizeTransaction = (transaction) => {
  if (!transaction || typeof transaction !== "object") {
    return null;
  }

  return {
    id: transaction.id ?? "",
    projectId: transaction.projectId ?? "",
    projectName: transaction.projectName ?? null,
    date: transaction.date ?? null,
    type: transaction.type ?? "Expense",
    subcategory: transaction.subcategory ?? "",
    amount: toNumeric(transaction.amount),
    description: transaction.description ?? "",
  };
};

const normalizeSummary = (summary) => {
  const income = toNumeric(summary?.income);
  const expense = toNumeric(summary?.expense);
  const balanceValue = toNumeric(summary?.balance);
  const hasBalance = summary?.balance !== undefined && summary?.balance !== null;
  const balance = hasBalance && Number.isFinite(balanceValue) ? balanceValue : income - expense;
  const counts = summary?.counts ?? {};

  const incomeCount = toNumeric(counts.income);
  const expenseCount = toNumeric(counts.expense);
  const hasTotalCount = counts.total !== undefined && counts.total !== null;
  const totalCount = hasTotalCount ? toNumeric(counts.total) : incomeCount + expenseCount;

  return {
    income,
    expense,
    balance,
    counts: {
      income: incomeCount,
      expense: expenseCount,
      total: totalCount,
    },
  };
};

const normalizeAggregateByProject = (aggregate) => {
  if (!aggregate || typeof aggregate !== "object") {
    return null;
  }

  return {
    projectId: aggregate.projectId ?? "",
    projectName: aggregate.projectName ?? null,
    income: toNumeric(aggregate.income),
    expense: toNumeric(aggregate.expense),
    balance: toNumeric(aggregate.balance),
    transactionCount: toNumeric(aggregate.transactionCount),
  };
};

const normalizeProjects = (projects) => {
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects
    .map((project) => {
      if (!project || typeof project !== "object") {
        return null;
      }
      const value = project.value ?? project.id ?? "";
      if (!value) {
        return null;
      }
      return {
        id: project.id ?? value,
        name: project.name ?? project.label ?? "",
        label: project.label ?? project.name ?? "",
        value,
      };
    })
    .filter(Boolean);
};

const normalizeTransactionTypes = (types) => {
  if (!Array.isArray(types)) {
    return [];
  }

  return types
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const value = item.value ?? "";
      if (!value) {
        return null;
      }
      return {
        label: item.label ?? value,
        value,
      };
    })
    .filter(Boolean);
};

const normalizeSubcategories = (subcategories) => {
  if (!Array.isArray(subcategories)) {
    return [];
  }

  return subcategories
    .map((item) => {
      if (!item) {
        return null;
      }

      if (typeof item === "string") {
        return { label: item, value: item };
      }

      if (typeof item === "object") {
        const value = item.value ?? item.label;
        if (!value) {
          return null;
        }
        return { label: item.label ?? value, value };
      }

      return null;
    })
    .filter(Boolean);
};

const normalizeAvailableDateRange = (range) => {
  const earliest = typeof range?.earliest === "string" ? range.earliest : null;
  const latest = typeof range?.latest === "string" ? range.latest : null;

  return { earliest, latest };
};

const normalizeAppliedDateRange = (range) => {
  const start = typeof range?.start === "string" ? range.start : null;
  const end = typeof range?.end === "string" ? range.end : null;

  return { start, end };
};

const toLabel = (value) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const normalizeIncomeExpenseSeries = (series) => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .map((item) => {
      const month = toLabel(item?.month);
      if (!month) {
        return null;
      }

      return {
        month,
        income: toNumeric(item?.income),
        expense: toNumeric(item?.expense),
      };
    })
    .filter(Boolean);
};

const normalizeCashFlowSeries = (series) => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .map((item) => {
      const month = toLabel(item?.month);
      if (!month) {
        return null;
      }

      return {
        month,
        cashIn: toNumeric(item?.cashIn),
        cashOut: toNumeric(item?.cashOut),
      };
    })
    .filter(Boolean);
};

const normalizeCategoryBreakdown = (series) => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .map((item) => {
      const name = toLabel(item?.name);
      if (!name) {
        return null;
      }

      return {
        name,
        value: toNumeric(item?.value),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.value === a.value) {
        return a.name.localeCompare(b.name);
      }
      return b.value - a.value;
    });
};

const normalizeChartsFilters = (filters) => ({
  projectId: filters?.projectId ?? null,
  type: filters?.type ?? null,
  storageType: filters?.storageType ?? null,
});

export async function fetchReportFilters({ signal } = {}) {
  const response = await apiJSON(REPORT_FILTERS_ENDPOINT, { method: "GET", signal });

  return {
    projects: normalizeProjects(response?.projects),
    transactionTypes: normalizeTransactionTypes(response?.transactionTypes),
    dateRange: normalizeAvailableDateRange(response?.dateRange),
  };
}

export async function fetchReportCharts({ projectId, type, startDate, endDate, signal } = {}) {
  const queryString = buildQueryString({ projectId, type, startDate, endDate });
  const response = await apiJSON(`${CHARTS_ENDPOINT}${queryString}`, { method: "GET", signal });

  return {
    incomeVsExpense: normalizeIncomeExpenseSeries(response?.incomeVsExpense),
    cashFlow: normalizeCashFlowSeries(response?.cashFlow),
    incomeByCategory: normalizeCategoryBreakdown(response?.incomeByCategory),
    expenseByCategory: normalizeCategoryBreakdown(response?.expenseByCategory),
    summary: normalizeSummary(response?.summary),
    dateRange: normalizeAppliedDateRange(response?.dateRange),
    filters: normalizeChartsFilters(response?.filters ?? {}),
  };
}

export async function fetchSummaryFilters({ signal } = {}) {
  const response = await apiJSON(SUMMARY_FILTERS_ENDPOINT, { method: "GET", signal });

  return {
    projects: normalizeProjects(response?.projects),
    transactionTypes: normalizeTransactionTypes(response?.transactionTypes),
    subcategories: normalizeSubcategories(response?.subcategories),
    dateRange: normalizeAvailableDateRange(response?.dateRange),
  };
}

export async function fetchSummaryReport({
  projectId,
  type,
  startDate,
  endDate,
  subcategory,
  limit,
  cursor,
  sort,
  signal,
} = {}) {
  const queryString = buildQueryString({ projectId, type, startDate, endDate, subcategory, limit, cursor, sort });
  const response = await apiJSON(`${SUMMARY_ENDPOINT}${queryString}`, { method: "GET", signal });

  const transactions = Array.isArray(response?.transactions)
    ? response.transactions.map(normalizeTransaction).filter(Boolean)
    : [];

  const summary = normalizeSummary(response?.summary);

  const pageInfo = {
    hasNextPage: Boolean(response?.pageInfo?.hasNextPage),
    nextCursor: response?.pageInfo?.nextCursor ?? null,
    limit: toNumeric(response?.pageInfo?.limit ?? limit ?? 20),
  };

  const totalCount = toNumeric(response?.totalCount ?? transactions.length);

  const aggregates = {
    byProject: Array.isArray(response?.aggregates?.byProject)
      ? response.aggregates.byProject.map(normalizeAggregateByProject).filter(Boolean)
      : [],
  };

  return { transactions, summary, pageInfo, totalCount, aggregates };
}
