// File: src/lib/queries/admin-invoices.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const INVOICE_LIST_ENDPOINT = "/api/invoices";
const INVOICE_SUMMARY_ENDPOINT = "/api/invoices/summary";
const INVOICE_DETAIL_ENDPOINT = (invoiceNumber) =>
  `/api/invoices/${encodeURIComponent(invoiceNumber)}`;

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.nodes)) return value.nodes;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
};

const toNumber = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "bigint") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object") {
    if (typeof value.valueOf === "function") {
      const candidate = value.valueOf();
      if (typeof candidate === "number") {
        return Number.isFinite(candidate) ? candidate : null;
      }
      if (typeof candidate === "string") {
        const parsed = Number(candidate);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    if (typeof value.$numberDecimal === "string") {
      const parsed = Number(value.$numberDecimal);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value.$numberDouble === "string") {
      const parsed = Number(value.$numberDouble);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value.$numberInt === "string") {
      const parsed = Number(value.$numberInt);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringSafe = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return String(value ?? "");
};

const normalizeStatus = (status) => {
  if (typeof status !== "string" || !status.trim()) {
    return { status: null, label: "Unknown" };
  }
  const normalized = status.trim().toLowerCase();
  const label = normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { status: normalized, label: label || status };
};

const extractId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (typeof value._id === "string") return value._id;
    if (typeof value.id === "string") return value.id;
    if (value._id && typeof value._id.toString === "function") {
      return value._id.toString();
    }
    if (value.id && typeof value.id.toString === "function") {
      return value.id.toString();
    }
  }
  return null;
};

const extractDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "object") {
    if (value.$date) {
      return extractDate(value.$date);
    }
    if (typeof value.toString === "function") {
      const candidate = value.toString();
      if (candidate) {
        return extractDate(candidate);
      }
    }
  }
  return null;
};

const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const allowedFilterKeys = new Set([
  "limit",
  "cursor",
  "invoiceNumber",
  "status",
  "userId",
  "userEmail",
  "planId",
  "planSlug",
  "paymentStatus",
  "paymentGateway",
  "startDate",
  "endDate",
  "byUserLimit",
  "byUserCursor",
]);

export const sanitizeInvoiceFilters = (filters = {}) => {
  if (!filters || typeof filters !== "object") return {};

  const result = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!allowedFilterKeys.has(key)) {
      return;
    }

    if (value == null) {
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      switch (key) {
        case "status":
        case "paymentStatus":
        case "planSlug":
        case "paymentGateway":
          if (trimmed.toLowerCase() === "all") {
            return;
          }
          result[key] = trimmed.toLowerCase();
          return;
        case "userEmail":
          result[key] = trimmed.toLowerCase();
          return;
        default:
          result[key] = trimmed;
          return;
      }
    }

    if (key === "limit" || key === "byUserLimit") {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue) && numericValue > 0) {
        result[key] = numericValue;
      }
      return;
    }

    if (key === "cursor" || key === "byUserCursor") {
      result[key] = String(value);
      return;
    }

    result[key] = value;
  });

  return result;
};

const normalizePageInfo = (pageInfo) => {
  if (!pageInfo || typeof pageInfo !== "object") {
    return { nextCursor: null, hasNextPage: false };
  }

  const nextCursor = pageInfo.nextCursor ? String(pageInfo.nextCursor) : null;
  return {
    nextCursor,
    hasNextPage: Boolean(pageInfo.hasNextPage && nextCursor),
  };
};

const formatPersonName = ({ firstName, lastName, username, userEmail }) => {
  const parts = [];
  if (firstName) parts.push(firstName);
  if (lastName) parts.push(lastName);
  if (parts.length) {
    return parts.join(" ");
  }
  if (username) return username;
  if (userEmail) return userEmail;
  return null;
};

