"use client";

import { useCallback, useMemo, useState } from "react";
import PageHeader from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ORDER_SUPPORT_DEFAULT_FILTERS,
  formatOrderCount,
  formatOrderCurrency,
  sanitizeOrderFilters,
} from "@/lib/queries/admin-orders";
import { cn } from "@/lib/utils";

const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "All order statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "All payment statuses" },
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "requires_action", label: "Requires action" },
  { value: "canceled", label: "Canceled" },
];

const FALLBACK_LABEL = "Unknown";

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return date.toLocaleString();
  }
};

const countActiveFilters = (filters) => {
  const sanitized = sanitizeOrderFilters(filters);
  return Object.keys(sanitized).length;
};

const FiltersSection = ({ filters, onChange, onReset }) => {
  const handleInputChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      onChange(name, value);
    },
    [onChange],
  );

  const handleSelectChange = useCallback(
    (name) => (value) => {
      onChange(name, value);
    },
    [onChange],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>
          Narrow down investigations by order lifecycle, customer identity, billing context, and payment gateway details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="order-filter-number">Order number</Label>
            <Input
              id="order-filter-number"
              name="orderNumber"
              value={filters.orderNumber}
              onChange={handleInputChange}
              placeholder="000123"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-status">Order status</Label>
            <Select value={filters.status} onValueChange={handleSelectChange("status")}>
              <SelectTrigger id="order-filter-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-email">Customer email</Label>
            <Input
              id="order-filter-email"
              name="userEmail"
              value={filters.userEmail}
              onChange={handleInputChange}
              placeholder="customer@example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-user">User ID</Label>
            <Input
              id="order-filter-user"
              name="userId"
              value={filters.userId}
              onChange={handleInputChange}
              placeholder="Mongo/ObjectId"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-plan-slug">Plan slug</Label>
            <Input
              id="order-filter-plan-slug"
              name="planSlug"
              value={filters.planSlug}
              onChange={handleInputChange}
              placeholder="pro-annual"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-plan-id">Plan ID</Label>
            <Input
              id="order-filter-plan-id"
              name="planId"
              value={filters.planId}
              onChange={handleInputChange}
              placeholder="507f1f77bcf86cd799439011"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-payment-status">Payment status</Label>
            <Select value={filters.paymentStatus} onValueChange={handleSelectChange("paymentStatus")}>
              <SelectTrigger id="order-filter-payment-status">
                <SelectValue placeholder="Select payment status" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-gateway">Payment gateway</Label>
            <Input
              id="order-filter-gateway"
              name="paymentGateway"
              value={filters.paymentGateway}
              onChange={handleInputChange}
              placeholder="stripe"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-transaction">Gateway transaction ID</Label>
            <Input
              id="order-filter-transaction"
              name="gatewayTransactionId"
              value={filters.gatewayTransactionId}
              onChange={handleInputChange}
              placeholder="pi_3NHM6e..."
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-invoice">Invoice number</Label>
            <Input
              id="order-filter-invoice"
              name="invoiceNumber"
              value={filters.invoiceNumber}
              onChange={handleInputChange}
              placeholder="INV-2024-00015"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-start">Start date</Label>
            <Input
              id="order-filter-start"
              name="startDate"
              type="date"
              value={filters.startDate}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-end">End date</Label>
            <Input
              id="order-filter-end"
              name="endDate"
              type="date"
              value={filters.endDate}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={onReset}>
            Reset filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const formatMonthLabel = ({ year, month }) => {
  if (!year || !month) return FALLBACK_LABEL;
  const safeMonth = Math.max(1, Math.min(12, month));
  const date = new Date(Date.UTC(year, safeMonth - 1, 1));
  try {
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return `${year}-${String(safeMonth).padStart(2, "0")}`;
  }
};

const BreakdownTable = ({
  title,
  description,
  rows,
  emptyLabel = "No data",
  valueFormatter = (row) => formatOrderCurrency(row.totalAmount, "BDT"),
  valueHeader = "Amount",
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">{valueHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key ?? row.label}>
                  <TableCell>{row.label ?? FALLBACK_LABEL}</TableCell>
                  <TableCell className="text-right">{formatOrderCount(row.count)}</TableCell>
                  <TableCell className="text-right">{valueFormatter(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

const SummarySection = ({
  title,
  totalsLabel,
  totals,
  breakdowns,
  byUser,
  onLoadMore,
  hasMore,
  isLoading,
}) => {
  const breakdownCards = [
    {
      key: "status",
      title: "By status",
      rows: breakdowns.byStatus,
      emptyLabel: "No status breakdown available",
    },
    {
      key: "payment-status",
      title: "By payment status",
      rows: breakdowns.byPaymentStatus || breakdowns.byStatus || [],
      emptyLabel: "No payment breakdown available",
    },
    {
      key: "gateway",
      title: "By payment gateway",
      rows: breakdowns.byPaymentGateway || breakdowns.byGateway || [],
      emptyLabel: "No gateway breakdown available",
    },
    {
      key: "plan",
      title: "By plan",
      rows: breakdowns.byPlan,
      emptyLabel: "No plan breakdown available",
    },
    {
      key: "year",
      title: "By year",
      rows: breakdowns.byYear,
      emptyLabel: "No yearly breakdown available",
    },
    {
      key: "month",
      title: "By month",
      rows: breakdowns.byMonth?.map((row) => ({
        ...row,
        label: formatMonthLabel(row),
      })),
      emptyLabel: "No monthly breakdown available",
    },
  ].filter(Boolean);

  const formattedTotalAmount = formatOrderCurrency(totals.totalAmount, "BDT");
  const formattedTotalCount = formatOrderCount(totals.totalOrders ?? totals.totalPayments ?? 0);

  return (
    <section className="space-y-4" aria-label={`${title} summary`}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {totalsLabel}: <span className="font-medium text-foreground">{formattedTotalAmount}</span>
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Total records: <span className="font-medium text-foreground">{formattedTotalCount}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {breakdownCards.map((card) => (
          <BreakdownTable key={card.key} title={card.title} rows={card.rows ?? []} emptyLabel={card.emptyLabel} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top customers</CardTitle>
          <CardDescription>Accounts contributing the highest {title.toLowerCase()} volume.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {byUser.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customer data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byUser.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.fullName}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.email || row.username || FALLBACK_LABEL}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatOrderCount(row.count)}</TableCell>
                      <TableCell className="text-right">{formatOrderCurrency(row.totalAmount, "BDT")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" disabled={!hasMore || isLoading} onClick={onLoadMore}>
              {isLoading ? "Loading..." : hasMore ? "Load more" : "All customers loaded"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

const OrdersTable = ({
  orders,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onToggleFlag,
  mutationPending,
  flaggedSet,
}) => {
  const [sortAscending, setSortAscending] = useState(false);

  const sortedOrders = useMemo(() => {
    if (!orders.length) return orders;
    const next = [...orders];
    next.sort((a, b) => {
      const left = a.createdAt ?? "";
      const right = b.createdAt ?? "";
      if (left === right) return 0;
      return sortAscending ? left.localeCompare(right) : right.localeCompare(left);
    });
    return next;
  }, [orders, sortAscending]);

  const toggleSortDirection = useCallback(() => {
    setSortAscending((prev) => !prev);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Order investigations</CardTitle>
            <CardDescription>Use the filters above to refine the orders that require follow-up.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={toggleSortDirection}>
            Sort by created date {sortAscending ? "↑" : "↓"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        ) : sortedOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders match the selected criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.map((order) => {
                  const isFlagged = flaggedSet.has(order.id);
                  return (
                    <TableRow
                      key={order.id}
                      className={cn(isFlagged && "border-l-4 border-l-primary/60 bg-primary/5")}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.orderNumber}</span>
                          <span className="text-xs text-muted-foreground">{order.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.user.fullName || order.user.username || FALLBACK_LABEL}</span>
                          <span className="text-xs text-muted-foreground">{order.user.email || FALLBACK_LABEL}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.plan.planName || FALLBACK_LABEL}</span>
                          <span className="text-xs text-muted-foreground">{order.plan.planSlug || order.plan.planId || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status === "active" ? "default" : "outline"}>{order.statusLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.payment.statusLabel}</span>
                          <span className="text-xs text-muted-foreground">{order.payment.paymentGateway || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.invoice.invoiceNumber || "—"}</span>
                          <span className="text-xs text-muted-foreground">{order.invoice.statusLabel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatOrderCurrency(order.amount ?? order.payment.amount, order.currency || order.payment.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{formatDateTime(order.createdAt)}</span>
                          <span className="text-xs text-muted-foreground">Updated {formatDateTime(order.updatedAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant={isFlagged ? "default" : "outline"}
                          onClick={() => onToggleFlag(order.id, isFlagged)}
                          disabled={mutationPending}
                        >
                          {isFlagged ? "Unflag" : "Flag"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={onLoadMore} disabled={!hasNextPage || isFetchingNextPage}>
            {isFetchingNextPage ? "Loading more..." : hasNextPage ? "Load more" : "No more results"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const LookupCard = ({
  lookupValue,
  onLookupChange,
  onSubmit,
  lookupQuery,
}) => {
  const { data, isFetching, isError, error, isSuccess } = lookupQuery;

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      onSubmit();
    },
    [onSubmit],
  );

  let feedback = null;
  if (!lookupValue.trim()) {
    feedback = <p className="text-sm text-muted-foreground">Enter an order number to investigate a specific case.</p>;
  } else if (isFetching) {
    feedback = <p className="text-sm text-muted-foreground">Searching for order...</p>;
  } else if (isError) {
    const status = error?.status;
    feedback = (
      <p className="text-sm text-destructive">
        {status === 404 ? "No order found with that number." : "Unable to retrieve order details."}
      </p>
    );
  } else if (isSuccess && !data) {
    feedback = <p className="text-sm text-muted-foreground">No order details available.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investigate by order number</CardTitle>
        <CardDescription>Quickly pull up a specific order, invoice, and payment record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <Input
            value={lookupValue}
            onChange={(event) => onLookupChange(event.target.value)}
            placeholder="Type an order ID or Mongo ObjectId"
            autoComplete="off"
          />
          <Button type="submit" disabled={!lookupValue.trim()}>
            Search
          </Button>
        </form>

        {feedback}

        {data ? (
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Order number</p>
                <p className="text-base font-semibold">{data.orderNumber}</p>
              </div>
              <Badge variant={data.status === "active" ? "default" : "outline"}>{data.statusLabel}</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Customer</p>
                <p className="font-medium">{data.user.fullName || data.user.username || FALLBACK_LABEL}</p>
                <p className="text-xs text-muted-foreground">{data.user.email || FALLBACK_LABEL}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Plan</p>
                <p className="font-medium">{data.plan.planName || FALLBACK_LABEL}</p>
                <p className="text-xs text-muted-foreground">{data.plan.planSlug || data.plan.planId || "—"}</p>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Payment</p>
                <p className="font-medium">{data.payment.statusLabel}</p>
                <p className="text-xs text-muted-foreground">{data.payment.paymentGateway || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Invoice</p>
                <p className="font-medium">{data.invoice.invoiceNumber || "—"}</p>
                <p className="text-xs text-muted-foreground">{data.invoice.statusLabel}</p>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Amount</p>
                <p className="font-medium">
                  {formatOrderCurrency(data.amount ?? data.payment.amount, data.currency || data.payment.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Created</p>
                <p className="font-medium">{formatDateTime(data.createdAt)}</p>
                <p className="text-xs text-muted-foreground">Updated {formatDateTime(data.updatedAt)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default function OrderSupportContent({
  filters,
  onFilterChange,
  onResetFilters,
  ordersQuery,
  orderSummaryQuery,
  paymentSummaryQuery,
  lookupValue,
  onLookupValueChange,
  onLookupSubmit,
  lookupQuery,
  onRefresh,
  flaggedOrders,
  onToggleFlag,
  toggleMutationPending,
}) {
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const orders = useMemo(() => {
    const pages = ordersQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.nodes || []);
  }, [ordersQuery.data]);

  const orderSummary = orderSummaryQuery.data?.pages?.[0]?.summary;
  const orderSummaryUsers = useMemo(() => {
    const pages = orderSummaryQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.byUserNodes || []);
  }, [orderSummaryQuery.data]);

  const paymentSummary = paymentSummaryQuery.data?.pages?.[0]?.summary;
  const paymentSummaryUsers = useMemo(() => {
    const pages = paymentSummaryQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.byUserNodes || []);
  }, [paymentSummaryQuery.data]);

  const filterBadge =
    activeFilterCount > 0 ? (
      <Badge variant="outline">
        {activeFilterCount} {activeFilterCount === 1 ? "active filter" : "active filters"}
      </Badge>
    ) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Order Support & Inquiries"
        description="Investigate orders, reconcile payments, and surface customer escalations from one workspace."
        actions={
          <div className="flex items-center gap-2">
            {filterBadge}
            <Button type="button" variant="outline" onClick={onRefresh}>
              Refresh data
            </Button>
          </div>
        }
      />

      <FiltersSection filters={filters} onChange={onFilterChange} onReset={onResetFilters} />

      <OrdersTable
        orders={orders}
        isLoading={ordersQuery.isLoading}
        isFetchingNextPage={ordersQuery.isFetchingNextPage}
        hasNextPage={ordersQuery.hasNextPage}
        onLoadMore={() => ordersQuery.fetchNextPage()}
        onToggleFlag={onToggleFlag}
        mutationPending={toggleMutationPending}
        flaggedSet={flaggedOrders}
      />

      <div className="grid gap-8 xl:grid-cols-2">
        {orderSummary ? (
          <SummarySection
            title="Order overview"
            totalsLabel="Total order value"
            totals={orderSummary.totals}
            breakdowns={orderSummary}
            byUser={orderSummaryUsers}
            onLoadMore={() => orderSummaryQuery.fetchNextPage()}
            hasMore={orderSummaryQuery.hasNextPage}
            isLoading={orderSummaryQuery.isFetchingNextPage}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Order overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Summary data will appear once orders are loaded.</p>
            </CardContent>
          </Card>
        )}

        {paymentSummary ? (
          <SummarySection
            title="Payment overview"
            totalsLabel="Total collected"
            totals={paymentSummary.totals}
            breakdowns={{
              byStatus: paymentSummary.byStatus,
              byPaymentStatus: paymentSummary.byStatus,
              byPaymentGateway: paymentSummary.byGateway,
              byPlan: paymentSummary.byPlan,
              byYear: paymentSummary.byYear,
              byMonth: paymentSummary.byMonth,
            }}
            byUser={paymentSummaryUsers}
            onLoadMore={() => paymentSummaryQuery.fetchNextPage()}
            hasMore={paymentSummaryQuery.hasNextPage}
            isLoading={paymentSummaryQuery.isFetchingNextPage}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Payment overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Payment analytics will populate after orders load.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <LookupCard
        lookupValue={lookupValue}
        onLookupChange={onLookupValueChange}
        onSubmit={onLookupSubmit}
        lookupQuery={lookupQuery}
      />
    </div>
  );
}

export { ORDER_SUPPORT_DEFAULT_FILTERS };
