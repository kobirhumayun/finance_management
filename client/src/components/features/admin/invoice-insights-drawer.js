"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import InvoiceInsightsContent, {
  INVOICE_INSIGHTS_PAGE_SIZE,
  INVOICE_INSIGHTS_TOP_CUSTOMER_PAGE_SIZE,
  countInvoiceInsightsActiveFilters,
  invoiceInsightsDefaultFilters,
} from "@/components/features/admin/invoice-insights-content";
import {
  adminInvoiceDetailOptions,
  adminInvoiceListOptions,
  adminInvoiceSummaryInfiniteOptions,
  sanitizeInvoiceFilters,
} from "@/lib/queries/admin-invoices";
import { qk } from "@/lib/query-keys";

const getDefaultFilters = () => ({ ...invoiceInsightsDefaultFilters });

export default function InvoiceInsightsDrawer() {
  const [open, setOpen] = useState(false);
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
    enabled: open,
  });

  const invoicesQuery = useInfiniteQuery({
    ...adminInvoiceListOptions(sanitizedFilters, { limit: INVOICE_INSIGHTS_PAGE_SIZE }),
    enabled: open,
  });

  const detailQuery = useQuery({
    ...adminInvoiceDetailOptions(selectedInvoiceNumber),
    enabled: open && Boolean(selectedInvoiceNumber),
  });

  const handleFilterChange = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

  const handleOpenChange = useCallback((nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedInvoiceNumber(null);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.admin.invoices.root(), exact: false });
  }, [queryClient]);

  const handleSelectInvoice = useCallback((invoiceNumber) => {
    setSelectedInvoiceNumber(invoiceNumber);
  }, []);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline">
          Invoice Insights
          {activeFilterCount > 0 ? (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex h-full w-full max-w-3xl flex-col gap-0 sm:max-w-xl md:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>Invoice Insights Drawer</SheetTitle>
          <SheetDescription>
            Monitor invoice performance, payment health, and customer concentration without leaving the dashboard.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
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
        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Data refreshes automatically with filter changes. Use refresh to revalidate cached results.
            </p>
            <Button type="button" variant="secondary" onClick={handleRefresh} disabled={!open}>
              Refresh data
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
