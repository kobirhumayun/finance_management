// components/LiveStats.jsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsSummaryOptions } from "@/lib/queries/analytics";

export default function LiveStats() {
  const { data, isFetching } = useQuery({
    ...analyticsSummaryOptions(),
    refetchInterval: 15_000, // poll every 15s
  });
  return <p>{isFetching ? "Updating…" : "Up to date"} — {JSON.stringify(data)}</p>;
}