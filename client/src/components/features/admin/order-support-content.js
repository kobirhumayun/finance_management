"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderDetailPopover, formatAmount, formatDateOnly, formatStatusLabel } from "@/components/features/orders/order-detail-popover";
import { formatNumber, resolveNumericValue } from "@/lib/formatters";
import { sanitizeOrderFilters } from "@/lib/queries/admin-orders";
import { cn } from "@/lib/utils";

export const ORDER_SUPPORT_PAGE_SIZE = 20;
export const ORDER_SUPPORT_TOP_CUSTOMER_PAGE_SIZE = 10;

const orderStatusOptions = [
  { value: "all", label: "All order statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const paymentStatusOptions = [
  { value: "all", label: "All payment statuses" },
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "requires_action", label: "Requires action" },
  { value: "canceled", label: "Canceled" },
];

const paymentPurposeOptions = [
  { value: "all", label: "All payment purposes" },
  { value: "subscription_initial", label: "Subscription initial" },
  { value: "subscription_renewal", label: "Subscription renewal" },
  { value: "plan_upgrade", label: "Plan upgrade" },
  { value: "plan_downgrade", label: "Plan downgrade" },
  { value: "one_time_purchase", label: "One-time purchase" },
  { value: "service_fee", label: "Service fee" },
  { value: "manual_payment", label: "Manual payment" },
  { value: "refund", label: "Refund" },
  { value: "top_up", label: "Top up" },
];

export const orderSupportDefaultFilters = {
  orderNumber: "",
  status: "all",
  paymentStatus: "all",
  paymentGateway: "",
  paymentPurpose: "all",
  gatewayTransactionId: "",
  planSlug: "",
  userEmail: "",
  invoiceNumber: "",
  startDate: "",
  endDate: "",
};

export const countOrderSupportActiveFilters = (filters) => {
  const sanitized = sanitizeOrderFilters(filters);
  return Object.keys(sanitized).filter((key) => !["limit", "cursor", "byUserLimit", "byUserCursor"].includes(key)).length;
};

const formatCount = (value) => {
  const numericValue = resolveNumericValue(value);
  if (numericValue === null) {
    return formatNumber(value, { fallback: "0", minimumFractionDigits: 0 });
  }
  return formatNumber(Math.round(numericValue), { fallback: "0", minimumFractionDigits: 0 });
};

