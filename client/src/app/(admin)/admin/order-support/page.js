"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import OrderSupportContent, {
  ORDER_SUPPORT_PAGE_SIZE,
  ORDER_SUPPORT_TOP_CUSTOMER_PAGE_SIZE,
  countOrderSupportActiveFilters,
  orderSupportDefaultFilters,
} from "@/components/features/admin/order-support-content";
import PageHeader from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  adminOrderListInfiniteOptions,
  adminOrderDetailOptions,
  adminOrderSummaryOptions,
  adminOrderTopCustomersInfiniteOptions,
  adminPaymentSummaryOptions,
  fetchAdminOrderDetail,
  sanitizeOrderFilters,
  sanitizeOrderPaymentSummaryFilters,
} from "@/lib/queries/admin-orders";
import { qk } from "@/lib/query-keys";

const getDefaultFilters = () => ({ ...orderSupportDefaultFilters });

export default function OrderSupportPage() {
  const [filters, setFilters] = useState(getDefaultFilters);
  const [lookupValue, setLookupValue] = useState("");
  const [investigatedOrder, setInvestigatedOrder] = useState(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);

  const queryClient = useQueryClient();

  const sanitizedOrderFilters = useMemo(() => sanitizeOrderFilters(filters), [filters]);
  const sanitizedPaymentFilters = useMemo(
    () => sanitizeOrderPaymentSummaryFilters(filters),
    [filters],
  );
  const activeFilterCount = useMemo(
    () => countOrderSupportActiveFilters(filters),
    [filters],
  );

  useEffect(() => {
    setSelectedOrderNumber(null);
  }, [sanitizedOrderFilters]);

  const summaryQueries = useQueries({
    queries: [
      {
        ...adminOrderSummaryOptions(sanitizedOrderFilters, {
          byUserLimit: ORDER_SUPPORT_TOP_CUSTOMER_PAGE_SIZE,
        }),
      },
      {
        ...adminPaymentSummaryOptions(sanitizedPaymentFilters, {
          byUserLimit: ORDER_SUPPORT_TOP_CUSTOMER_PAGE_SIZE,
        }),
      },
    ],
  });

  const [orderSummaryQuery, paymentSummaryQuery] = summaryQueries;

  const ordersQuery = useInfiniteQuery({
    ...adminOrderListInfiniteOptions(sanitizedOrderFilters, {
      limit: ORDER_SUPPORT_PAGE_SIZE,
    }),
  });

  const orderTopCustomersQuery = useInfiniteQuery({
    ...adminOrderTopCustomersInfiniteOptions(sanitizedOrderFilters, {
      byUserLimit: ORDER_SUPPORT_TOP_CUSTOMER_PAGE_SIZE,
      initialCursor: orderSummaryQuery.data?.byUserPageInfo?.nextCursor ?? null,
    }),
    enabled: Boolean(orderSummaryQuery.data?.byUserPageInfo?.hasNextPage),
  });

  const orderDetailQuery = useQuery(adminOrderDetailOptions(selectedOrderNumber));

  const orderLookupMutation = useMutation({
    mutationFn: ({ orderNumber }) => fetchAdminOrderDetail(orderNumber),
    onMutate: async ({ orderNumber }) => {
      const previous = investigatedOrder;
      setInvestigatedOrder({
        orderNumber,
        statusLabel: "Investigating",
        optimistic: true,
      });
      return { previous };
    },
    onSuccess: (data) => {
      setInvestigatedOrder(data ? { ...data, optimistic: false } : null);
    },
    onError: (error, variables, context) => {
      setInvestigatedOrder(context?.previous ?? null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.orders.root(), exact: false });
    },
  });

  const handleFilterChange = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

  const handleLookupValueChange = useCallback(
    (value) => {
      setLookupValue(value);
      if (orderLookupMutation.isError) {
        orderLookupMutation.reset();
      }
    },
    [orderLookupMutation],
  );

  const handleLookupSubmit = useCallback(() => {
    if (!lookupValue.trim()) {
      return;
    }
    orderLookupMutation.mutate({ orderNumber: lookupValue.trim() });
  }, [lookupValue, orderLookupMutation]);

  const handleClearInvestigatedOrder = useCallback(() => {
    setInvestigatedOrder(null);
    orderLookupMutation.reset();
  }, [orderLookupMutation]);

  const handleSelectOrder = useCallback((orderNumber) => {
    setSelectedOrderNumber(orderNumber);
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.admin.orders.root(), exact: false });
  }, [queryClient]);

  const activeFiltersBadge =
    activeFilterCount > 0 ? (
      <Badge variant="outline">
        {activeFilterCount} {activeFilterCount === 1 ? "active filter" : "active filters"}
      </Badge>
    ) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Order Support"
        description="Investigate customer orders, correlate payment health, and surface high-impact customers."
        actions={
          <div className="flex items-center gap-2">
            {activeFiltersBadge}
            <Button type="button" variant="outline" onClick={handleRefresh}>
              Refresh data
            </Button>
          </div>
        }
      />
      <OrderSupportContent
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        summaryQuery={orderSummaryQuery}
        paymentSummaryQuery={paymentSummaryQuery}
        ordersQuery={ordersQuery}
        orderTopCustomersQuery={orderTopCustomersQuery}
        lookupValue={lookupValue}
        onLookupValueChange={handleLookupValueChange}
        onLookupSubmit={handleLookupSubmit}
        lookupMutation={orderLookupMutation}
        investigatedOrder={investigatedOrder}
        onClearInvestigatedOrder={handleClearInvestigatedOrder}
        summaryNextCursor={orderSummaryQuery.data?.byUserPageInfo?.nextCursor ?? null}
        selectedOrderNumber={selectedOrderNumber}
        onSelectOrder={handleSelectOrder}
        orderDetailQuery={orderDetailQuery}
      />
    </div>
  );
}
