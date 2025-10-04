// lib/queries/orders.js
import { apiJSON } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export const ordersListOptions = ({ limit = 5 } = {}) => ({
  queryKey: qk.orders.list({ limit }),
  queryFn: ({ signal }) => apiJSON(`/orders?limit=${limit}`, { signal }),
  staleTime: 30_000,
});
export const orderByIdOptions = (id) => ({
  queryKey: qk.orders.byId(id),
  queryFn: ({ signal }) => apiJSON(`/orders/${id}`, { signal }),
});