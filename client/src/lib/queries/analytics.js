// lib/queries/analytics.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export const analyticsSummaryOptions = () => ({
  queryKey: qk.analytics.summary(),
  queryFn: ({ signal }) => apiJSON(`/api/auth/user-info`, { signal }),
  staleTime: 60_000,
});

export const slowReportOptions = () => ({
  queryKey: qk.analytics.slowReport(),
  queryFn: ({ signal }) => apiJSON(`/api/plans/my-plan`, { signal }),
  staleTime: 300_000,
});