const normalizeInvoice = (invoice) => {
  if (!invoice || typeof invoice !== "object") return null;

  const id = extractId(invoice) || toStringSafe(invoice.invoiceNumber) || null;
  const invoiceNumber = invoice.invoiceNumber ? toStringSafe(invoice.invoiceNumber) : id;

  const user = invoice.user || {};
  const plan = invoice.plan || {};
  const payment = invoice.payment || {};

  const { status, label: statusLabel } = normalizeStatus(invoice.status);
  const { status: paymentStatus, label: paymentStatusLabel } = normalizeStatus(payment.status);

  const userFirstName = toStringSafe(user.firstName).trim() || null;
  const userLastName = toStringSafe(user.lastName).trim() || null;
  const username = toStringSafe(user.username).trim() || null;
  const userEmail = toStringSafe(user.email).trim() || null;

  const displayName =
    formatPersonName({ firstName: userFirstName, lastName: userLastName, username, userEmail }) ||
    "Unknown customer";

  return {
    id,
    invoiceId: id,
    invoiceNumber,
    amount: toNumber(invoice.amount ?? payment.amount),
    currency: invoice.currency || payment.currency || null,
    status,
    statusLabel,
    issuedDate: extractDate(invoice.issuedDate),
    dueDate: extractDate(invoice.dueDate),
    subscriptionStartDate: extractDate(invoice.subscriptionStartDate),
    subscriptionEndDate: extractDate(invoice.subscriptionEndDate),
    userId: extractId(user),
    userName: displayName,
    userEmail,
    username,
    planId: extractId(plan),
    planName: plan.name ? toStringSafe(plan.name) : null,
    planSlug: plan.slug ? toStringSafe(plan.slug) : null,
    planBillingCycle: plan.billingCycle ? toStringSafe(plan.billingCycle) : null,
    planCurrency: plan.currency ? toStringSafe(plan.currency) : null,
    paymentStatus,
    paymentStatusLabel,
    paymentGateway: payment.paymentGateway ? toStringSafe(payment.paymentGateway) : null,
    paymentReference: payment.gatewayTransactionId ? toStringSafe(payment.gatewayTransactionId) : null,
    paymentPurpose: payment.purpose ? toStringSafe(payment.purpose) : null,
    paymentAmount: toNumber(payment.amount),
    paymentCurrency: payment.currency ? toStringSafe(payment.currency) : null,
    paymentProcessedAt: extractDate(payment.processedAt),
    paymentCreatedAt: extractDate(payment.createdAt),
    paymentUpdatedAt: extractDate(payment.updatedAt),
    raw: invoice,
  };
};

const normalizeBreakdownEntry = (value, { keyName }) => {
  if (!value || typeof value !== "object") return null;
  const rawKey = value[keyName];
  const numericCount = toNumber(value.count);
  const numericAmount = toNumber(value.totalAmount);

  let label;
  if (typeof rawKey === "string") {
    const { label: statusLabel } = normalizeStatus(rawKey);
    label = statusLabel;
  } else {
    label = rawKey != null ? toStringSafe(rawKey) : "Unknown";
  }

  return {
    key: rawKey ?? null,
    label,
    count: typeof numericCount === "number" ? numericCount : 0,
    totalAmount: typeof numericAmount === "number" ? numericAmount : 0,
  };
};

const normalizePlanBreakdown = (value) => {
  if (!value || typeof value !== "object") return null;
  const numericCount = toNumber(value.count);
  const numericAmount = toNumber(value.totalAmount);

  const planName = value.planName ? toStringSafe(value.planName) : null;
  const planSlug = value.planSlug ? toStringSafe(value.planSlug) : null;

  let label = planName || planSlug || "Unknown plan";
  if (planName && planSlug && planSlug !== planName) {
    label = `${planName} (${planSlug})`;
  }

  return {
    planId: value.planId ? toStringSafe(value.planId) : null,
    planName,
    planSlug,
    label,
    count: typeof numericCount === "number" ? numericCount : 0,
    totalAmount: typeof numericAmount === "number" ? numericAmount : 0,
  };
};

const normalizeUserBucket = (value) => {
  if (!value || typeof value !== "object") return null;

  const userId = value.userId ? toStringSafe(value.userId) : null;
  const numericCount = toNumber(value.count);
  const numericAmount = toNumber(value.totalAmount);

  const firstName = value.firstName ? toStringSafe(value.firstName) : null;
  const lastName = value.lastName ? toStringSafe(value.lastName) : null;
  const username = value.username ? toStringSafe(value.username) : null;
  const userEmail = value.userEmail ? toStringSafe(value.userEmail) : null;
  const displayName =
    formatPersonName({ firstName, lastName, username, userEmail }) || "Unknown customer";

  return {
    userId,
    displayName,
    username,
    userEmail,
    count: typeof numericCount === "number" ? numericCount : 0,
    totalAmount: typeof numericAmount === "number" ? numericAmount : 0,
  };
};

const normalizeYearEntry = (value) => {
  if (!value || typeof value !== "object") return null;
  const year = typeof value.year === "number" ? value.year : Number(value.year) || null;
  const numericCount = toNumber(value.count);
  const numericAmount = toNumber(value.totalAmount);
  return {
    year,
    count: typeof numericCount === "number" ? numericCount : 0,
    totalAmount: typeof numericAmount === "number" ? numericAmount : 0,
  };
};

const normalizeMonthEntry = (value) => {
  if (!value || typeof value !== "object") return null;
  const year = typeof value.year === "number" ? value.year : Number(value.year) || null;
  const month = typeof value.month === "number" ? value.month : Number(value.month) || null;
  const numericCount = toNumber(value.count);
  const numericAmount = toNumber(value.totalAmount);
  return {
    year,
    month,
    count: typeof numericCount === "number" ? numericCount : 0,
    totalAmount: typeof numericAmount === "number" ? numericAmount : 0,
  };
};

