// File: src/lib/queries/admin-orders.js
import { apiJSON } from "@/lib/api";
import { formatCurrencyWithCode, formatNumber } from "@/lib/formatters";
import { qk } from "@/lib/query-keys";

const ORDER_LIST_ENDPOINT = "/api/orders";
const ORDER_SUMMARY_ENDPOINT = "/api/orders/summary";
const PAYMENT_SUMMARY_ENDPOINT = "/api/orders/payments/summary";

const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.nodes)) return value.nodes;
  if (Array.isArray(value?.rows)) return value.rows;
  if (value?.data) return ensureArray(value.data);
  if (value?.results) return ensureArray(value.results);
  if (value?.nodes) return ensureArray(value.nodes);
  if (value?.rows) return ensureArray(value.rows);
  return [];
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object") {
    if (value.$numberDecimal != null) return toNumber(value.$numberDecimal);
    if (value.$numberDouble != null) return toNumber(value.$numberDouble);
    if (value.$numberInt != null) return toNumber(value.$numberInt);
    if (value.$numberLong != null) return toNumber(value.$numberLong);
    if (typeof value.valueOf === "function") return toNumber(value.valueOf());
  }
  if (typeof value === "bigint") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringSafe = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value.toString === "function") return value.toString();
  return String(value ?? "");
};

const extractId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value.$oid) return extractId(value.$oid);
    if (value._id) return extractId(value._id);
    if (value.id) return extractId(value.id);
  }
  return null;
};

const extractDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "object") {
    if (value.$date) return extractDate(value.$date);
    if (typeof value.toISOString === "function") return value.toISOString();
  }
  return null;
};

const formatStatusLabel = (status, fallback = "Unknown") => {
  if (typeof status !== "string" || !status.trim()) return fallback;
  return status
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizePageInfo = (pageInfo) => {
  if (!pageInfo || typeof pageInfo !== "object") {
    return { hasNextPage: false, nextCursor: null };
  }

  return {
    hasNextPage: Boolean(pageInfo.hasNextPage),
    nextCursor: pageInfo.nextCursor ?? null,
    limit: pageInfo.limit ?? null,
  };
};

const normalizeUserReference = (user) => {
  if (!user || typeof user !== "object") {
    return {
      userId: null,
      email: null,
      username: null,
      fullName: null,
      subscriptionStatus: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
    };
  }

  const firstName = toStringSafe(user.firstName).trim();
  const lastName = toStringSafe(user.lastName).trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    userId: extractId(user),
    email: user.email ?? null,
    username: user.username ?? null,
    fullName: fullName || null,
    subscriptionStatus: user.subscriptionStatus ?? null,
    subscriptionStartDate: extractDate(user.subscriptionStartDate),
    subscriptionEndDate: extractDate(user.subscriptionEndDate),
  };
};

const normalizePlanReference = (plan) => {
  if (!plan || typeof plan !== "object") {
    return {
      planId: null,
      planName: null,
      planSlug: null,
      billingCycle: null,
      price: null,
      currency: null,
    };
  }

  return {
    planId: extractId(plan),
    planName: plan.name ?? null,
    planSlug: plan.slug ?? null,
    billingCycle: plan.billingCycle ?? null,
    price: toNumber(plan.price),
    currency: plan.currency ?? null,
  };
};

