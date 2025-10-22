"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatCurrency,
  formatCurrencyWithCode,
  formatNumber,
  resolveNumericValue,
} from "@/lib/formatters";
import {
  sanitizeOrderFilters,
  sanitizeOrderPaymentSummaryFilters,
} from "@/lib/queries/admin-orders";

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
  gatewayTransactionId: "",
  planSlug: "",
  userEmail: "",
  invoiceNumber: "",
  startDate: "",
  endDate: "",
  purpose: "all",
};

export const countOrderSupportActiveFilters = (filters) => {
  const sanitizedOrders = sanitizeOrderFilters(filters);
  const sanitizedPayments = sanitizeOrderPaymentSummaryFilters(filters);

  const ignoredKeys = new Set(["limit", "cursor", "byUserLimit", "byUserCursor"]);

  const uniqueKeys = new Set();
  Object.keys(sanitizedOrders).forEach((key) => {
    if (!ignoredKeys.has(key)) {
      uniqueKeys.add(key);
    }
  });
  Object.keys(sanitizedPayments).forEach((key) => {
    if (!ignoredKeys.has(key)) {
      uniqueKeys.add(key);
    }
  });

  return uniqueKeys.size;
};

const formatStatusLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) return "Unknown";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

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

const formatDateOnly = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return date.toLocaleDateString();
  }
};

const formatAmount = (amount, currency) => {
  if (amount == null) {
    return "—";
  }
  const fallback = formatCurrency(amount, { fallback: "—" });
  return formatCurrencyWithCode(amount, currency || "BDT", { fallback });
};

const createOrderRowId = (order, index) => {
  const baseIdentifier = order?.id ?? order?.orderNumber ?? index;
  return `order-row-${String(baseIdentifier)}`;
};

const formatCount = (value) => {
  const numeric = resolveNumericValue(value);
  if (numeric == null) {
    return formatNumber(value, { fallback: "0", minimumFractionDigits: 0 });
  }
  return formatNumber(Math.round(numeric), { fallback: "0", minimumFractionDigits: 0 });
};

