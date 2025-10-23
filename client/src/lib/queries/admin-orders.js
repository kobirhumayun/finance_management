// File: src/lib/queries/admin-orders.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const ORDER_LIST_ENDPOINT = "/api/orders";
const ORDER_SUMMARY_ENDPOINT = "/api/orders/summary";
const PAYMENT_SUMMARY_ENDPOINT = "/api/orders/payments/summary";
const ORDER_DETAIL_ENDPOINT = (orderNumber) => `/api/orders/${encodeURIComponent(orderNumber)}`;

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

const normalizeDateInput = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }
    return date.toISOString();
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

const allowedOrderFilterKeys = new Set([
  "limit",
  "cursor",
  "orderNumber",
  "status",
  "userId",
  "userEmail",
  "planId",
  "planSlug",
  "paymentStatus",
  "paymentGateway",
  "gatewayTransactionId",
  "startDate",
  "endDate",
  "invoiceNumber",
  "byUserLimit",
  "byUserCursor",
]);

const allowedPaymentSummaryFilterKeys = new Set([
  "status",
  "userId",
  "userEmail",
  "planId",
  "planSlug",
  "paymentGateway",
  "gatewayTransactionId",
  "purpose",
  "startDate",
  "endDate",
  "byUserLimit",
  "byUserCursor",
]);

export const sanitizeOrderFilters = (filters = {}) => {
  if (!filters || typeof filters !== "object") return {};

  const result = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!allowedOrderFilterKeys.has(key)) {
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

    if (key === "startDate" || key === "endDate") {
      const normalizedDate = normalizeDateInput(value);
      if (normalizedDate) {
        result[key] = normalizedDate;
      }
      return;
    }

    result[key] = value;
  });

  return result;
};

export const sanitizeOrderPaymentSummaryFilters = (filters = {}) => {
  if (!filters || typeof filters !== "object") return {};

  const result = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (!allowedPaymentSummaryFilterKeys.has(key)) {
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
        case "planSlug":
        case "paymentGateway":
        case "purpose":
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

    if (key === "byUserLimit") {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue) && numericValue > 0) {
        result[key] = numericValue;
      }
      return;
    }

    if (key === "byUserCursor") {
      result[key] = String(value);
      return;
    }

    if (key === "startDate" || key === "endDate") {
      const normalizedDate = normalizeDateInput(value);
      if (normalizedDate) {
        result[key] = normalizedDate;
      }
      return;
    }

    result[key] = value;
  });

  return result;
};

