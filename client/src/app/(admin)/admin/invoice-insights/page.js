"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import InvoiceInsightsContent, {
  INVOICE_INSIGHTS_PAGE_SIZE,
  INVOICE_INSIGHTS_TOP_CUSTOMER_PAGE_SIZE,
  countInvoiceInsightsActiveFilters,
  invoiceInsightsDefaultFilters,
} from "@/components/features/admin/invoice-insights-content";
import PageHeader from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  adminInvoiceDetailOptions,
  adminInvoiceListOptions,
  adminInvoiceSummaryInfiniteOptions,
  sanitizeInvoiceFilters,
} from "@/lib/queries/admin-invoices";
import { qk } from "@/lib/query-keys";

const getDefaultFilters = () => ({ ...invoiceInsightsDefaultFilters });

export default function InvoiceInsightsPage() {
  const [filters, setFilters] = useState(getDefaultFilters);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState(null);

  const sanitizedFilters = useMemo(() => sanitizeInvoiceFilters(filters), [filters]);
  const activeFilterCount = useMemo(() => countInvoiceInsightsActiveFilters(filters), [filters]);

  useEffect(() => {
    setSelectedInvoiceNumber(null);
  }, [sanitizedFilters]);

  const queryClient = useQueryClient();

  const summaryQuery = useInfiniteQuery({
    ...adminInvoiceSummaryInfiniteOptions(sanitizedFilters, {
      byUserLimit: INVOICE_INSIGHTS_TOP_CUSTOMER_PAGE_SIZE,
    }),
  });

  const invoicesQuery = useInfiniteQuery({
    ...adminInvoiceListOptions(sanitizedFilters, { limit: INVOICE_INSIGHTS_PAGE_SIZE }),
  });

  const detailQuery = useQuery({
    ...adminInvoiceDetailOptions(selectedInvoiceNumber),
    enabled: Boolean(selectedInvoiceNumber),
  });

  const handleFilterChange = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

  const handleSelectInvoice = useCallback((invoiceNumber) => {
    setSelectedInvoiceNumber(invoiceNumber);
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.admin.invoices.root(), exact: false });
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
        title="Invoice Insights"
        description="Monitor revenue trends, payment health, and customer performance across all invoices."
        actions={
          <div className="flex items-center gap-2">
            {activeFiltersBadge}
            <Button type="button" variant="outline" onClick={handleRefresh}>
              Refresh data
            </Button>
          </div>
        }
      />
      <InvoiceInsightsContent
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        summaryQuery={summaryQuery}
        invoicesQuery={invoicesQuery}
        detailQuery={detailQuery}
        selectedInvoiceNumber={selectedInvoiceNumber}
        onSelectInvoice={handleSelectInvoice}
      />
    </div>
  );
}
