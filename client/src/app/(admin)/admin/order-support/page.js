"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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
  adminOrderDetailOptions,
  adminOrderListOptions,
  adminOrderPaymentSummaryInfiniteOptions,
  adminOrderSummaryInfiniteOptions,
  sanitizeOrderFilters,
} from "@/lib/queries/admin-orders";
import { qk } from "@/lib/query-keys";

const getDefaultFilters = () => ({ ...orderSupportDefaultFilters });

export default function OrderSupportPage() {
  const [filters, setFilters] = useState(getDefaultFilters);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);

  const sanitizedFilters = useMemo(() => sanitizeOrderFilters(filters), [filters]);
  const activeFilterCount = useMemo(() => countOrderSupportActiveFilters(filters), [filters]);

  useEffect(() => {
    setSelectedOrderNumber(null);
  }, [sanitizedFilters]);

  const queryClient = useQueryClient();

  const summaryQuery = useInfiniteQuery({
    ...adminOrderSummaryInfiniteOptions(sanitizedFilters, {
      byUserLimit: ORDER_SUPPORT_TOP_CUSTOMER_PAGE_SIZE,
    }),
  });

  const paymentSummaryQuery = useInfiniteQuery({
    ...adminOrderPaymentSummaryInfiniteOptions(sanitizedFilters, {
      byUserLimit: ORDER_SUPPORT_TOP_CUSTOMER_PAGE_SIZE,
    }),
  });

  const ordersQuery = useInfiniteQuery({
    ...adminOrderListOptions(sanitizedFilters, { limit: ORDER_SUPPORT_PAGE_SIZE }),
  });

  const detailQuery = useQuery({
    ...adminOrderDetailOptions(selectedOrderNumber),
    enabled: Boolean(selectedOrderNumber),
  });

  const handleFilterChange = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

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
        description="Monitor order health, related payments, and downstream invoices in one place."
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
        ordersQuery={ordersQuery}
        summaryQuery={summaryQuery}
        paymentSummaryQuery={paymentSummaryQuery}
        detailQuery={detailQuery}
        selectedOrderNumber={selectedOrderNumber}
        onSelectOrder={handleSelectOrder}
      />
    </div>
  );
}