const formatMonthLabel = ({ year, month }) => {
  if (!year || !month) return "Unknown";
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
  countLabel = "Orders",
  amountLabel = "Amount",
  valueFormatter = (row) => row,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
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
                <TableHead className="text-right">{countLabel}</TableHead>
                <TableHead className="text-right">{amountLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key ?? row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right">{formatCount(row.count)}</TableCell>
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

function FiltersSection({ filters, onChange, onReset }) {
  const handleInputChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      onChange(name, value);
    },
    [onChange],
  );

  return (
    <section className="space-y-4" aria-labelledby="order-support-filters">
      <div className="space-y-1">
        <h2 id="order-support-filters" className="text-lg font-semibold">
          Filters
        </h2>
        <p className="text-sm text-muted-foreground">
          Narrow results by order identifiers, payment lifecycle, and customer metadata.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="order-filter-number">Order number</Label>
          <Input
            id="order-filter-number"
            name="orderNumber"
            placeholder="000123"
            value={filters.orderNumber}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-email">Customer email</Label>
          <Input
            id="order-filter-email"
            name="userEmail"
            placeholder="customer@example.com"
            value={filters.userEmail}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-status">Order status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => onChange("status", value)}
          >
            <SelectTrigger id="order-filter-status" className="w-full">
              <SelectValue placeholder="Select order status" />
            </SelectTrigger>
            <SelectContent>
              {orderStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-payment-status">Payment status</Label>
          <Select
            value={filters.paymentStatus}
            onValueChange={(value) => onChange("paymentStatus", value)}
          >
            <SelectTrigger id="order-filter-payment-status" className="w-full">
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              {paymentStatusOptions.map((option) => (
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
            placeholder="stripe"
            value={filters.paymentGateway}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-purpose">Payment purpose</Label>
          <Select
            value={filters.paymentPurpose}
            onValueChange={(value) => onChange("paymentPurpose", value)}
          >
            <SelectTrigger id="order-filter-purpose" className="w-full">
              <SelectValue placeholder="Select payment purpose" />
            </SelectTrigger>
            <SelectContent>
              {paymentPurposeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-reference">Gateway transaction ID</Label>
          <Input
            id="order-filter-reference"
            name="gatewayTransactionId"
            placeholder="pi_3Pp..."
            value={filters.gatewayTransactionId}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-plan">Plan slug</Label>
          <Input
            id="order-filter-plan"
            name="planSlug"
            placeholder="pro-annual"
            value={filters.planSlug}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-invoice">Invoice number</Label>
          <Input
            id="order-filter-invoice"
            name="invoiceNumber"
            placeholder="INV-2024-00001"
            value={filters.invoiceNumber}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-start">Created after</Label>
          <Input
            id="order-filter-start"
            name="startDate"
            type="date"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-moz-calendar-picker-indicator]:cursor-pointer"
            value={filters.startDate}
            onChange={handleInputChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-filter-end">Created before</Label>
          <Input
            id="order-filter-end"
            name="endDate"
            type="date"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-moz-calendar-picker-indicator]:cursor-pointer"
            value={filters.endDate}
            onChange={handleInputChange}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </section>
  );
}

function SummarySection({ summary, isLoading, isError }) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading order summary…</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">Unable to load order summary.</p>;
  }

  const totals = summary?.totals ?? { totalOrders: 0, totalAmount: 0 };

  return (
    <section className="space-y-4" aria-labelledby="order-support-summary">
      <div className="space-y-1">
        <h2 id="order-support-summary" className="text-lg font-semibold">
          Order overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Aggregate metrics refresh automatically as filters change.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCount(totals.totalOrders)}</p>
            <p className="text-sm text-muted-foreground">Matching current filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total order amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatAmount(totals.totalAmount)}</p>
            <p className="text-sm text-muted-foreground">Across all currencies</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function PaymentSummarySection({ summary, isLoading, isError }) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payment summary…</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">Unable to load payment summary.</p>;
  }

  const totals = summary?.totals ?? { totalPayments: 0, totalAmount: 0 };

  return (
    <section className="space-y-4" aria-labelledby="order-support-payments-summary">
      <div className="space-y-1">
        <h2 id="order-support-payments-summary" className="text-lg font-semibold">
          Payment overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Understand the payment health associated with matching orders.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCount(totals.totalPayments)}</p>
            <p className="text-sm text-muted-foreground">Matching current filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total collected amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatAmount(totals.totalAmount)}</p>
            <p className="text-sm text-muted-foreground">Includes partial and full captures</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function TopEntitiesSection({
  title,
  description,
  countHeader,
  amountHeader,
  rows,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
  isLoading,
  isError,
}) {
  const headingId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-section`;

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <CardTitle id={headingId}>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">Unable to load this data.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results for the current filters.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rows.map((row) => (
                  <div
                    key={row.userId ?? row.displayName}
                    className="rounded-lg border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium leading-tight">{row.displayName}</div>
                        {row.userEmail ? (
                          <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                        ) : null}
                      </div>
                      <div className="text-right text-sm font-medium">
                        {formatAmount(row.totalAmount)}
                        <div className="text-xs text-muted-foreground">{amountHeader}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{countHeader}</span>
                      <span className="font-semibold">{formatCount(row.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">{countHeader}</TableHead>
                      <TableHead className="text-right">{amountHeader}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.userId ?? row.displayName}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium">{row.displayName}</div>
                            {row.userEmail ? (
                              <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCount(row.count)}</TableCell>
                        <TableCell className="text-right">{formatAmount(row.totalAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={!hasMore || isFetchingNextPage}
                  className="w-full md:w-auto"
                >
                  {isFetchingNextPage ? "Loading…" : hasMore ? "Load more" : "All results loaded"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function OrdersListSection({
  orders,
  isLoading,
  isError,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
  onSelect,
  selectedOrderNumber,
}) {
  const [hoveredOrderNumber, setHoveredOrderNumber] = useState(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading orders…</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">Unable to load orders.</p>;
  }

  if (!orders.length) {
    return <p className="text-sm text-muted-foreground">No orders match the current filters.</p>;
  }

  return (
    <section aria-labelledby="order-support-list">
      <Card>
        <CardHeader>
          <CardTitle id="order-support-list">Matching orders</CardTitle>
          <CardDescription>
            Select any row to review order, payment, and invoice details side-by-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 md:hidden">
            {orders.map((order) => {
              const isSelected = selectedOrderNumber === order.orderNumber;

              return (
                <div
                  key={order.id ?? order.orderNumber}
                  className={cn(
                    "rounded-lg border bg-card p-4 shadow-sm transition-colors",
                    isSelected && "border-primary/50 ring-1 ring-primary/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Order</div>
                      <div className="text-lg font-semibold leading-tight">
                        {order.orderNumber ?? order.id}
                      </div>
                      {order.planName ? (
                        <div className="text-xs text-muted-foreground">Plan: {order.planName}</div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Amount</div>
                      <div className="text-base font-semibold">
                        {formatAmount(order.amount, order.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateOnly(order.createdAt || order.startDate)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium text-right">
                        {order.userName}
                        {order.userEmail ? (
                          <span className="block text-xs text-muted-foreground">{order.userEmail}</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Order status</span>
                      <Badge variant="outline">{order.statusLabel || formatStatusLabel(order.status)}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Payment</span>
                      {order.paymentStatus ? (
                        <Badge variant="secondary">
                          {order.paymentStatusLabel || formatStatusLabel(order.paymentStatus)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unknown</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => onSelect(order.orderNumber, event.currentTarget)}
                    >
                      View details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const isSelected = selectedOrderNumber === order.orderNumber;
                  const isHovered = hoveredOrderNumber === order.orderNumber;

                  return (
                    <TableRow
                      key={order.id ?? order.orderNumber}
                      className={cn(
                        "cursor-pointer",
                        isSelected && "bg-muted/60",
                        isHovered && !isSelected && "bg-muted/40",
                      )}
                      onMouseEnter={() => setHoveredOrderNumber(order.orderNumber)}
                      onMouseLeave={() => setHoveredOrderNumber(null)}
                      onClick={(event) => onSelect(order.orderNumber, event.currentTarget)}
                    >
                      <TableCell>
                        <div className="font-medium">{order.orderNumber ?? order.id}</div>
                        {order.planName ? (
                          <div className="text-xs text-muted-foreground">Plan: {order.planName}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.userName}</div>
                        {order.userEmail ? (
                          <div className="text-xs text-muted-foreground">{order.userEmail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.statusLabel || formatStatusLabel(order.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        {order.paymentStatus ? (
                          <Badge variant="secondary">
                            {order.paymentStatusLabel || formatStatusLabel(order.paymentStatus)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatAmount(order.amount, order.currency)}</TableCell>
                      <TableCell>{formatDateOnly(order.createdAt || order.startDate)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={!hasMore || isFetchingNextPage}
              className="w-full md:w-auto"
            >
              {isFetchingNextPage ? "Loading…" : hasMore ? "Load more" : "All orders loaded"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function OrderSupportContent({
  filters,
  onFilterChange,
  onResetFilters,
  ordersQuery,
  summaryQuery,
  paymentSummaryQuery,
  detailQuery,
  selectedOrderNumber,
  onSelectOrder,
}) {
  const [detailAnchorElement, setDetailAnchorElement] = useState(null);

  const handleDetailClose = useCallback(() => {
    setDetailAnchorElement(null);
    onSelectOrder?.(null);
  }, [onSelectOrder]);

  const handleOrderSelect = useCallback(
    (orderNumber, anchorNode) => {
      if (!orderNumber) {
        handleDetailClose();
        return;
      }

      setDetailAnchorElement(
        anchorNode && typeof anchorNode.getBoundingClientRect === "function" ? anchorNode : null,
      );

      onSelectOrder?.(orderNumber);
    },
    [handleDetailClose, onSelectOrder],
  );

  useEffect(() => {
    if (!selectedOrderNumber) {
      setDetailAnchorElement(null);
    }
  }, [selectedOrderNumber]);

  const summaryPages = summaryQuery?.data?.pages ?? [];
  const orderSummary = summaryPages[0]?.summary;
  const orderTopCustomers = summaryPages.flatMap((page) => page.byUserNodes ?? []);

  const paymentSummaryPages = paymentSummaryQuery?.data?.pages ?? [];
  const paymentSummary = paymentSummaryPages[0]?.summary;
  const paymentTopCustomers = paymentSummaryPages.flatMap((page) => page.byUserNodes ?? []);

  const orderPages = ordersQuery?.data?.pages ?? [];
  const orders = orderPages.flatMap((page) => page.nodes ?? []);

  return (
    <div className="space-y-10">
      <FiltersSection filters={filters} onChange={onFilterChange} onReset={onResetFilters} />
      <Separator />
      <SummarySection
        summary={orderSummary}
        isLoading={Boolean(summaryQuery?.isLoading)}
        isError={Boolean(summaryQuery?.isError)}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable
          title="Order statuses"
          description="Distribution of order lifecycle states."
          rows={(orderSummary?.byStatus ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="Payment statuses"
          description="Outcome of associated payments."
          rows={(orderSummary?.byPaymentStatus ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="Payment gateways"
          description="Gateway usage for matching orders."
          rows={(orderSummary?.byPaymentGateway ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="Plans"
          description="Top plans driving order volume."
          rows={(orderSummary?.byPlan ?? []).map((item) => ({
            key: item.planId ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownTable
          title="By year"
          description="Annual order cohorts."
          rows={(orderSummary?.byYear ?? []).map((item) => ({
            key: item.year ?? item.label,
            label: item.year ?? "Unknown",
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="By month"
          description="Monthly ordering trend."
          rows={(orderSummary?.byMonth ?? []).map((item) => ({
            key: `${item.year ?? "unknown"}-${item.month ?? "00"}`,
            label: formatMonthLabel(item),
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
      </div>
      <TopEntitiesSection
        title="Top customers by order volume"
        description="Identify accounts placing the highest-value orders."
        countHeader="Orders"
        amountHeader="Order amount"
        rows={orderTopCustomers}
        hasMore={Boolean(summaryQuery?.hasNextPage)}
        isFetchingNextPage={Boolean(summaryQuery?.isFetchingNextPage)}
        onLoadMore={() => summaryQuery?.fetchNextPage?.()}
        isLoading={Boolean(summaryQuery?.isLoading)}
        isError={Boolean(summaryQuery?.isError)}
      />
      <Separator />
      <PaymentSummarySection
        summary={paymentSummary}
        isLoading={Boolean(paymentSummaryQuery?.isLoading)}
        isError={Boolean(paymentSummaryQuery?.isError)}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable
          title="Payment outcomes"
          description="Success and failure distribution across payments."
          rows={(paymentSummary?.byStatus ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          countLabel="Payments"
          amountLabel="Collected"
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="Payment gateways"
          description="Gateway performance for collected revenue."
          rows={(paymentSummary?.byGateway ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          countLabel="Payments"
          amountLabel="Collected"
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="Payment purposes"
          description="Why payments were initiated."
          rows={(paymentSummary?.byPurpose ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          countLabel="Payments"
          amountLabel="Collected"
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="Plans"
          description="Plans associated with collected revenue."
          rows={(paymentSummary?.byPlan ?? []).map((item) => ({
            key: item.planId ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          countLabel="Payments"
          amountLabel="Collected"
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownTable
          title="Payments by year"
          description="Annual payment cadence."
          rows={(paymentSummary?.byYear ?? []).map((item) => ({
            key: item.year ?? item.label,
            label: item.year ?? "Unknown",
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          countLabel="Payments"
          amountLabel="Collected"
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
        <BreakdownTable
          title="Payments by month"
          description="Monthly payment distribution."
          rows={(paymentSummary?.byMonth ?? []).map((item) => ({
            key: `${item.year ?? "unknown"}-${item.month ?? "00"}`,
            label: formatMonthLabel(item),
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          countLabel="Payments"
          amountLabel="Collected"
          valueFormatter={(row) => formatAmount(row.totalAmount)}
        />
      </div>
      <TopEntitiesSection
        title="Top customers by collected payments"
        description="Spot customers contributing the highest payment amounts."
        countHeader="Payments"
        amountHeader="Collected"
        rows={paymentTopCustomers}
        hasMore={Boolean(paymentSummaryQuery?.hasNextPage)}
        isFetchingNextPage={Boolean(paymentSummaryQuery?.isFetchingNextPage)}
        onLoadMore={() => paymentSummaryQuery?.fetchNextPage?.()}
        isLoading={Boolean(paymentSummaryQuery?.isLoading)}
        isError={Boolean(paymentSummaryQuery?.isError)}
      />
      <OrdersListSection
        orders={orders}
        isLoading={Boolean(ordersQuery?.isLoading)}
        isError={Boolean(ordersQuery?.isError)}
        hasMore={Boolean(ordersQuery?.hasNextPage)}
        isFetchingNextPage={Boolean(ordersQuery?.isFetchingNextPage)}
        onLoadMore={() => ordersQuery?.fetchNextPage?.()}
        onSelect={handleOrderSelect}
        selectedOrderNumber={selectedOrderNumber}
      />
      <OrderDetailPopover
        anchorElement={detailAnchorElement}
        detail={detailQuery?.data}
        isLoading={Boolean(detailQuery?.isLoading)}
        isError={Boolean(detailQuery?.isError)}
        selectedOrderNumber={selectedOrderNumber}
        onClose={handleDetailClose}
      />
    </div>
  );
}

export default OrderSupportContent;