const normalizePaymentReference = (payment) => {
  if (!payment || typeof payment !== "object") {
    return {
      paymentId: null,
      status: null,
      statusLabel: "Unknown",
      amount: null,
      refundedAmount: null,
      currency: null,
      paymentGateway: null,
      gatewayTransactionId: null,
      purpose: null,
      processedAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  const status = typeof payment.status === "string" ? payment.status.trim().toLowerCase() : null;

  return {
    paymentId: extractId(payment),
    status,
    statusLabel: formatStatusLabel(status, "Unknown"),
    amount: toNumber(payment.amount),
    refundedAmount: toNumber(payment.refundedAmount),
    currency: payment.currency ?? null,
    paymentGateway: payment.paymentGateway ?? null,
    gatewayTransactionId: payment.gatewayTransactionId ?? null,
    purpose: payment.purpose ?? null,
    processedAt: extractDate(payment.processedAt),
    createdAt: extractDate(payment.createdAt),
    updatedAt: extractDate(payment.updatedAt),
    invoiceId: extractId(payment.invoiceId),
  };
};

const normalizeInvoiceReference = (invoice) => {
  if (!invoice || typeof invoice !== "object") {
    return {
      invoiceId: null,
      invoiceNumber: null,
      status: null,
      statusLabel: "Unknown",
      amount: null,
      currency: null,
      issuedDate: null,
      dueDate: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  const status = typeof invoice.status === "string" ? invoice.status.trim().toLowerCase() : null;

  return {
    invoiceId: extractId(invoice),
    invoiceNumber: invoice.invoiceNumber ?? null,
    status,
    statusLabel: formatStatusLabel(status, "Unknown"),
    amount: toNumber(invoice.amount),
    currency: invoice.currency ?? null,
    issuedDate: extractDate(invoice.issuedDate),
    dueDate: extractDate(invoice.dueDate),
    subscriptionStartDate: extractDate(invoice.subscriptionStartDate),
    subscriptionEndDate: extractDate(invoice.subscriptionEndDate),
    createdAt: extractDate(invoice.createdAt),
    updatedAt: extractDate(invoice.updatedAt),
  };
};

const normalizeOrder = (order) => {
  if (!order || typeof order !== "object") return null;

  const id = extractId(order);
  const status = typeof order.status === "string" ? order.status.trim().toLowerCase() : null;

  return {
    id,
    orderId: id,
    orderNumber: order.orderID ?? id ?? "",
    status,
    statusLabel: formatStatusLabel(status, "Unknown"),
    amount: toNumber(order.amount),
    currency: order.currency ?? null,
    startDate: extractDate(order.startDate),
    endDate: extractDate(order.endDate),
    renewalDate: extractDate(order.renewalDate),
    createdAt: extractDate(order.createdAt),
    updatedAt: extractDate(order.updatedAt),
    user: normalizeUserReference(order.user),
    plan: normalizePlanReference(order.plan),
    payment: normalizePaymentReference(order.payment),
    invoice: normalizeInvoiceReference(order.invoice),
    raw: order,
  };
};

const normalizePlanBreakdown = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  return {
    key: extractId(entry.planId ?? entry.plan),
    label: entry.planName ?? "Unknown plan",
    planSlug: entry.planSlug ?? null,
    count: toNumber(entry.count) ?? 0,
    totalAmount: toNumber(entry.totalAmount) ?? 0,
  };
};

const normalizeYearBreakdown = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  return {
    key: entry.year ?? null,
    label: entry.year ? String(entry.year) : "Unknown",
    year: entry.year ?? null,
    count: toNumber(entry.count) ?? 0,
    totalAmount: toNumber(entry.totalAmount) ?? 0,
  };
};

const normalizeMonthBreakdown = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  const year = entry.year ?? entry._id?.year ?? null;
  const month = entry.month ?? entry._id?.month ?? null;
  return {
    key: year && month ? `${year}-${String(month).padStart(2, "0")}` : null,
    label: month ? `${year ?? "Unknown"}-${String(month).padStart(2, "0")}` : "Unknown",
    year,
    month,
    count: toNumber(entry.count) ?? 0,
    totalAmount: toNumber(entry.totalAmount) ?? 0,
  };
};

const normalizeUserBucket = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  const userId = extractId(entry.userId ?? entry.user);
  const firstName = toStringSafe(entry.firstName).trim();
  const lastName = toStringSafe(entry.lastName).trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    key: userId ?? entry.userEmail ?? Math.random().toString(36).slice(2),
    userId,
    email: entry.userEmail ?? null,
    username: entry.username ?? null,
    fullName: fullName || entry.username || entry.userEmail || "Unknown user",
    count: toNumber(entry.count) ?? 0,
    totalAmount: toNumber(entry.totalAmount) ?? 0,
  };
};

const normalizeOrderSummaryData = (data) => {
  if (!data || typeof data !== "object") {
    return {
      totals: { totalOrders: 0, totalAmount: 0 },
      byStatus: [],
      byPaymentStatus: [],
      byPaymentGateway: [],
      byPlan: [],
      byYear: [],
      byMonth: [],
    };
  }

  return {
    totals: {
      totalOrders: toNumber(data.totals?.totalOrders) ?? 0,
      totalAmount: toNumber(data.totals?.totalAmount) ?? 0,
    },
    byStatus: ensureArray(data.byStatus)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const status = entry.status ?? entry._id ?? null;
        return {
          key: status,
          label: formatStatusLabel(status, "Unknown"),
          count: toNumber(entry.count) ?? 0,
          totalAmount: toNumber(entry.totalAmount) ?? 0,
        };
      })
      .filter(Boolean),
    byPaymentStatus: ensureArray(data.byPaymentStatus)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const status = entry.paymentStatus ?? entry._id ?? null;
        return {
          key: status,
          label: formatStatusLabel(status, "Unknown"),
          count: toNumber(entry.count) ?? 0,
          totalAmount: toNumber(entry.totalAmount) ?? 0,
        };
      })
      .filter(Boolean),
    byPaymentGateway: ensureArray(data.byPaymentGateway)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const gateway = entry.paymentGateway ?? entry._id ?? null;
        const label = gateway
          ? gateway
              .toString()
              .split(/[\s_-]+/)
              .filter(Boolean)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ")
          : "Unknown";
        return {
          key: gateway,
          label,
          count: toNumber(entry.count) ?? 0,
          totalAmount: toNumber(entry.totalAmount) ?? 0,
        };
      })
      .filter(Boolean),
    byPlan: ensureArray(data.byPlan).map(normalizePlanBreakdown).filter(Boolean),
    byYear: ensureArray(data.byYear).map(normalizeYearBreakdown).filter(Boolean),
    byMonth: ensureArray(data.byMonth).map(normalizeMonthBreakdown).filter(Boolean),
  };
};

