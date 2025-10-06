// File: src/lib/queries/reports.js
import { apiJSON } from "@/lib/api";

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
    amount: toSafeNumber(transaction.amount),
    description: transaction.description ?? "",
  };
};

const normalizeSummary = (summary) => {
  const income = toSafeNumber(summary?.income);
  const expense = toSafeNumber(summary?.expense);
  const balanceValue = toSafeNumber(summary?.balance);
  const hasBalance = summary?.balance !== undefined && summary?.balance !== null;
  const balance = hasBalance && Number.isFinite(balanceValue) ? balanceValue : income - expense;
  const counts = summary?.counts ?? {};

  const incomeCount = toSafeNumber(counts.income);
  const expenseCount = toSafeNumber(counts.expense);
  const hasTotalCount = counts.total !== undefined && counts.total !== null;
  const totalCount = hasTotalCount ? toSafeNumber(counts.total) : incomeCount + expenseCount;

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
    income: toSafeNumber(aggregate.income),
    expense: toSafeNumber(aggregate.expense),
    balance: toSafeNumber(aggregate.balance),
    transactionCount: toSafeNumber(aggregate.transactionCount),
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

function toSafeNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (value && typeof value === "object") {
    const decimal = value.$numberDecimal ?? value.$numberDouble ?? value.$numberInt ?? value.$numberLong;
    if (typeof decimal === "string") {
      const parsedDecimal = Number(decimal);
      return Number.isFinite(parsedDecimal) ? parsedDecimal : 0;
    }

    if (typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
      const decimalString = value.toString();
      const parsedFromToString = Number(decimalString);
      return Number.isFinite(parsedFromToString) ? parsedFromToString : 0;
    }
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

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
        income: toSafeNumber(item?.income),
        expense: toSafeNumber(item?.expense),
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
        cashIn: toSafeNumber(item?.cashIn),
        cashOut: toSafeNumber(item?.cashOut),
      };
    })
    .filter(Boolean);
};

const normalizeExpenseByCategory = (series) => {
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
        value: toSafeNumber(item?.value),
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
    expenseByCategory: normalizeExpenseByCategory(response?.expenseByCategory),
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
    limit: response?.pageInfo?.limit ?? limit ?? 20,
  };

  const totalCount = typeof response?.totalCount === "number" ? response.totalCount : transactions.length;

  const aggregates = {
    byProject: Array.isArray(response?.aggregates?.byProject)
      ? response.aggregates.byProject.map(normalizeAggregateByProject).filter(Boolean)
      : [],
  };

  return { transactions, summary, pageInfo, totalCount, aggregates };
}
