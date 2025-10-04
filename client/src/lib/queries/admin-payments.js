// lib/queries/admin-payments.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const PAYMENT_ENDPOINT = "/api/plans/payment";
const APPROVE_ENDPOINT = "/api/plans/approve-plan";

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.payload)) return value.payload;
  if (Array.isArray(value?.payments)) return value.payments;
  if (Array.isArray(value?.rows)) return value.rows;
  if (value?.data) return ensureArray(value.data);
  if (value?.result) return ensureArray(value.result);
  if (value?.payload) return ensureArray(value.payload);
  return [];
};

const toNumber = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object") {
    if (value.$numberDecimal != null) return toNumber(value.$numberDecimal);
    if (value.$numberDouble != null) return toNumber(value.$numberDouble);
    if (value.$numberInt != null) return toNumber(value.$numberInt);
    if (value.$numberLong != null) return toNumber(value.$numberLong);
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
  }
  return null;
};

const normalizeStatus = (status) => {
  if (typeof status !== "string") return { status: null, label: "Unknown" };
  const normalized = status.trim().toLowerCase();
  if (!normalized) return { status: null, label: "Unknown" };
  const parts = normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return { status: normalized, label: parts.join(" ") || status };
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

const sanitizeFilters = (filters = {}) => {
  if (!filters || typeof filters !== "object") return {};
  const result = {};
  if (typeof filters.status === "string") {
    const trimmed = filters.status.trim().toLowerCase();
    if (trimmed && trimmed !== "all") {
      result.status = trimmed;
    }
  }
  return result;
};

const buildQueryString = (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const normalizePagination = (pagination) => {
  if (!pagination) return null;
  return {
    currentPage: pagination.currentPage ?? null,
    totalPages: pagination.totalPages ?? null,
    totalItems: pagination.totalItems ?? null,
    itemsPerPage: pagination.itemsPerPage ?? null,
  };
};

export const normalizeAdminPayment = (payment) => {
  if (!payment || typeof payment !== "object") return null;

  const id = extractId(payment) ?? `payment-${Date.now()}`;
  const userId = extractId(payment.userId);
  const planId = extractId(payment.planId);
  const amount = toNumber(payment.amount);
  const refundedAmount = toNumber(payment.refundedAmount);
  const { status, label: statusLabel } = normalizeStatus(payment.status);

  const submittedAt = extractDate(payment.createdAt) ?? extractDate(payment.processedAt);
  const updatedAt = extractDate(payment.updatedAt);

  return {
    id,
    paymentId: id,
    reference: payment.gatewayTransactionId || payment.reference || id,
    gatewayTransactionId: payment.gatewayTransactionId ?? null,
    userId,
    userName: payment.userId?.username ?? payment.userId?.name ?? null,
    userEmail: payment.userId?.email ?? null,
    planId,
    planName: payment.planId?.name ?? null,
    planSlug: payment.planId?.slug ?? null,
    amount,
    currency: payment.currency ?? null,
    refundedAmount,
    status,
    statusLabel,
    canApprove: status === "pending",
    paymentGateway: payment.paymentGateway ?? null,
    paymentMethodDetails: payment.paymentMethodDetails ?? null,
    purpose: payment.purpose ?? null,
    orderId: extractId(payment.order) ?? (typeof payment.order === "string" ? payment.order : null),
    submittedAt,
    processedAt: extractDate(payment.processedAt),
    updatedAt,
    raw: payment,
  };
};

export const adminPaymentsOptions = (filters = {}) => {
  const sanitized = sanitizeFilters(filters);
  const query = buildQueryString(sanitized);
  const queryKeyFilters = Object.keys(sanitized).length > 0 ? sanitized : { status: sanitized.status ?? "all" };

  return {
    queryKey: qk.admin.payments(queryKeyFilters),
    queryFn: async ({ signal }) => {
      const response = await apiJSON(`${PAYMENT_ENDPOINT}${query}`, { signal });
      const rawItems = ensureArray(response?.data ?? response);
      const items = rawItems.map(normalizeAdminPayment).filter(Boolean);
      const pagination = normalizePagination(response?.pagination);
      const statusSet = new Set();
      items.forEach((item) => {
        if (item?.status) statusSet.add(item.status);
      });
      if (Array.isArray(response?.availableStatuses)) {
        response.availableStatuses.forEach((item) => {
          if (typeof item === "string" && item.trim()) {
            statusSet.add(item.trim().toLowerCase());
          }
        });
      }
      if (sanitized.status) {
        statusSet.add(sanitized.status);
      }
      return {
        items,
        pagination,
        availableStatuses: Array.from(statusSet),
        raw: response,
      };
    },
    staleTime: 15_000,
  };
};

export const approveAdminPayment = ({ appliedUserId, newPlanId, paymentId }) =>
  apiJSON(APPROVE_ENDPOINT, {
    method: "POST",
    body: {
      appliedUserId,
      newPlanId,
      paymentId,
    },
  });