const normalizeSummaryData = (data) => {
  if (!data || typeof data !== "object") {
    return {
      totals: { totalInvoices: 0, totalAmount: 0 },
      byStatus: [],
      byPaymentStatus: [],
      byPaymentGateway: [],
      byCurrency: [],
      byPlan: [],
      byYear: [],
      byMonth: [],
    };
  }

  const totals = {
    totalInvoices: toNumber(data.totals?.totalInvoices) ?? 0,
    totalAmount: toNumber(data.totals?.totalAmount) ?? 0,
  };

  const byStatus = ensureArray(data.byStatus)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "status" }))
    .filter(Boolean);

  const byPaymentStatus = ensureArray(data.byPaymentStatus)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "paymentStatus" }))
    .filter(Boolean);

  const byPaymentGateway = ensureArray(data.byPaymentGateway)
    .map((entry) => {
      const normalized = normalizeBreakdownEntry(entry, { keyName: "paymentGateway" });
      if (!normalized) return null;
      const key = entry.paymentGateway ? toStringSafe(entry.paymentGateway).toLowerCase() : null;
      const label = entry.paymentGateway
        ? entry.paymentGateway
            .toString()
            .split(/[\s_-]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")
        : "Unknown";
      return { ...normalized, key, label };
    })
    .filter(Boolean);

  const byCurrency = ensureArray(data.byCurrency)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const currency = entry.currency ? toStringSafe(entry.currency).toUpperCase() : null;
      const numericCount = toNumber(entry.count);
      const numericAmount = toNumber(entry.totalAmount);
      return {
        currency,
        label: currency || "Unknown",
        count: typeof numericCount === "number" ? numericCount : 0,
        totalAmount: typeof numericAmount === "number" ? numericAmount : 0,
      };
    })
    .filter(Boolean);

  const byPlan = ensureArray(data.byPlan).map(normalizePlanBreakdown).filter(Boolean);
  const byYear = ensureArray(data.byYear).map(normalizeYearEntry).filter(Boolean);
  const byMonth = ensureArray(data.byMonth).map(normalizeMonthEntry).filter(Boolean);

  return {
    totals,
    byStatus,
    byPaymentStatus,
    byPaymentGateway,
    byCurrency,
    byPlan,
    byYear,
    byMonth,
  };
};

export const adminInvoiceListOptions = (filters = {}, { limit = 20 } = {}) => {
  const sanitizedFilters = sanitizeInvoiceFilters(filters);
  const appliedFilters = { ...sanitizedFilters, limit };

  return {
    queryKey: qk.admin.invoices.list(appliedFilters),
    queryFn: async ({ signal, pageParam = null }) => {
      const query = buildQueryString({ ...appliedFilters, cursor: pageParam ?? undefined });
      const response = await apiJSON(`${INVOICE_LIST_ENDPOINT}${query}`, { signal });
      const invoices = ensureArray(response?.data).map(normalizeInvoice).filter(Boolean);
      const pageInfo = normalizePageInfo(response?.pageInfo);
      return {
        nodes: invoices,
        pageInfo,
        raw: response,
      };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.pageInfo?.nextCursor ?? null,
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
  };
};

export const adminInvoiceSummaryInfiniteOptions = (filters = {}, { byUserLimit = 10 } = {}) => {
  const sanitizedFilters = sanitizeInvoiceFilters(filters);
  const appliedFilters = { ...sanitizedFilters, byUserLimit };

  return {
    queryKey: qk.admin.invoices.summary(appliedFilters),
    queryFn: async ({ signal, pageParam = null }) => {
      const query = buildQueryString({ ...appliedFilters, byUserCursor: pageParam ?? undefined });
      const response = await apiJSON(`${INVOICE_SUMMARY_ENDPOINT}${query}`, { signal });
      const summary = normalizeSummaryData(response?.data);
      const byUserNodes = ensureArray(response?.data?.byUser?.nodes)
        .map(normalizeUserBucket)
        .filter(Boolean);
      const pageInfo = normalizePageInfo(response?.data?.byUser?.pageInfo);
      return {
        summary,
        byUserNodes,
        pageInfo,
        raw: response,
      };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.pageInfo?.nextCursor ?? null,
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
  };
};

export const adminInvoiceDetailOptions = (invoiceNumber) => {
  const hasInvoiceNumber = Boolean(invoiceNumber);
  const normalizedInvoiceNumber = hasInvoiceNumber ? invoiceNumber : "__placeholder__";

  return {
    queryKey: qk.admin.invoices.detail(normalizedInvoiceNumber),
    enabled: hasInvoiceNumber,
    queryFn: async ({ signal }) => {
      if (!hasInvoiceNumber) return null;
      const response = await apiJSON(INVOICE_DETAIL_ENDPOINT(invoiceNumber), { signal });
      return normalizeInvoice(response?.data);
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  };
};

export { normalizeInvoice };
