// File: src/lib/queries/self.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const SELF_ENDPOINT = "/api/users/me";

const toNumber = (value, { fallback = 0 } = {}) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

  return {
    id: profile.id ?? profile._id ?? "",
    username: profile.username ?? "",
    email: profile.email ?? contact.email ?? "",
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    displayName: profile.displayName ?? "",
    profilePictureUrl: profile.profilePictureUrl ?? "",
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

  return {
    id: order.id ?? order._id ?? "",
    orderNumber: order.orderNumber ?? "",
    status: order.status ?? "",
    amount: toNumber(order.amount),
    currency: order.currency ?? order.plan?.currency ?? order.payment?.currency ?? "",
    startDate: order.startDate ?? null,
    endDate: order.endDate ?? null,
    renewalDate: order.renewalDate ?? null,
    createdAt: order.createdAt ?? null,
    updatedAt: order.updatedAt ?? null,
    plan: normalizePlan(order.plan),
    payment: order.payment ?? null,
    invoice: order.invoice ?? null,
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

  if (input.profilePictureUrl !== undefined) {
    const value = String(input.profilePictureUrl).trim();
    output.profilePictureUrl = value === "" ? null : value;
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
  return normalizePreferences(response);
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