const normalizePageInfo = (pageInfo) => {
  if (!pageInfo || typeof pageInfo !== "object") {
    return { nextCursor: null, hasNextPage: false, limit: null };
  }

  const nextCursor = pageInfo.nextCursor ? String(pageInfo.nextCursor) : null;
  const limit = Number.isFinite(pageInfo.limit) ? Number(pageInfo.limit) : null;
  return {
    nextCursor,
    hasNextPage: Boolean(pageInfo.hasNextPage && nextCursor),
    limit,
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

const normalizeUserInfo = (user) => {
  if (!user || typeof user !== "object") {
    return {
      userId: null,
      displayName: "Unknown customer",
      email: null,
      username: null,
      firstName: null,
      lastName: null,
      subscriptionStatus: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      role: null,
    };
  }

  const userId = extractId(user);
  const userEmail = user.email ? toStringSafe(user.email).trim() || null : null;
  const firstName = user.firstName ? toStringSafe(user.firstName).trim() || null : null;
  const lastName = user.lastName ? toStringSafe(user.lastName).trim() || null : null;
  const username = user.username ? toStringSafe(user.username).trim() || null : null;
  const displayName =
    formatPersonName({ firstName, lastName, username, userEmail }) || "Unknown customer";

  return {
    userId,
    displayName,
    email: userEmail,
    username,
    firstName,
    lastName,
    subscriptionStatus: user.subscriptionStatus ? toStringSafe(user.subscriptionStatus) : null,
    subscriptionStartDate: extractDate(user.subscriptionStartDate),
    subscriptionEndDate: extractDate(user.subscriptionEndDate),
    role: user.role ? toStringSafe(user.role) : null,
  };
};

const normalizePlanInfo = (plan) => {
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
    planName: plan.name ? toStringSafe(plan.name) : null,
    planSlug: plan.slug ? toStringSafe(plan.slug) : null,
    billingCycle: plan.billingCycle ? toStringSafe(plan.billingCycle) : null,
    price: toNumber(plan.price),
    currency: plan.currency ? toStringSafe(plan.currency) : null,
  };
};

const normalizePaymentInfo = (payment) => {
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
      invoiceId: null,
    };
  }

  const { status, label: statusLabel } = normalizeStatus(payment.status);

  return {
    paymentId: extractId(payment),
    status,
    statusLabel,
    amount: toNumber(payment.amount),
    refundedAmount: toNumber(payment.refundedAmount),
    currency: payment.currency ? toStringSafe(payment.currency) : null,
    paymentGateway: payment.paymentGateway ? toStringSafe(payment.paymentGateway) : null,
    gatewayTransactionId: payment.gatewayTransactionId
      ? toStringSafe(payment.gatewayTransactionId)
      : null,
    purpose: payment.purpose ? toStringSafe(payment.purpose) : null,
    processedAt: extractDate(payment.processedAt),
    createdAt: extractDate(payment.createdAt),
    updatedAt: extractDate(payment.updatedAt),
    invoiceId: payment.invoiceId ? toStringSafe(payment.invoiceId) : null,
  };
};

const normalizeInvoiceInfo = (invoice) => {
  if (!invoice || typeof invoice !== "object") {
    return {
      invoiceId: null,
      invoiceNumber: null,
      status: null,
      statusLabel: "Unknown",
      issuedDate: null,
      dueDate: null,
      amount: null,
      currency: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
    };
  }

  const { status, label: statusLabel } = normalizeStatus(invoice.status);

  return {
    invoiceId: extractId(invoice),
    invoiceNumber: invoice.invoiceNumber ? toStringSafe(invoice.invoiceNumber) : null,
    status,
    statusLabel,
    issuedDate: extractDate(invoice.issuedDate),
    dueDate: extractDate(invoice.dueDate),
    amount: toNumber(invoice.amount),
    currency: invoice.currency ? toStringSafe(invoice.currency) : null,
    subscriptionStartDate: extractDate(invoice.subscriptionStartDate),
    subscriptionEndDate: extractDate(invoice.subscriptionEndDate),
  };
};

const normalizeOrder = (order) => {
  if (!order || typeof order !== "object") return null;

  const id = extractId(order);
  const orderNumber = order.orderID ? toStringSafe(order.orderID) : id;
  const { status, label: statusLabel } = normalizeStatus(order.status);

  const userInfo = normalizeUserInfo(order.user);
  const planInfo = normalizePlanInfo(order.plan);
  const paymentInfo = normalizePaymentInfo(order.payment);
  const invoiceInfo = normalizeInvoiceInfo(order.invoice);

  return {
    id,
    orderId: id,
    orderNumber,
    status,
    statusLabel,
    amount: toNumber(order.amount ?? order.payment?.amount),
    currency: order.currency ? toStringSafe(order.currency) : paymentInfo.currency,
    startDate: extractDate(order.startDate),
    endDate: extractDate(order.endDate),
    renewalDate: extractDate(order.renewalDate),
    createdAt: extractDate(order.createdAt),
    updatedAt: extractDate(order.updatedAt),
    user: userInfo,
    plan: planInfo,
    payment: paymentInfo,
    invoice: invoiceInfo,
    raw: order,
  };
};