const normalizePaymentSummaryData = (data) => {
  if (!data || typeof data !== "object") {
    return {
      totals: { totalPayments: 0, totalAmount: 0 },
      byStatus: [],
      byGateway: [],
      byPurpose: [],
      byPlan: [],
      byYear: [],
      byMonth: [],
    };
  }

  return {
    totals: {
      totalPayments: toNumber(data.totals?.totalPayments) ?? 0,
      totalAmount: toNumber(data.totals?.totalAmount) ?? 0,
    },
    byStatus: ensureArray(data.byStatus)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const status = entry.status ?? entry._id ?? null;
        return {
          key: status,
          label: formatStatusLabel(status, "Unknown"),
          count: toNumber(entry.count) ?? 0,
          totalAmount: toNumber(entry.totalAmount) ?? 0,
        };
      })
      .filter(Boolean),
    byGateway: ensureArray(data.byGateway)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const gateway = entry.paymentGateway ?? entry._id ?? null;
        const label = gateway
          ? gateway
              .toString()
              .split(/[\s_-]+/)
              .filter(Boolean)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ")
          : "Unknown";
        return {
          key: gateway,
          label,
          count: toNumber(entry.count) ?? 0,
          totalAmount: toNumber(entry.totalAmount) ?? 0,
        };
      })
      .filter(Boolean),
    byPurpose: ensureArray(data.byPurpose)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const purpose = entry.purpose ?? entry._id ?? null;
        return {
          key: purpose,
          label: formatStatusLabel(purpose, "Unknown"),
          count: toNumber(entry.count) ?? 0,
          totalAmount: toNumber(entry.totalAmount) ?? 0,
        };
      })
      .filter(Boolean),
    byPlan: ensureArray(data.byPlan).map(normalizePlanBreakdown).filter(Boolean),
    byYear: ensureArray(data.byYear).map(normalizeYearBreakdown).filter(Boolean),
    byMonth: ensureArray(data.byMonth).map(normalizeMonthBreakdown).filter(Boolean),
  };
};

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

export const ORDER_SUPPORT_DEFAULT_FILTERS = {
  orderNumber: "",
  status: "all",
  userEmail: "",
  userId: "",
  planSlug: "",
  planId: "",
  paymentStatus: "all",
  paymentGateway: "",
  gatewayTransactionId: "",
  invoiceNumber: "",
  startDate: "",
  endDate: "",
};

export const sanitizeOrderFilters = (filters = {}) => {
  const sanitized = {};

  const normalizedString = (value) => (typeof value === "string" ? value.trim() : "");

  const orderNumber = normalizedString(filters.orderNumber);
  if (orderNumber) sanitized.orderNumber = orderNumber;

  const status = normalizedString(filters.status).toLowerCase();
  if (status && status !== "all") sanitized.status = status;

  const userEmail = normalizedString(filters.userEmail);
  if (userEmail) sanitized.userEmail = userEmail;

  const userId = normalizedString(filters.userId);
  if (userId) sanitized.userId = userId;

  const planSlug = normalizedString(filters.planSlug);
  if (planSlug) sanitized.planSlug = planSlug;

  const planId = normalizedString(filters.planId);
  if (planId) sanitized.planId = planId;

  const paymentStatus = normalizedString(filters.paymentStatus).toLowerCase();
  if (paymentStatus && paymentStatus !== "all") sanitized.paymentStatus = paymentStatus;

  const paymentGateway = normalizedString(filters.paymentGateway);
  if (paymentGateway) sanitized.paymentGateway = paymentGateway;

  const gatewayTransactionId = normalizedString(filters.gatewayTransactionId);
  if (gatewayTransactionId) sanitized.gatewayTransactionId = gatewayTransactionId;

  const invoiceNumber = normalizedString(filters.invoiceNumber);
  if (invoiceNumber) sanitized.invoiceNumber = invoiceNumber;

  const startDate = normalizedString(filters.startDate);
  if (startDate) sanitized.startDate = startDate;

  const endDate = normalizedString(filters.endDate);
  if (endDate) sanitized.endDate = endDate;

  return sanitized;
};

