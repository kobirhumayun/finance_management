// lib/queries/admin-plans.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const PLAN_ENDPOINT = "/api/plans/plan";

const extractDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "$date" in value) return value.$date;
  return null;
};

const toNumber = (value) => {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeAdminPlan = (plan) => {
  if (!plan) return null;
  const fallbackId = typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : null;
  const id = plan?._id?.$oid ?? plan?._id ?? plan?.id ?? plan?.slug ?? fallbackId ?? `plan-${Date.now()}`;
  const features = Array.isArray(plan?.features)
    ? plan.features.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    id,
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    description: plan?.description ?? "",
    price: toNumber(plan?.price),
    billingCycle: plan?.billingCycle ?? "",
    features,
    isPublic: Boolean(plan?.isPublic),
    currency: plan?.currency ?? null,
    displayOrder: plan?.displayOrder ?? null,
    createdAt: extractDate(plan?.createdAt),
    updatedAt: extractDate(plan?.updatedAt),
  };
};

const ensureArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.plans)) return data.plans;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (data?.data) return ensureArray(data.data);
  if (data?.result) return ensureArray(data.result);
  if (data?.payload) return ensureArray(data.payload);
  return [];
};

export const adminPlansOptions = () => ({
  queryKey: qk.admin.plans(),
  queryFn: async ({ signal }) => {
    const response = await apiJSON(PLAN_ENDPOINT, { signal });
    return ensureArray(response).map(normalizeAdminPlan);
  },
});

export const createAdminPlan = (payload) =>
  apiJSON(PLAN_ENDPOINT, {
    method: "POST",
    body: payload,
  });

export const updateAdminPlan = (payload) =>
  apiJSON(PLAN_ENDPOINT, {
    method: "PUT",
    body: payload,
  });

export const deleteAdminPlan = ({ slug }) =>
  apiJSON(PLAN_ENDPOINT, {
    method: "DELETE",
    body: { slug },
  });