const normalizeBreakdownEntry = (value, { keyName, defaultLabel = "Unknown" }) => {
  if (!value || typeof value !== "object") return null;
  const rawKey = value[keyName];
  const numericCount = toNumber(value.count);
  const numericAmount = toNumber(value.totalAmount);

  let label;
  if (typeof rawKey === "string") {
    const { label: statusLabel } = normalizeStatus(rawKey);
    label = statusLabel;
  } else if (rawKey != null) {
    label = toStringSafe(rawKey);
  }

  return {
    key: rawKey ?? null,
    label: label || defaultLabel,
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

const defaultOrderSummary = {
  totals: { totalOrders: 0, totalAmount: 0 },
  byStatus: [],
  byPaymentStatus: [],
  byPaymentGateway: [],
  byPlan: [],
  byUser: [],
  byYear: [],
  byMonth: [],
  byUserPageInfo: { nextCursor: null, hasNextPage: false, limit: null },
};

const defaultPaymentSummary = {
  totals: { totalPayments: 0, totalAmount: 0 },
  byStatus: [],
  byGateway: [],
  byPurpose: [],
  byUser: [],
  byPlan: [],
  byYear: [],
  byMonth: [],
  byUserPageInfo: { nextCursor: null, hasNextPage: false, limit: null },
};

const normalizeOrderSummary = (data) => {
  if (!data || typeof data !== "object") {
    return { ...defaultOrderSummary };
  }

  const totals = data.totals && typeof data.totals === "object" ? data.totals : {};
  const totalOrders = toNumber(totals.totalOrders) ?? 0;
  const totalAmount = toNumber(totals.totalAmount) ?? 0;

  const byStatus = ensureArray(data.byStatus)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "status" }))
    .filter(Boolean);
  const byPaymentStatus = ensureArray(data.byPaymentStatus)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "paymentStatus" }))
    .filter(Boolean);
  const byPaymentGateway = ensureArray(data.byPaymentGateway)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "paymentGateway" }))
    .filter(Boolean);
  const byPlan = ensureArray(data.byPlan).map(normalizePlanBreakdown).filter(Boolean);
  const byUser = ensureArray(data.byUser).map(normalizeUserBucket).filter(Boolean);
  const byYear = ensureArray(data.byYear).map(normalizeYearEntry).filter(Boolean);
  const byMonth = ensureArray(data.byMonth).map(normalizeMonthEntry).filter(Boolean);

  const byUserPageInfo = normalizePageInfo(data.byUserPageInfo);

  return {
    totals: { totalOrders, totalAmount },
    byStatus,
    byPaymentStatus,
    byPaymentGateway,
    byPlan,
    byUser,
    byYear,
    byMonth,
    byUserPageInfo,
  };
};

const normalizePaymentSummary = (data) => {
  if (!data || typeof data !== "object") {
    return { ...defaultPaymentSummary };
  }

  const totals = data.totals && typeof data.totals === "object" ? data.totals : {};
  const totalPayments = toNumber(totals.totalPayments) ?? 0;
  const totalAmount = toNumber(totals.totalAmount) ?? 0;

  const byStatus = ensureArray(data.byStatus)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "status" }))
    .filter(Boolean);
  const byGateway = ensureArray(data.byGateway)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "paymentGateway" }))
    .filter(Boolean);
  const byPurpose = ensureArray(data.byPurpose)
    .map((entry) => normalizeBreakdownEntry(entry, { keyName: "purpose" }))
    .filter(Boolean);
  const byUser = ensureArray(data.byUser).map(normalizeUserBucket).filter(Boolean);
  const byPlan = ensureArray(data.byPlan).map(normalizePlanBreakdown).filter(Boolean);
  const byYear = ensureArray(data.byYear).map(normalizeYearEntry).filter(Boolean);
  const byMonth = ensureArray(data.byMonth).map(normalizeMonthEntry).filter(Boolean);

  const byUserPageInfo = normalizePageInfo(data.byUserPageInfo);

  return {
    totals: { totalPayments, totalAmount },
    byStatus,
    byGateway,
    byPurpose,
    byUser,
    byPlan,
    byYear,
    byMonth,
    byUserPageInfo,
  };
};

