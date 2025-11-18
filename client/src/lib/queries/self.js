// File: src/lib/queries/self.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const SELF_ENDPOINT = "/api/users/me";

const toNumber = (value, { fallback = 0 } = {}) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toStringSafe = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && typeof value.toString === "function") {
    return value.toString();
  }
  return String(value ?? "");
};

const extractId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "object") {
    if (typeof value.id === "string") return value.id;
    if (typeof value._id === "string") return value._id;
    if (value.id && typeof value.id.toString === "function") return value.id.toString();
    if (value._id && typeof value._id.toString === "function") return value._id.toString();
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

const normalizePlan = (plan) => {
  if (!plan || typeof plan !== "object") {
    return null;
  }

  return {
    id: plan.id ?? plan._id ?? "",
    name: plan.name ?? "",
    slug: plan.slug ?? "",
    billingCycle: plan.billingCycle ?? "",
    price: toNumber(plan.price),
    currency: plan.currency ?? "",
  };
};

const normalizeProfile = (profile) => {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const subscription = profile.subscription && typeof profile.subscription === "object"
    ? profile.subscription
    : {};

  const contact = profile.contact && typeof profile.contact === "object"
    ? profile.contact
    : {};

  const metadata = profile.metadata && typeof profile.metadata === "object"
    ? profile.metadata
    : {};

  const profileImage = profile.profileImage && typeof profile.profileImage === "object"
    ? {
        filename: profile.profileImage.filename ?? "",
        mimeType: profile.profileImage.mimeType ?? "",
        size: toNumber(profile.profileImage.size, { fallback: null }),
        width: toNumber(profile.profileImage.width, { fallback: null }),
        height: toNumber(profile.profileImage.height, { fallback: null }),
        url: profile.profileImage.url ?? "",
        uploadedAt: profile.profileImage.uploadedAt ?? null,
      }
    : null;

  return {
    id: profile.id ?? profile._id ?? "",
    username: profile.username ?? "",
    email: profile.email ?? contact.email ?? "",
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    displayName: profile.displayName ?? "",
    profilePictureUrl: profile.profilePictureUrl ?? profileImage?.url ?? "",
    profileImage,
    subscription: {
      plan: normalizePlan(subscription.plan),
      status: subscription.status ?? "",
      startDate: subscription.startDate ?? null,
      endDate: subscription.endDate ?? null,
      trialEndsAt: subscription.trialEndsAt ?? null,
      manageSubscriptionUrl: subscription.manageSubscriptionUrl ?? "/pricing",
    },
    contact: {
      email: contact.email ?? profile.email ?? "",
    },
    activityLinks: {
      orders: profile.activityLinks?.orders ?? "/api/users/me/orders",
    },
    metadata: {
      isEmailVerified: Boolean(metadata.isEmailVerified),
      lastLoginAt: metadata.lastLoginAt ?? null,
      createdAt: metadata.createdAt ?? null,
    },
  };
};

const normalizeSettings = (settings) => {
  if (!settings || typeof settings !== "object") {
    return {
      email: "",
      isEmailVerified: false,
      notifications: {},
      theme: "system",
      lastLoginAt: null,
      createdAt: null,
      authProvider: "password",
    };
  }

  const notifications = settings.notifications && typeof settings.notifications === "object"
    ? settings.notifications
    : {};

  return {
    email: settings.email ?? "",
    isEmailVerified: Boolean(settings.isEmailVerified),
    notifications,
    theme: settings.theme ?? "system",
    lastLoginAt: settings.lastLoginAt ?? null,
    createdAt: settings.createdAt ?? null,
    authProvider: settings.authProvider ?? "password",
  };
};

const normalizePreferences = (preferences) => {
  if (!preferences || typeof preferences !== "object") {
    return {
      theme: "system",
      notifications: {},
    };
  }

  const notifications = preferences.notifications && typeof preferences.notifications === "object"
    ? preferences.notifications
    : {};

  const normalizedNotifications = Object.entries(notifications).reduce((acc, [key, value]) => {
    acc[key] = Boolean(value);
    return acc;
  }, {});

  return {
    theme: preferences.theme ?? "system",
    notifications: normalizedNotifications,
  };
};

const normalizeOrder = (order) => {
  if (!order || typeof order !== "object") {
    return null;
  }

  const id = extractId(order) || toStringSafe(order.orderID) || order.id || order._id || null;
  const orderNumber = order.orderNumber ? toStringSafe(order.orderNumber) : id;

  const user = order.user && typeof order.user === "object" ? order.user : {};
  const plan = order.plan && typeof order.plan === "object" ? order.plan : {};
  const payment = order.payment && typeof order.payment === "object" ? order.payment : {};
  const invoice = order.invoice && typeof order.invoice === "object" ? order.invoice : {};

  const { status, label: statusLabel } = normalizeStatus(order.status);
  const { status: paymentStatus, label: paymentStatusLabel } = normalizeStatus(payment.status);
  const { status: invoiceStatus, label: invoiceStatusLabel } = normalizeStatus(invoice.status);

  const userFirstName = toStringSafe(user.firstName).trim() || null;
  const userLastName = toStringSafe(user.lastName).trim() || null;
  const username = toStringSafe(user.username).trim() || null;
  const userEmail = toStringSafe(user.email).trim() || null;

  const displayName =
    formatPersonName({ firstName: userFirstName, lastName: userLastName, username, userEmail }) ||
    "Unknown customer";

  const normalizedPlan = normalizePlan(plan);

  const resolvedCurrency =
    order.currency ||
    payment.currency ||
    invoice.currency ||
    normalizedPlan?.currency ||
    plan.currency;
  const currency = resolvedCurrency ? toStringSafe(resolvedCurrency) : "";

  const normalizedPayment = {
    id: extractId(payment),
    status: paymentStatus,
    statusLabel: paymentStatusLabel,
    gateway: payment.paymentGateway ? toStringSafe(payment.paymentGateway) : null,
    reference: payment.gatewayTransactionId ? toStringSafe(payment.gatewayTransactionId) : null,
    purpose: payment.purpose ? toStringSafe(payment.purpose) : null,
    amount: toNumber(payment.amount, { fallback: null }),
    currency: payment.currency ? toStringSafe(payment.currency) : null,
    refundedAmount: toNumber(payment.refundedAmount, { fallback: null }),
    processedAt: extractDate(payment.processedAt),
    createdAt: extractDate(payment.createdAt),
    updatedAt: extractDate(payment.updatedAt),
  };

  const normalizedInvoice = {
    id: extractId(invoice),
    invoiceNumber: invoice.invoiceNumber ? toStringSafe(invoice.invoiceNumber) : null,
    status: invoiceStatus,
    statusLabel: invoiceStatusLabel,
    amount: toNumber(invoice.amount, { fallback: null }),
    currency: invoice.currency ? toStringSafe(invoice.currency) : null,
    issuedDate: extractDate(invoice.issuedDate),
    dueDate: extractDate(invoice.dueDate),
    subscriptionStartDate: extractDate(invoice.subscriptionStartDate),
    subscriptionEndDate: extractDate(invoice.subscriptionEndDate),
  };

  return {
    id,
    orderId: id,
    orderNumber: orderNumber ?? "",
    status,
    statusLabel,
    amount: toNumber(order.amount ?? payment.amount ?? invoice.amount),
    currency,
    startDate: extractDate(order.startDate) ?? null,
    endDate: extractDate(order.endDate) ?? null,
    renewalDate: extractDate(order.renewalDate) ?? null,
    createdAt: extractDate(order.createdAt) ?? null,
    updatedAt: extractDate(order.updatedAt) ?? null,
    userId: extractId(user),
    userName: displayName,
    userEmail,
    username,
    planId: extractId(plan),
    planName: normalizedPlan?.name || (plan.name ? toStringSafe(plan.name) : null),
    planSlug: normalizedPlan?.slug || (plan.slug ? toStringSafe(plan.slug) : null),
    planBillingCycle:
      normalizedPlan?.billingCycle || (plan.billingCycle ? toStringSafe(plan.billingCycle) : null),
    planCurrency: normalizedPlan?.currency || (plan.currency ? toStringSafe(plan.currency) : null),
    paymentStatus,
    paymentStatusLabel,
    paymentGateway: normalizedPayment.gateway,
    paymentReference: normalizedPayment.reference,
    paymentPurpose: normalizedPayment.purpose,
    paymentAmount: normalizedPayment.amount,
    paymentCurrency: normalizedPayment.currency,
    paymentRefundedAmount: normalizedPayment.refundedAmount,
    paymentProcessedAt: normalizedPayment.processedAt,
    paymentCreatedAt: normalizedPayment.createdAt,
    paymentUpdatedAt: normalizedPayment.updatedAt,
    invoiceId: normalizedInvoice.id,
    invoiceNumber: normalizedInvoice.invoiceNumber,
    invoiceStatus,
    invoiceStatusLabel,
    invoiceAmount: normalizedInvoice.amount,
    invoiceCurrency: normalizedInvoice.currency,
    invoiceIssuedDate: normalizedInvoice.issuedDate,
    invoiceDueDate: normalizedInvoice.dueDate,
    invoiceSubscriptionStart: normalizedInvoice.subscriptionStartDate,
    invoiceSubscriptionEnd: normalizedInvoice.subscriptionEndDate,
    plan: normalizedPlan,
    payment: normalizedPayment,
    invoice: normalizedInvoice,
    raw: order,
  };
};

const mapProfileInput = (input = {}) => {
  const output = {};

  if (input.username !== undefined) {
    output.username = String(input.username).trim();
  }

  if (input.firstName !== undefined) {
    const value = String(input.firstName).trim();
    output.firstName = value === "" ? null : value;
  }

  if (input.lastName !== undefined) {
    const value = String(input.lastName).trim();
    output.lastName = value === "" ? null : value;
  }

  if (input.displayName !== undefined) {
    const value = String(input.displayName).trim();
    output.displayName = value === "" ? null : value;
  }

  return output;
};

const mapPreferencesInput = (input = {}) => {
  const output = {};

  if (input.theme !== undefined) {
    output.theme = input.theme;
  }

  if (input.notifications !== undefined) {
    const normalized = Object.entries(input.notifications || {}).reduce((acc, [key, value]) => {
      acc[key] = Boolean(value);
      return acc;
    }, {});
    output.notifications = normalized;
  }

  return output;
};

export async function fetchSelfProfile({ signal } = {}) {
  const response = await apiJSON(SELF_ENDPOINT, { method: "GET", signal });
  const profile = response?.profile ?? response?.data ?? response;
  return normalizeProfile(profile);
}

export const selfProfileQueryOptions = () => ({
  queryKey: qk.self.profile(),
  queryFn: ({ signal }) => fetchSelfProfile({ signal }),
  staleTime: 30_000,
});

export async function updateSelfProfile(input, { signal } = {}) {
  const body = mapProfileInput(input);
  const response = await apiJSON(SELF_ENDPOINT, { method: "PATCH", body, signal });
  const profile = response?.profile ?? response?.data ?? response;
  return normalizeProfile(profile);
}

export async function fetchSelfSettings({ signal } = {}) {
  const response = await apiJSON(`${SELF_ENDPOINT}/settings`, { method: "GET", signal });
  return normalizeSettings(response);
}

export const selfSettingsQueryOptions = () => ({
  queryKey: qk.self.settings(),
  queryFn: ({ signal }) => fetchSelfSettings({ signal }),
  staleTime: 30_000,
});

export async function fetchSelfPreferences({ signal } = {}) {
  const response = await apiJSON(`${SELF_ENDPOINT}/preferences`, { method: "GET", signal });
  return normalizePreferences(response);
}

export const selfPreferencesQueryOptions = () => ({
  queryKey: qk.self.preferences(),
  queryFn: ({ signal }) => fetchSelfPreferences({ signal }),
  staleTime: 30_000,
});

export async function updateSelfPreferences(input, { signal } = {}) {
  const body = mapPreferencesInput(input);
  const response = await apiJSON(`${SELF_ENDPOINT}/preferences`, { method: "PATCH", body, signal });
  const preferences = response?.preferences ?? response;
  return normalizePreferences(preferences);
}

export async function uploadProfilePicture({ file }, { signal } = {}) {
  if (!file) {
    throw new Error("file is required");
  }
  const formData = new FormData();
  formData.append("profile", file);
  const response = await apiJSON(`${SELF_ENDPOINT}/profile-picture`, {
    method: "POST",
    body: formData,
    signal,
  });
  const profile = response?.profile ?? response;
  return normalizeProfile(profile);
}

export async function deleteProfilePicture({ signal } = {}) {
  const response = await apiJSON(`${SELF_ENDPOINT}/profile-picture`, {
    method: "DELETE",
    signal,
  });
  const profile = response?.profile ?? response;
  return normalizeProfile(profile);
}

export async function updateSelfEmail(input, { signal } = {}) {
  const body = {
    newEmail: String(input?.newEmail ?? "").trim(),
    currentPassword: String(input?.currentPassword ?? ""),
  };
  return apiJSON(`${SELF_ENDPOINT}/email`, { method: "PATCH", body, signal });
}

export async function updateSelfPassword(input, { signal } = {}) {
  const body = {
    currentPassword: String(input?.currentPassword ?? ""),
    newPassword: String(input?.newPassword ?? ""),
  };
  return apiJSON(`${SELF_ENDPOINT}/password`, { method: "PATCH", body, signal });
}

export async function deleteSelfAccount(input, { signal } = {}) {
  const body = {
    currentPassword: String(input?.currentPassword ?? ""),
    reason: input?.reason ? String(input.reason) : undefined,
  };
  return apiJSON(SELF_ENDPOINT, { method: "DELETE", body, signal });
}

export async function listSelfOrders({ cursor, limit, status, signal } = {}) {
  const searchParams = new URLSearchParams();

  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  if (status) {
    searchParams.set("status", status);
  }

  const query = searchParams.toString();
  const response = await apiJSON(`${SELF_ENDPOINT}/orders${query ? `?${query}` : ""}`, {
    method: "GET",
    signal,
  });

  const orders = Array.isArray(response?.data)
    ? response.data.map(normalizeOrder).filter(Boolean)
    : [];

  const pageInfo = {
    hasNextPage: Boolean(response?.pageInfo?.hasNextPage),
    nextCursor: response?.pageInfo?.nextCursor ?? null,
    limit: response?.pageInfo?.limit ?? limit ?? 20,
  };

  return { orders, pageInfo };
}

export const selfOrdersInfiniteQueryOptions = (filters = {}) => ({
  queryKey: qk.self.orders.list(filters),
  queryFn: ({ pageParam, signal }) =>
    listSelfOrders({ ...filters, cursor: pageParam ?? undefined, signal }),
  initialPageParam: null,
  getNextPageParam: (lastPage) =>
    lastPage?.pageInfo?.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
});
