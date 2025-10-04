// lib/queries/admin-users.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const ADMIN_USERS_ENDPOINT = "/api/admin/users";

const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.payload)) return value.payload;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.users)) return value.users;
  if (value?.items) return ensureArray(value.items);
  if (value?.data) return ensureArray(value.data);
  if (value?.results) return ensureArray(value.results);
  return [];
};

const extractId = (value) => {
  if (!value) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value.$oid) return extractId(value.$oid);
    if (value._id) return extractId(value._id);
    if (value.id) return extractId(value.id);
  }
  return null;
};

const toStringSafe = (value) => {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
};

const normalizeBoolean = (value) => {
  if (value === true || value === false) return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "active", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive", "disabled"].includes(normalized)) return false;
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

const formatDate = (value) => {
  const iso = extractDate(value);
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
};

const formatDateTime = (value) => {
  const iso = extractDate(value);
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
};

const formatStatusLabel = (status) => {
  const value = toStringSafe(status)?.trim();
  if (!value) return null;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const normalizeAdminUser = (user) => {
  if (!user || typeof user !== "object") return null;

  const raw = user.raw && typeof user.raw === "object" ? user.raw : user;
  const merged = { ...raw, ...user };

  const id = extractId(merged.id ?? merged._id);
  const username = toStringSafe(merged.username)?.trim() || null;
  const email = toStringSafe(merged.email)?.trim() || null;
  const firstName = toStringSafe(merged.firstName)?.trim() || null;
  const lastName = toStringSafe(merged.lastName)?.trim() || null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

  const planId = extractId(merged.planId) || toStringSafe(merged.planId);
  const planName =
    toStringSafe(merged.plan?.name) ||
    toStringSafe(merged.planName) ||
    toStringSafe(merged.plan) ||
    (typeof merged.planId === "object" ? toStringSafe(merged.planId?.name) : null);
  const planSlug =
    toStringSafe(merged.plan?.slug) ||
    toStringSafe(merged.planSlug) ||
    (typeof merged.planId === "object" ? toStringSafe(merged.planId?.slug) : null) ||
    (typeof planId === "string" && planId.includes("-") ? planId : null);

  const subscriptionStatus = toStringSafe(merged.subscriptionStatus)?.trim() || null;
  const subscriptionStatusLabel = formatStatusLabel(subscriptionStatus);
  const subscriptionStartDate = extractDate(merged.subscriptionStartDate);
  const subscriptionEndDate = extractDate(merged.subscriptionEndDate);
  const trialEndsAt = extractDate(merged.trialEndsAt);

  const role = toStringSafe(merged.role)?.trim() || null;
  const isActive = normalizeBoolean(merged.isActive ?? merged.metadata?.isActive ?? merged.raw?.isActive);

  const statusCode =
    toStringSafe(merged.statusCode ?? merged.metadata?.accountStatus ?? merged.status)?.trim() ||
    (isActive === false ? "inactive" : isActive === true ? "active" : null);
  const statusLabel = formatStatusLabel(statusCode) || formatStatusLabel(merged.status);

  const registeredAt = extractDate(merged.registeredAt ?? merged.createdAt);
  const lastLoginAt = extractDate(merged.lastLoginAt ?? merged.updatedAt);

  const profilePictureUrl = toStringSafe(merged.profilePictureUrl ?? merged.avatarUrl) || null;

  return {
    id,
    username,
    email,
    firstName,
    lastName,
    fullName,
    planId,
    planSlug,
    planName,
    plan: planName,
    subscriptionStatus,
    subscriptionStatusLabel,
    subscriptionStartDate,
    subscriptionStartDateLabel: formatDate(subscriptionStartDate),
    subscriptionEndDate,
    subscriptionEndDateLabel: formatDate(subscriptionEndDate),
    trialEndsAt,
    trialEndsAtLabel: formatDate(trialEndsAt),
    role,
    isActive: isActive ?? false,
    isActiveLabel: isActive == null ? null : isActive ? "Active" : "Inactive",
    statusCode,
    status: statusLabel,
    statusLabel,
    registeredAt,
    registeredAtLabel: formatDate(registeredAt),
    registeredAtDateTimeLabel: formatDateTime(registeredAt),
    lastLoginAt,
    lastLoginAtLabel: formatDateTime(lastLoginAt),
    profilePictureUrl,
    raw,
  };
};

export const mergeAdminUser = (previous, patch = {}) => {
  if (!previous) {
    const raw = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
    return normalizeAdminUser({ ...raw, raw });
  }
  const prevRaw = previous.raw && typeof previous.raw === "object" ? previous.raw : previous;
  const mergedRaw = { ...prevRaw, ...patch };
  if (previous.id && !mergedRaw.id) mergedRaw.id = previous.id;
  if (previous.username && !mergedRaw.username) mergedRaw.username = previous.username;
  if (previous.email && !mergedRaw.email) mergedRaw.email = previous.email;
  return normalizeAdminUser({ ...mergedRaw, raw: mergedRaw });
};

const sanitizeListFilters = (filters = {}) => {
  if (!filters || typeof filters !== "object") return {};
  const result = {};
  if (typeof filters.search === "string" && filters.search.trim()) {
    result.search = filters.search.trim();
  }
  if (typeof filters.status === "string" && filters.status.trim() && filters.status.trim().toLowerCase() !== "all") {
    result.status = filters.status.trim();
  }
  if (filters.page != null) {
    const page = Number(filters.page);
    if (Number.isFinite(page) && page > 0) {
      result.page = page;
    }
  }
  if (filters.limit != null) {
    const limit = Number(filters.limit);
    if (Number.isFinite(limit) && limit > 0) {
      result.limit = limit;
    }
  }
  return result;
};

const buildQueryString = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === "") return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const normalizePagination = (pagination) => {
  if (!pagination || typeof pagination !== "object") return null;
  return {
    currentPage: pagination.currentPage ?? null,
    totalPages: pagination.totalPages ?? null,
    totalItems: pagination.totalItems ?? null,
    itemsPerPage: pagination.itemsPerPage ?? null,
  };
};

export const adminUsersOptions = (filters = {}) => {
  const sanitized = sanitizeListFilters(filters);
  const query = buildQueryString(sanitized);
  const keyArg = Object.keys(sanitized).length ? sanitized : undefined;

  return {
    queryKey: qk.admin.users(keyArg),
    queryFn: async ({ signal }) => {
      const response = await apiJSON(`${ADMIN_USERS_ENDPOINT}${query}`, { signal });
      const rawItems = ensureArray(response?.items ?? response?.data ?? response);
      const items = rawItems.map((item) => normalizeAdminUser({ ...item, raw: item })).filter(Boolean);
      const pagination = normalizePagination(response?.pagination);
      const statusSet = new Set();
      (response?.availableStatuses ?? []).forEach((status) => {
        const str = toStringSafe(status)?.trim();
        if (str) statusSet.add(str);
      });
      items.forEach((item) => {
        if (item?.statusCode) statusSet.add(item.statusCode);
      });
      return {
        items,
        pagination,
        availableStatuses: Array.from(statusSet),
        raw: response,
      };
    },
    staleTime: 30_000,
  };
};

export const adminUserProfileOptions = (userId) => ({
  queryKey: qk.admin.userProfile(userId),
  queryFn: async ({ signal }) => {
    if (!userId) throw new Error("User ID is required");
    const response = await apiJSON(`${ADMIN_USERS_ENDPOINT}/${userId}`, { signal });
    return normalizeAdminUser({ ...response, raw: response });
  },
  enabled: Boolean(userId),
  staleTime: 30_000,
});

export const updateAdminUser = ({ userId, updates }) => {
  if (!userId) throw new Error("User ID is required for update");
  if (!updates || typeof updates !== "object") throw new Error("Update payload is required");
  return apiJSON(`${ADMIN_USERS_ENDPOINT}/${userId}`, {
    method: "PATCH",
    body: updates,
  });
};

export const createAdminUser = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Create payload is required");
  }
  return apiJSON(ADMIN_USERS_ENDPOINT, {
    method: "POST",
    body: payload,
  });
};

export const updateAdminUserStatus = ({ userId, status }) => {
  if (!userId) throw new Error("User ID is required for status update");
  if (!status) throw new Error("Status value is required");
  return apiJSON(`${ADMIN_USERS_ENDPOINT}/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
};

export const resetAdminUserPassword = ({ userId, redirectUri }) => {
  if (!userId) throw new Error("User ID is required to reset password");
  const payload = redirectUri ? { redirectUri } : undefined;
  return apiJSON(`${ADMIN_USERS_ENDPOINT}/${userId}/reset-password`, {
    method: "POST",
    ...(payload ? { body: payload } : {}),
  });
};

export const formatAdminUserStatus = formatStatusLabel;
export const formatAdminUserDate = formatDate;
export const formatAdminUserDateTime = formatDateTime;
