// File: src/lib/plans.js
import { apiJSON } from "@/lib/api";

export async function fetchPublicPlans() {
  return apiJSON("/api/plans/public-plans", { method: "GET" });
}

export async function fetchMyPlan({ signal } = {}) {
  return apiJSON("/api/plans/my-plan", { method: "GET", signal });
}

export async function createPlanOrder(input) {
  return apiJSON("/api/plans/order", { method: "POST", body: input });
}

export async function submitManualPayment(input) {
  return apiJSON("/api/plans/manual-payment", { method: "POST", body: input });
}
