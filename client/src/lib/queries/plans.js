// File: src/lib/queries/plans.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export const myPlanQueryOptions = () => ({
  queryKey: qk.plans.current(),
  queryFn: ({ signal }) => apiJSON("/api/plans/my-plan", { method: "GET", signal }),
  staleTime: 60_000,
});
