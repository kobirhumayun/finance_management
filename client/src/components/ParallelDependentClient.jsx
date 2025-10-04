// components/ParallelDependentClient.jsx
"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ordersListOptions, orderByIdOptions } from "@/lib/queries/orders";
import { analyticsSummaryOptions } from "@/lib/queries/analytics";

export default function ParallelDependentClient({ firstOrderId }) {
  const [ordersRes, summaryRes] = useQueries({
    queries: [ordersListOptions({ limit: 5 }), analyticsSummaryOptions()],
  });
  const orderDetail = useQuery({
    ...orderByIdOptions(firstOrderId),
    enabled: Boolean(firstOrderId), // dependent
  });
  return <pre>{JSON.stringify({ orders: ordersRes.data, summary: summaryRes.data, detail: orderDetail.data }, null, 2)}</pre>;
}