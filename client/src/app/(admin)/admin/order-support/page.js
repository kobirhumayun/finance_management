"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import OrderSupportContent, {
  ORDER_SUPPORT_DEFAULT_FILTERS,
} from "@/components/features/admin/order-support/order-support-content";
import useDebouncedValue from "@/hooks/use-debounced-value";
import {
  adminOrderDetailOptions,
  adminOrderListInfiniteOptions,
  adminOrderPaymentSummaryInfiniteOptions,
  adminOrderSummaryInfiniteOptions,
  sanitizeOrderFilters,
} from "@/lib/queries/admin-orders";
import { qk } from "@/lib/query-keys";

const ORDER_PAGE_SIZE = 20;
const SUMMARY_CUSTOMER_PAGE_SIZE = 8;

const cloneFlaggedSet = (set) => new Set(set);

export default function OrderSupportPage() {
  const [filters, setFilters] = useState(ORDER_SUPPORT_DEFAULT_FILTERS);
  const [lookupValue, setLookupValue] = useState("");
  const [flaggedOrders, setFlaggedOrders] = useState(() => new Set());

  const debouncedLookup = useDebouncedValue(lookupValue, 400);
  const normalizedLookup = debouncedLookup.trim();

  const sanitizedFilters = useMemo(() => sanitizeOrderFilters(filters), [filters]);

  const orderListOptions = useMemo(
    () => adminOrderListInfiniteOptions(sanitizedFilters, { limit: ORDER_PAGE_SIZE }),
    [sanitizedFilters],
  );

  const ordersQuery = useInfiniteQuery(orderListOptions);

  const canRunSummaries = ordersQuery.fetchStatus !== "idle";

  const orderSummaryOptions = useMemo(
    () => adminOrderSummaryInfiniteOptions(sanitizedFilters, { byUserLimit: SUMMARY_CUSTOMER_PAGE_SIZE }),
    [sanitizedFilters],
  );

  const paymentSummaryOptions = useMemo(
    () => adminOrderPaymentSummaryInfiniteOptions(sanitizedFilters, { byUserLimit: SUMMARY_CUSTOMER_PAGE_SIZE }),
    [sanitizedFilters],
  );

  const [orderSummaryQuery, paymentSummaryQuery] = useQueries({
    queries: [
      { ...orderSummaryOptions, enabled: canRunSummaries },
      { ...paymentSummaryOptions, enabled: canRunSummaries },
    ],
  });

  const orderDetailOptions = useMemo(() => adminOrderDetailOptions(normalizedLookup), [normalizedLookup]);
  const orderLookupQuery = useQuery(orderDetailOptions);

  const queryClient = useQueryClient();

  // Keep flagged state aligned with cached pages whenever the set changes.
  useEffect(() => {
    queryClient.setQueryData(orderListOptions.queryKey, (existing) => {
      if (!existing) return existing;
      const pages = existing.pages.map((page) => ({
        ...page,
        nodes: page.nodes.map((node) => ({
          ...node,
          isFlagged: flaggedOrders.has(node.id),
        })),
      }));
      return { ...existing, pages };
    });
  }, [flaggedOrders, orderListOptions.queryKey, queryClient]);

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ orderId, nextFlagged }) => {
      // Simulate latency to keep optimistic update realistic.
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { orderId, nextFlagged };
    },
    onMutate: async ({ orderId, nextFlagged }) => {
      await queryClient.cancelQueries({ queryKey: orderListOptions.queryKey, exact: true });
      const previousList = queryClient.getQueryData(orderListOptions.queryKey);
      const previousFlagged = cloneFlaggedSet(flaggedOrders);

      setFlaggedOrders((prev) => {
        const next = cloneFlaggedSet(prev);
        if (nextFlagged) next.add(orderId);
        else next.delete(orderId);
        return next;
      });

      queryClient.setQueryData(orderListOptions.queryKey, (current) => {
        if (!current) return current;
        const pages = current.pages.map((page) => ({
          ...page,
          nodes: page.nodes.map((node) =>
            node.id === orderId ? { ...node, isFlagged: nextFlagged } : node,
          ),
        }));
        return { ...current, pages };
      });

      return { previousList, previousFlagged };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(orderListOptions.queryKey, context.previousList);
      }
      if (context?.previousFlagged) {
        setFlaggedOrders(context.previousFlagged);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.orders.root(), exact: false });
    },
  });

  const handleFilterChange = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(ORDER_SUPPORT_DEFAULT_FILTERS);
  }, []);

  const handleLookupChange = useCallback((value) => {
    setLookupValue(value);
  }, []);

  const handleLookupSubmit = useCallback(() => {
    orderLookupQuery.refetch();
  }, [orderLookupQuery]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.admin.orders.root(), exact: false });
  }, [queryClient]);

  const handleToggleFlag = useCallback(
    (orderId, isCurrentlyFlagged) => {
      toggleFlagMutation.mutate({ orderId, nextFlagged: !isCurrentlyFlagged });
    },
    [toggleFlagMutation],
  );

  return (
    <OrderSupportContent
      filters={filters}
      onFilterChange={handleFilterChange}
      onResetFilters={handleResetFilters}
      ordersQuery={ordersQuery}
      orderSummaryQuery={orderSummaryQuery}
      paymentSummaryQuery={paymentSummaryQuery}
      lookupValue={lookupValue}
      onLookupValueChange={handleLookupChange}
      onLookupSubmit={handleLookupSubmit}
      lookupQuery={orderLookupQuery}
      onRefresh={handleRefresh}
      flaggedOrders={flaggedOrders}
      onToggleFlag={handleToggleFlag}
      toggleMutationPending={toggleFlagMutation.isPending}
    />
  );
}