export const adminOrderListInfiniteOptions = (filters = {}, { limit = 20 } = {}) => {
  const sanitizedFilters = sanitizeOrderFilters(filters);
  const appliedFilters = { ...sanitizedFilters, limit };

  return {
    queryKey: qk.admin.orders.list(appliedFilters),
    queryFn: async ({ signal, pageParam = null }) => {
      const query = buildQueryString({ ...appliedFilters, cursor: pageParam ?? undefined });
      const response = await apiJSON(`${ORDER_LIST_ENDPOINT}${query}`, { signal });
      const nodes = ensureArray(response?.data).map(normalizeOrder).filter(Boolean);
      const pageInfo = normalizePageInfo(response?.pageInfo);
      return { nodes, pageInfo, raw: response };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      const pageInfo = lastPage?.pageInfo;
      if (!pageInfo || !pageInfo.hasNextPage || !pageInfo.nextCursor) return undefined;
      return pageInfo.nextCursor;
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  };
};

export const adminOrderSummaryInfiniteOptions = (filters = {}, { byUserLimit = 10 } = {}) => {
  const sanitizedFilters = sanitizeOrderFilters(filters);
  const appliedFilters = { ...sanitizedFilters, byUserLimit };

  return {
    queryKey: qk.admin.orders.summary(appliedFilters),
    queryFn: async ({ signal, pageParam = null }) => {
      const query = buildQueryString({ ...appliedFilters, byUserCursor: pageParam ?? undefined });
      const response = await apiJSON(`${ORDER_SUMMARY_ENDPOINT}${query}`, { signal });
      const summary = normalizeOrderSummaryData(response?.data);
      const byUserNodes = ensureArray(response?.data?.byUser).map(normalizeUserBucket).filter(Boolean);
      const pageInfo = normalizePageInfo(response?.data?.byUserPageInfo ?? response?.data?.pageInfo);
      return { summary, byUserNodes, pageInfo, raw: response };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      const pageInfo = lastPage?.pageInfo;
      if (!pageInfo || !pageInfo.hasNextPage || !pageInfo.nextCursor) return undefined;
      return pageInfo.nextCursor;
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  };
};

export const adminOrderPaymentSummaryInfiniteOptions = (
  filters = {},
  { byUserLimit = 10 } = {},
) => {
  const sanitizedFilters = sanitizeOrderFilters(filters);
  const appliedFilters = { ...sanitizedFilters, byUserLimit };

  return {
    queryKey: qk.admin.orders.paymentsSummary(appliedFilters),
    queryFn: async ({ signal, pageParam = null }) => {
      const query = buildQueryString({ ...appliedFilters, byUserCursor: pageParam ?? undefined });
      const response = await apiJSON(`${PAYMENT_SUMMARY_ENDPOINT}${query}`, { signal });
      const summary = normalizePaymentSummaryData(response?.data);
      const byUserNodes = ensureArray(response?.data?.byUser).map(normalizeUserBucket).filter(Boolean);
      const pageInfo = normalizePageInfo(response?.data?.byUserPageInfo ?? response?.data?.pageInfo);
      return { summary, byUserNodes, pageInfo, raw: response };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      const pageInfo = lastPage?.pageInfo;
      if (!pageInfo || !pageInfo.hasNextPage || !pageInfo.nextCursor) return undefined;
      return pageInfo.nextCursor;
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  };
};

export const adminOrderDetailOptions = (orderNumber) => {
  const normalized = typeof orderNumber === "string" ? orderNumber.trim() : "";
  const hasOrderNumber = normalized.length > 0;
  const keyOrderNumber = hasOrderNumber ? normalized : "__placeholder__";

  return {
    queryKey: qk.admin.orders.detail(keyOrderNumber),
    enabled: hasOrderNumber,
    queryFn: async ({ signal }) => {
      if (!hasOrderNumber) return null;
      const response = await apiJSON(`${ORDER_LIST_ENDPOINT}/${encodeURIComponent(normalized)}`, { signal });
      return normalizeOrder(response?.data ?? response);
    },
    retry: false,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  };
};

export const formatOrderCurrency = (amount, currency) =>
  formatCurrencyWithCode(amount, currency || "BDT", { fallback: "—" });

export const formatOrderCount = (value) => formatNumber(value, { fallback: "0", minimumFractionDigits: 0 });

export { normalizeOrder };