const BreakdownTable = ({
  title,
  description,
  rows,
  valueFormatter = (row) => formatAmount(row.totalAmount),
  emptyLabel = "No data",
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
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${title}-${row.key ?? row.label}`}> 
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

const TopCustomersTable = ({
  title,
  rows,
  onLoadMore,
  hasMore,
  isLoading,
  isError,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>Highest grossing customers by billed amount.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {isError ? (
        <p className="text-sm text-destructive">Failed to load additional customers.</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customer data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Billed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.userId ?? row.displayName}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium leading-none">{row.displayName}</p>
                      {row.userEmail ? (
                        <p className="text-xs text-muted-foreground">{row.userEmail}</p>
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
      )}
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto block"
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </CardContent>
  </Card>
);

const OrderLookupSection = ({
  lookupValue,
  onLookupValueChange,
  onLookupSubmit,
  lookupMutation,
  investigatedOrder,
  onClearInvestigatedOrder,
}) => {
  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      onLookupSubmit();
    },
    [onLookupSubmit],
  );

  const lookupError = lookupMutation.isError
    ? lookupMutation.error?.message || "Unable to locate order."
    : null;

  const order = investigatedOrder && !investigatedOrder.optimistic ? investigatedOrder : null;
  const optimistic = investigatedOrder?.optimistic;

  return (
    <section className="space-y-4" aria-labelledby="order-support-lookup">
      <div className="space-y-1">
        <h2 id="order-support-lookup" className="text-lg font-semibold">
          Investigate an order
        </h2>
        <p className="text-sm text-muted-foreground">
          Pull a single order by its identifier to review user, plan, payment, and invoice metadata.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="order-support-lookup-number">Order number or ID</Label>
          <Input
            id="order-support-lookup-number"
            placeholder="000123"
            value={lookupValue}
            onChange={(event) => onLookupValueChange(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={lookupMutation.isPending}>
            {lookupMutation.isPending ? "Searching…" : "Search"}
          </Button>
          {investigatedOrder ? (
            <Button type="button" variant="ghost" onClick={onClearInvestigatedOrder}>
              Clear
            </Button>
          ) : null}
        </div>
      </form>
      {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
      {optimistic ? (
        <p className="text-sm text-muted-foreground">Fetching order details…</p>
      ) : null}
      {order ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order {order.orderNumber}</CardTitle>
            <CardDescription>{formatStatusLabel(order.statusLabel)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p className="font-medium">Customer</p>
              <p>{order.user?.displayName ?? "Unknown"}</p>
              {order.user?.email ? (
                <p className="text-muted-foreground">{order.user.email}</p>
              ) : null}
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">Plan</p>
              <p>{order.plan?.planName ?? order.plan?.planSlug ?? "Unassigned"}</p>
              {order.plan?.billingCycle ? (
                <p className="text-muted-foreground">Billing cycle: {order.plan.billingCycle}</p>
              ) : null}
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">Payment</p>
              <p>
                {order.payment?.statusLabel ?? "Unknown"} · {formatAmount(order.payment?.amount, order.payment?.currency)}
              </p>
              {order.payment?.paymentGateway ? (
                <p className="text-muted-foreground">Gateway: {order.payment.paymentGateway}</p>
              ) : null}
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">Timeline</p>
              <p>Created {formatDateTime(order.createdAt)}</p>
              {order.startDate ? <p>Start {formatDateOnly(order.startDate)}</p> : null}
              {order.endDate ? <p>End {formatDateOnly(order.endDate)}</p> : null}
            </div>
            <div className="space-y-1 text-sm md:col-span-2">
              <p className="font-medium">Invoice</p>
              {order.invoice?.invoiceNumber ? (
                <p>
                  #{order.invoice.invoiceNumber} · {order.invoice.statusLabel ?? "Unknown"} ·
                  {" "}
                  {formatAmount(order.invoice.amount, order.invoice.currency)}
                </p>
              ) : (
                <p className="text-muted-foreground">No invoice linked.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
};

export default function OrderSupportContent({
  filters,
  onFilterChange,
  onResetFilters,
  summaryQuery,
  paymentSummaryQuery,
  ordersQuery,
  orderTopCustomersQuery,
  lookupValue,
  onLookupValueChange,
  onLookupSubmit,
  lookupMutation,
  investigatedOrder,
  onClearInvestigatedOrder,
  summaryNextCursor,
}) {
  const orderSummary = summaryQuery.data;
  const paymentSummary = paymentSummaryQuery.data;

  const combinedTopCustomers = useMemo(() => {
    const base = orderSummary?.byUser ?? [];
    const extraPages = orderTopCustomersQuery.data?.pages ?? [];
    const extra = extraPages.flatMap((page) => page.users ?? []);
    return [...base, ...extra];
  }, [orderSummary, orderTopCustomersQuery.data]);

  const hasMoreTopCustomers = useMemo(() => {
    if (orderTopCustomersQuery.hasNextPage) {
      return true;
    }
    const pages = orderTopCustomersQuery.data?.pages ?? [];
    if (pages.length === 0 && summaryNextCursor) {
      return true;
    }
    return false;
  }, [orderTopCustomersQuery.hasNextPage, orderTopCustomersQuery.data, summaryNextCursor]);

  const handleLoadMoreTopCustomers = useCallback(() => {
    if (orderTopCustomersQuery.isFetchingNextPage) {
      return;
    }
    if (!orderTopCustomersQuery.data?.pages?.length && summaryNextCursor) {
      orderTopCustomersQuery.fetchNextPage({ pageParam: summaryNextCursor });
      return;
    }
    orderTopCustomersQuery.fetchNextPage();
  }, [orderTopCustomersQuery, summaryNextCursor]);

  const orders = useMemo(() => {
    const pages = ordersQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.orders ?? []);
  }, [ordersQuery.data]);

  const orderIndexById = useMemo(() => {
    const map = new Map();
    orders.forEach((order, index) => {
      map.set(createOrderRowId(order, index), { order, index });
    });
    return map;
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [cardPosition, setCardPosition] = useState(null);
  const tableContainerRef = useRef(null);
  const cardRef = useRef(null);
  const lastInteractedRowIdRef = useRef(null);

  const selectedOrderEntry = selectedOrderId ? orderIndexById.get(selectedOrderId) : null;
  const selectedOrder = selectedOrderEntry?.order ?? null;

  const isOrdersLoading = ordersQuery.isLoading && !ordersQuery.isFetched;
  const ordersErrorMessage = ordersQuery.isError
    ? ordersQuery.error?.message || "Failed to load orders."
    : null;

  const renderOrderStatusBadge = (statusLabel) => (
    <Badge variant="secondary" className="capitalize">
      {formatStatusLabel(statusLabel)}
    </Badge>
  );

  const handleInputChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      onFilterChange(name, value);
    },
    [onFilterChange],
  );

  const handleSelectChange = useCallback(
    (name) => (value) => {
      onFilterChange(name, value);
    },
    [onFilterChange],
  );

  const summaryReady = summaryQuery.isSuccess && orderSummary;
  const paymentSummaryReady = paymentSummaryQuery.isSuccess && paymentSummary;

  useEffect(() => {
    if (selectedOrderId && !orderIndexById.has(selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [orderIndexById, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) {
      setCardPosition(null);
      return;
    }

    const container = tableContainerRef.current;
    if (!container) {
      return;
    }

    const scrollContainer =
      container.querySelector('[data-slot="table-container"]') ?? container;

    const updateCardPosition = () => {
      const rowElement = container.querySelector(
        `[data-order-row="${selectedOrderId}"]`,
      );

      if (!rowElement) {
        return;
      }

      const wrapperRect = container.getBoundingClientRect();
      const scrollRect = scrollContainer.getBoundingClientRect();
      const rowRect = rowElement.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft ?? 0;
      const scrollTop = scrollContainer.scrollTop ?? 0;
      const visibleWidth = scrollContainer.clientWidth ?? scrollRect.width;
      const relativeLeft = rowRect.left - wrapperRect.left + scrollLeft;
      const baseWidth = rowRect.width;
      const width = Math.min(visibleWidth, Math.max(baseWidth, 320));
      const minLeft = scrollLeft;
      const maxLeft = scrollLeft + visibleWidth - width;
      const clampedLeft = Math.min(
        Math.max(relativeLeft, minLeft),
        Math.max(minLeft, maxLeft),
      );
      const top = rowRect.bottom - wrapperRect.top + scrollTop + 8;

      setCardPosition({
        top,
        left: Number.isFinite(clampedLeft) ? clampedLeft : relativeLeft,
        width,
      });
    };

    updateCardPosition();

    window.addEventListener("resize", updateCardPosition);
    scrollContainer.addEventListener("scroll", updateCardPosition);

    return () => {
      window.removeEventListener("resize", updateCardPosition);
      scrollContainer.removeEventListener("scroll", updateCardPosition);
    };
  }, [selectedOrderId, orderIndexById]);

  useEffect(() => {
    if (!selectedOrderId) {
      if (lastInteractedRowIdRef.current && tableContainerRef.current) {
        const targetRow = tableContainerRef.current.querySelector(
          `[data-order-row="${lastInteractedRowIdRef.current}"]`,
        );
        if (targetRow instanceof HTMLElement) {
          requestAnimationFrame(() => targetRow.focus());
        }
      }
      return;
    }

    const focusFrame = requestAnimationFrame(() => {
      const closeButton = cardRef.current?.querySelector(
        '[data-role="order-details-close"]',
      );
      if (closeButton instanceof HTMLElement) {
        closeButton.focus();
      }
    });

    return () => cancelAnimationFrame(focusFrame);
  }, [selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    const handlePointerDown = (event) => {
      const cardElement = cardRef.current;
      if (cardElement?.contains(event.target)) {
        return;
      }

      const rowElement = tableContainerRef.current?.querySelector(
        `[data-order-row="${selectedOrderId}"]`,
      );

      if (rowElement?.contains(event.target)) {
        return;
      }

      lastInteractedRowIdRef.current = selectedOrderId;
      setSelectedOrderId(null);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        lastInteractedRowIdRef.current = selectedOrderId;
        setSelectedOrderId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedOrderId]);

  const handleToggleRowSelection = useCallback((rowId) => {
    lastInteractedRowIdRef.current = rowId;
    setSelectedOrderId((current) => (current === rowId ? null : rowId));
  }, []);

  const handleRowKeyDown = useCallback(
    (event, rowId) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggleRowSelection(rowId);
      }

      if (event.key === "Escape" && selectedOrderId === rowId) {
        event.preventDefault();
        lastInteractedRowIdRef.current = rowId;
        setSelectedOrderId(null);
      }
    },
    [handleToggleRowSelection, selectedOrderId],
  );

  const handleCloseDetails = useCallback(() => {
    if (!selectedOrderId) {
      return;
    }

    lastInteractedRowIdRef.current = selectedOrderId;
    setSelectedOrderId(null);
  }, [selectedOrderId]);

  const detailsCardId = "order-support-selected-order";
  const detailsTitleId = `${detailsCardId}-title`;
  const detailsBodyId = `${detailsCardId}-body`;

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="order-support-filters">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 id="order-support-filters" className="text-lg font-semibold">
              Filters
            </h2>
            <p className="text-sm text-muted-foreground">
              Refine results by status, billing plan, payment metadata, and investigation window.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onResetFilters}>
            Reset filters
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <Label htmlFor="order-filter-status">Order status</Label>
            <Select value={filters.status} onValueChange={handleSelectChange("status")}>
              <SelectTrigger id="order-filter-status">
                <SelectValue placeholder="All" />
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
            <Select value={filters.paymentStatus} onValueChange={handleSelectChange("paymentStatus")}>
              <SelectTrigger id="order-filter-payment-status">
                <SelectValue placeholder="All" />
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
            <Label htmlFor="order-filter-gateway-id">Gateway transaction ID</Label>
            <Input
              id="order-filter-gateway-id"
              name="gatewayTransactionId"
              placeholder="pi_12345"
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
            <Label htmlFor="order-filter-user">Customer email</Label>
            <Input
              id="order-filter-user"
              name="userEmail"
              placeholder="customer@example.com"
              value={filters.userEmail}
              onChange={handleInputChange}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-invoice">Invoice number</Label>
            <Input
              id="order-filter-invoice"
              name="invoiceNumber"
              placeholder="INV-2024-0001"
              value={filters.invoiceNumber}
              onChange={handleInputChange}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-purpose">Payment purpose</Label>
            <Select value={filters.purpose} onValueChange={handleSelectChange("purpose")}>
              <SelectTrigger id="order-filter-purpose">
                <SelectValue placeholder="All" />
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
            <Label htmlFor="order-filter-start">Start date</Label>
            <Input
              id="order-filter-start"
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-filter-end">End date</Label>
            <Input
              id="order-filter-end"
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="order-support-overview">
        <div className="space-y-1">
          <h2 id="order-support-overview" className="text-lg font-semibold">
            Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            High-level order and payment totals with breakdowns for quick triage.
          </p>
        </div>
        {summaryQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load order summary.</p>
        ) : null}
        {paymentSummaryQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load payment summary.</p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order totals</CardTitle>
              <CardDescription>
                {summaryQuery.isLoading ? "Loading order metrics…" : "Total orders and revenue across the applied filters."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-2xl font-semibold">
                  {summaryReady ? formatCount(orderSummary.totals.totalOrders) : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Billed amount</p>
                <p className="text-2xl font-semibold">
                  {summaryReady ? formatAmount(orderSummary.totals.totalAmount) : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment totals</CardTitle>
              <CardDescription>
                {paymentSummaryQuery.isLoading
                  ? "Loading payment metrics…"
                  : "Payments correlated to the selected filters."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Payments</p>
                <p className="text-2xl font-semibold">
                  {paymentSummaryReady ? formatCount(paymentSummary.totals.totalPayments) : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Collected amount</p>
                <p className="text-2xl font-semibold">
                  {paymentSummaryReady ? formatAmount(paymentSummary.totals.totalAmount) : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownTable
            title="Orders by status"
            description="Distribution of orders by lifecycle state."
            rows={summaryReady ? orderSummary.byStatus : []}
          />
          <BreakdownTable
            title="Orders by payment status"
            description="Correlation between orders and payment state."
            rows={summaryReady ? orderSummary.byPaymentStatus : []}
          />
          <BreakdownTable
            title="Orders by payment gateway"
            description="Track which providers drive the most revenue."
            rows={summaryReady ? orderSummary.byPaymentGateway : []}
          />
          <BreakdownTable
            title="Orders by plan"
            description="Revenue concentration across plans."
            rows={summaryReady ? orderSummary.byPlan : []}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownTable
            title="Payments by status"
            description="Success versus failure rates across payments."
            rows={paymentSummaryReady ? paymentSummary.byStatus : []}
            valueFormatter={(row) => formatAmount(row.totalAmount)}
          />
          <BreakdownTable
            title="Payments by purpose"
            description="Understand why payments were initiated."
            rows={paymentSummaryReady ? paymentSummary.byPurpose : []}
            valueFormatter={(row) => formatAmount(row.totalAmount)}
          />
        </div>
        <TopCustomersTable
          title="Top customers by billed amount"
          rows={summaryReady ? combinedTopCustomers : []}
          onLoadMore={handleLoadMoreTopCustomers}
          hasMore={hasMoreTopCustomers}
          isLoading={orderTopCustomersQuery.isFetchingNextPage}
          isError={orderTopCustomersQuery.isError}
        />
      </section>

      <section className="space-y-4" aria-labelledby="order-support-orders">
        <div className="space-y-1">
          <h2 id="order-support-orders" className="text-lg font-semibold">
            Orders
          </h2>
          <p className="text-sm text-muted-foreground">
            Review the latest orders that satisfy the filters and drill into user activity.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtered orders</CardTitle>
            <CardDescription>
              {ordersQuery.isFetching && !ordersQuery.isFetchingNextPage
                ? "Refreshing…"
                : "Newest orders first."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ordersErrorMessage ? (
              <p className="text-sm text-destructive">{ordersErrorMessage}</p>
            ) : null}
            {isOrdersLoading ? (
              <p className="text-sm text-muted-foreground">Loading orders…</p>
            ) : null}
            {!isOrdersLoading && orders.length === 0 && !ordersErrorMessage ? (
              <p className="text-sm text-muted-foreground">No orders found for the selected filters.</p>
            ) : null}
            {orders.length > 0 ? (
              <div ref={tableContainerRef} className="relative">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order, index) => {
                      const rowId = createOrderRowId(order, index);
                      const isSelected = selectedOrderId === rowId;

                      return (
                        <TableRow
                          key={rowId}
                          data-order-row={rowId}
                          tabIndex={0}
                          role="button"
                          aria-expanded={isSelected}
                          aria-controls={detailsCardId}
                          onClick={() => handleToggleRowSelection(rowId)}
                          onKeyDown={(event) => handleRowKeyDown(event, rowId)}
                          data-state={isSelected ? "selected" : undefined}
                          className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">#{order.orderNumber}</p>
                              {order.invoice?.invoiceNumber ? (
                                <p className="text-xs text-muted-foreground">
                                Invoice {order.invoice.invoiceNumber}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{renderOrderStatusBadge(order.statusLabel)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{order.user?.displayName ?? "Unknown"}</p>
                            {order.user?.email ? (
                              <p className="text-xs text-muted-foreground">{order.user.email}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p>{order.plan?.planName ?? order.plan?.planSlug ?? "Unassigned"}</p>
                            {order.payment?.paymentGateway ? (
                              <p className="text-xs text-muted-foreground">
                                {order.payment.paymentGateway} · {order.payment.statusLabel ?? "Unknown"}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(order.amount ?? order.payment?.amount, order.currency ?? order.payment?.currency)}
                        </TableCell>
                        <TableCell className="text-right">{formatDateTime(order.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {selectedOrder && cardPosition ? (
                  <div
                    ref={cardRef}
                    className="pointer-events-none absolute z-20 max-w-full"
                    style={{
                      top: cardPosition.top,
                      left: cardPosition.left,
                      width: cardPosition.width,
                    }}
                  >
                    <Card
                      role="dialog"
                      aria-modal="false"
                      aria-labelledby={detailsTitleId}
                      aria-describedby={detailsBodyId}
                      id={detailsCardId}
                      className="pointer-events-auto shadow-lg"
                    >
                      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <CardTitle id={detailsTitleId} className="text-base">
                            Order #{selectedOrder.orderNumber ?? selectedOrderId}
                          </CardTitle>
                          <CardDescription>
                            {formatStatusLabel(selectedOrder.statusLabel)} · Created
                            {" "}
                            {formatDateTime(selectedOrder.createdAt)}
                          </CardDescription>
                        </div>
                        <div className="flex shrink-0 items-start">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleCloseDetails}
                            data-role="order-details-close"
                            aria-label="Close order details"
                          >
                            <span aria-hidden="true">×</span>
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent
                        id={detailsBodyId}
                        className="grid gap-4 text-sm sm:grid-cols-2"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">Customer</p>
                          <p>{selectedOrder.user?.displayName ?? "Unknown"}</p>
                          {selectedOrder.user?.email ? (
                            <p className="text-muted-foreground">{selectedOrder.user.email}</p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">Plan</p>
                          <p>
                            {selectedOrder.plan?.planName ??
                              selectedOrder.plan?.planSlug ??
                              "Unassigned"}
                          </p>
                          {selectedOrder.plan?.billingCycle ? (
                            <p className="text-muted-foreground">
                              Billing cycle: {selectedOrder.plan.billingCycle}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">Order details</p>
                          <p>Status: {formatStatusLabel(selectedOrder.statusLabel)}</p>
                          <p className="text-muted-foreground">
                            Total amount:
                            {" "}
                            {formatAmount(
                              selectedOrder.amount ?? selectedOrder.payment?.amount,
                              selectedOrder.currency ?? selectedOrder.payment?.currency,
                            )}
                          </p>
                          {selectedOrder.startDate ? (
                            <p className="text-muted-foreground">
                              Starts {formatDateOnly(selectedOrder.startDate)}
                            </p>
                          ) : null}
                          {selectedOrder.endDate ? (
                            <p className="text-muted-foreground">
                              Ends {formatDateOnly(selectedOrder.endDate)}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">Payment</p>
                          <p>
                            {formatAmount(
                              selectedOrder.payment?.amount,
                              selectedOrder.payment?.currency,
                            )}
                            {" "}· {formatStatusLabel(selectedOrder.payment?.statusLabel)}
                          </p>
                          {selectedOrder.payment?.paymentGateway ? (
                            <p className="text-muted-foreground">
                              Gateway: {selectedOrder.payment.paymentGateway}
                            </p>
                          ) : null}
                          {selectedOrder.payment?.gatewayTransactionId ? (
                            <p className="text-muted-foreground">
                              Transaction ID: {selectedOrder.payment.gatewayTransactionId}
                            </p>
                          ) : null}
                          {selectedOrder.payment?.purposeLabel ||
                          selectedOrder.payment?.purpose ? (
                            <p className="text-muted-foreground">
                              Purpose:{" "}
                              {formatStatusLabel(
                                selectedOrder.payment?.purposeLabel ??
                                  selectedOrder.payment?.purpose,
                              )}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">Timeline</p>
                          <p>Created {formatDateTime(selectedOrder.createdAt)}</p>
                          {selectedOrder.updatedAt ? (
                            <p className="text-muted-foreground">
                              Updated {formatDateTime(selectedOrder.updatedAt)}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <p className="font-medium">Invoice</p>
                          {selectedOrder.invoice?.invoiceNumber ? (
                            <div className="space-y-1">
                              <p>
                                #{selectedOrder.invoice.invoiceNumber} ·
                                {" "}
                                {formatStatusLabel(selectedOrder.invoice.statusLabel)} ·
                                {" "}
                                {formatAmount(
                                  selectedOrder.invoice.amount,
                                  selectedOrder.invoice.currency,
                                )}
                              </p>
                              {selectedOrder.invoice?.dueDate ? (
                                <p className="text-muted-foreground">
                                  Due {formatDateOnly(selectedOrder.invoice.dueDate)}
                                </p>
                              ) : null}
                              {selectedOrder.invoice?.issuedAt ? (
                                <p className="text-muted-foreground">
                                  Issued {formatDateTime(selectedOrder.invoice.issuedAt)}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">No invoice linked.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
            ) : null}
            {ordersQuery.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => ordersQuery.fetchNextPage()}
                disabled={ordersQuery.isFetchingNextPage}
              >
                {ordersQuery.isFetchingNextPage ? "Loading…" : "Load more orders"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <OrderLookupSection
        lookupValue={lookupValue}
        onLookupValueChange={onLookupValueChange}
        onLookupSubmit={onLookupSubmit}
        lookupMutation={lookupMutation}
        investigatedOrder={investigatedOrder}
        onClearInvestigatedOrder={onClearInvestigatedOrder}
      />
    </div>
  );
}