const normalizeOrderListResponse = (response) => {
  const orders = ensureArray(response?.data).map(normalizeOrder).filter(Boolean);
  const pageInfo = normalizePageInfo(response?.pageInfo);
  return { orders, pageInfo };
};

export const adminOrderListInfiniteOptions = (filters = {}, { limit = 20 } = {}) => {
  const sanitized = sanitizeOrderFilters({ ...filters, limit });
  const baseFilters = { ...sanitized };
  delete baseFilters.cursor;

  return {
    queryKey: qk.admin.orders.list(baseFilters),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.pageInfo?.nextCursor ?? undefined,
    queryFn: async ({ pageParam, signal }) => {
      const params = { ...baseFilters };
      if (pageParam) {
        params.cursor = pageParam;
      }
      const query = buildQueryString(params);
      const response = await apiJSON(`${ORDER_LIST_ENDPOINT}${query}`, { signal });
      return normalizeOrderListResponse(response);
    },
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
  };
};

export const adminOrderSummaryOptions = (filters = {}, { byUserLimit } = {}) => {
  const sanitized = sanitizeOrderFilters(filters);
  const params = { ...sanitized };
  delete params.cursor;
  if (byUserLimit) {
    params.byUserLimit = byUserLimit;
  }

  return {
    queryKey: qk.admin.orders.summary(params),
    queryFn: async ({ signal }) => {
      const query = buildQueryString(params);
      const response = await apiJSON(`${ORDER_SUMMARY_ENDPOINT}${query}`, { signal });
      return normalizeOrderSummary(response?.data);
    },
    staleTime: 30_000,
  };
};

export const adminOrderTopCustomersInfiniteOptions = (
  filters = {},
  { byUserLimit, initialCursor = null } = {},
) => {
  const sanitized = sanitizeOrderFilters(filters);
  const params = { ...sanitized };
  delete params.cursor;
  if (byUserLimit) {
    params.byUserLimit = byUserLimit;
  }
  const keyParams = { ...params, initialCursor: initialCursor ?? null };

  return {
    queryKey: qk.admin.orders.summaryByUser(keyParams),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.pageInfo?.nextCursor ?? undefined,
    queryFn: async ({ pageParam, signal }) => {
      if (!pageParam) {
        return { users: [], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      const nextParams = { ...params, byUserCursor: pageParam };
      const query = buildQueryString(nextParams);
      const response = await apiJSON(`${ORDER_SUMMARY_ENDPOINT}${query}`, { signal });
      const summary = normalizeOrderSummary(response?.data);
      return { users: summary.byUser, pageInfo: summary.byUserPageInfo };
    },
  };
};

export const adminPaymentSummaryOptions = (filters = {}, { byUserLimit } = {}) => {
  const sanitized = sanitizeOrderPaymentSummaryFilters(filters);
  const params = { ...sanitized };
  if (byUserLimit) {
    params.byUserLimit = byUserLimit;
  }

  return {
    queryKey: qk.admin.orders.paymentSummary(params),
    queryFn: async ({ signal }) => {
      const query = buildQueryString(params);
      const response = await apiJSON(`${PAYMENT_SUMMARY_ENDPOINT}${query}`, { signal });
      return normalizePaymentSummary(response?.data);
    },
    staleTime: 30_000,
  };
};

export const fetchAdminOrderDetail = async (orderNumber, { signal } = {}) => {
  if (!orderNumber) {
    throw new Error("orderNumber is required to fetch order detail.");
  }
  const response = await apiJSON(ORDER_DETAIL_ENDPOINT(orderNumber), { signal });
  return normalizeOrder(response);
};

export const adminOrderDetailOptions = (orderNumber) => ({
  queryKey: qk.admin.orders.detail(orderNumber),
  queryFn: ({ signal }) => fetchAdminOrderDetail(orderNumber, { signal }),
  enabled: Boolean(orderNumber),
});

export const formatOrderSummaryData = normalizeOrderSummary;
export const formatPaymentSummaryData = normalizePaymentSummary;
