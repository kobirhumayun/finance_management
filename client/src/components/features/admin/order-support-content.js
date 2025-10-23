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
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  formatCurrency,
  formatCurrencyWithCode,
  formatNumber,
  resolveNumericValue,
} from "@/lib/formatters";
import { sanitizeOrderFilters, sanitizeOrderPaymentSummaryFilters } from "@/lib/queries/admin-orders";
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

const formatCount = (value) => {
  const numeric = resolveNumericValue(value);
  if (numeric == null) {
    return formatNumber(value, { fallback: "0", minimumFractionDigits: 0 });
  }
  return formatNumber(Math.round(numeric), { fallback: "0", minimumFractionDigits: 0 });
};

const clamp = (value, min, max) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return min;
  }
  if (numericValue < min) {
    return min;
  }
  if (numericValue > max) {
    return max;
  }
  return numericValue;
};

const escapeForSelector = (value) => {
  const stringValue = value == null ? "" : String(value);
  const css =
    (typeof CSS !== "undefined" && typeof CSS.escape === "function" && CSS.escape) ||
    (typeof globalThis !== "undefined" &&
      globalThis.CSS &&
      typeof globalThis.CSS.escape === "function" &&
      globalThis.CSS.escape);

  if (css) {
    return css(stringValue);
  }

  return stringValue.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
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

function OrderDetailPopover({
  anchorElement,
  order,
  detail,
  isLoading,
  isError,
  selectedOrderNumber,
  onClose,
}) {
  const bodyRef = useRef(null);
  const lastMeasuredRectRef = useRef(null);
  const popoverSideRef = useRef("right");
  const [virtualAnchorRef, setVirtualAnchorRef] = useState({ current: null });
  const [popoverSide, setPopoverSide] = useState("right");
  const isOpen = Boolean(selectedOrderNumber && anchorElement);
  const activeAnchorRef = useRef(null);

  useEffect(() => {
    activeAnchorRef.current = anchorElement || null;
  }, [anchorElement]);

  useEffect(() => {
    if (!isOpen && bodyRef.current) {
      bodyRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !anchorElement) {
      setVirtualAnchorRef({ current: null });
      lastMeasuredRectRef.current = null;
      return;
    }

    if (typeof window === "undefined" || typeof anchorElement.getBoundingClientRect !== "function") {
      return;
    }

    const measure = () => {
      if (!anchorElement || typeof anchorElement.getBoundingClientRect !== "function") {
        return;
      }

      const rect = anchorElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || rect.right || 0;
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || rect.bottom || 0;
      const margin = 16;

      const availableRight = Math.max(0, viewportWidth - margin - rect.right);
      const availableLeft = Math.max(0, rect.left - margin);
      const nextSide = availableRight >= availableLeft ? "right" : "left";
      const horizontalEdge = nextSide === "right" ? rect.right : rect.left;
      const anchorX = clamp(horizontalEdge, margin, Math.max(margin, viewportWidth - margin));
      const anchorY = clamp(
        rect.top + rect.height / 2,
        margin,
        Math.max(margin, viewportHeight - margin),
      );

      const sanitizedRect = {
        width: 0,
        height: 0,
        top: anchorY,
        bottom: anchorY,
        left: anchorX,
        right: anchorX,
        x: anchorX,
        y: anchorY,
      };

      const previousRect = lastMeasuredRectRef.current;
      const rectChanged =
        !previousRect ||
        ["top", "bottom", "left", "right", "x", "y"].some(
          (key) => previousRect[key] !== sanitizedRect[key],
        );
      const sideChanged = popoverSideRef.current !== nextSide;

      if (!rectChanged && !sideChanged) {
        return;
      }

      lastMeasuredRectRef.current = sanitizedRect;

      if (sideChanged) {
        popoverSideRef.current = nextSide;
        setPopoverSide(nextSide);
      }

      setVirtualAnchorRef({
        current: {
          getBoundingClientRect: () => sanitizedRect,
          contextElement: anchorElement,
        },
      });
    };

    let frameId;
    const scheduleMeasure = () => {
      if (frameId != null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    measure();

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [anchorElement, isOpen]);

  if (!isOpen) {
    return null;
  }

  const mergedOrder =
    order || detail
      ? {
          ...(order ?? {}),
          ...(detail ?? {}),
          payment: { ...(order?.payment ?? {}), ...(detail?.payment ?? {}) },
          invoice: { ...(order?.invoice ?? {}), ...(detail?.invoice ?? {}) },
          user: { ...(order?.user ?? {}), ...(detail?.user ?? {}) },
          plan: { ...(order?.plan ?? {}), ...(detail?.plan ?? {}) },
        }
      : null;

  const payment = mergedOrder?.payment ?? {};
  const invoice = mergedOrder?.invoice ?? {};
  const user = mergedOrder?.user ?? {};
  const plan = mergedOrder?.plan ?? {};

  let content = null;

  if (!mergedOrder) {
    content = (
      <p className="text-sm text-muted-foreground">
        No additional details are available for order #{selectedOrderNumber}.
      </p>
    );
  } else {
    const metadataRows = [
      {
        key: "order-status",
        label: "Order status",
        value: formatStatusLabel(mergedOrder.statusLabel || mergedOrder.status),
      },
      {
        key: "order-created",
        label: "Created",
        value: formatDateTime(mergedOrder.createdAt),
      },
      {
        key: "order-updated",
        label: "Updated",
        value: formatDateTime(mergedOrder.updatedAt),
      },
      {
        key: "order-period",
        label: "Service period",
        value: `${formatDateOnly(mergedOrder.startDate)} → ${formatDateOnly(mergedOrder.endDate)}`,
      },
      {
        key: "order-renewal",
        label: "Renews",
        value: formatDateOnly(mergedOrder.renewalDate),
      },
      {
        key: "order-plan",
        label: "Plan",
        value: plan.planName || plan.planSlug || "Unassigned plan",
      },
      {
        key: "order-amount",
        label: "Order amount",
        value: formatAmount(
          mergedOrder.amount ?? payment.amount,
          mergedOrder.currency ?? payment.currency,
        ),
      },
    ];

    const customerRows = [
      {
        key: "customer-name",
        label: "Customer",
        value: user.displayName || "Unknown customer",
      },
      {
        key: "customer-email",
        label: "Email",
        value: user.email || "—",
      },
      {
        key: "customer-username",
        label: "Username",
        value: user.username || "—",
      },
      {
        key: "customer-role",
        label: "Role",
        value: user.role || "—",
      },
      {
        key: "customer-subscription-status",
        label: "Subscription status",
        value: user.subscriptionStatus
          ? formatStatusLabel(user.subscriptionStatus)
          : "—",
      },
      {
        key: "customer-subscription-period",
        label: "Subscription period",
        value: `${formatDateOnly(user.subscriptionStartDate)} → ${formatDateOnly(
          user.subscriptionEndDate,
        )}`,
      },
    ];

    const paymentRows = [
      {
        key: "payment-status",
        label: "Payment status",
        value: formatStatusLabel(payment.statusLabel || payment.status),
      },
      {
        key: "payment-gateway",
        label: "Gateway",
        value: payment.paymentGateway || "—",
      },
      {
        key: "payment-transaction",
        label: "Transaction ID",
        value: payment.gatewayTransactionId || "—",
      },
      {
        key: "payment-amount",
        label: "Amount",
        value: formatAmount(payment.amount, payment.currency || mergedOrder.currency),
      },
      {
        key: "payment-refunded",
        label: "Refunded",
        value: formatAmount(payment.refundedAmount, payment.currency || mergedOrder.currency),
      },
      {
        key: "payment-purpose",
        label: "Purpose",
        value: payment.purpose || "—",
      },
      {
        key: "payment-processed",
        label: "Processed",
        value: formatDateTime(payment.processedAt || payment.updatedAt),
      },
      {
        key: "payment-created",
        label: "Created",
        value: formatDateTime(payment.createdAt),
      },
    ];

    const invoiceRows = [
      {
        key: "invoice-number",
        label: "Invoice number",
        value: invoice.invoiceNumber || "—",
      },
      {
        key: "invoice-status",
        label: "Invoice status",
        value: formatStatusLabel(invoice.statusLabel || invoice.status),
      },
      {
        key: "invoice-amount",
        label: "Invoice amount",
        value: formatAmount(
          invoice.amount,
          invoice.currency || payment.currency || mergedOrder.currency,
        ),
      },
      {
        key: "invoice-issued",
        label: "Issued",
        value: formatDateTime(invoice.issuedDate),
      },
      {
        key: "invoice-due",
        label: "Due",
        value: formatDateTime(invoice.dueDate),
      },
      {
        key: "invoice-period",
        label: "Billing period",
        value: `${formatDateOnly(invoice.subscriptionStartDate)} → ${formatDateOnly(
          invoice.subscriptionEndDate,
        )}`,
      },
    ];

    const renderRows = (rows) => (
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-right">{row.value}</span>
          </div>
        ))}
      </div>
    );

    const statusMessages = [];
    if (isLoading) {
      statusMessages.push(
        <p key="loading" className="text-sm text-muted-foreground">
          {detail
            ? "Refreshing order data…"
            : `Loading order #${selectedOrderNumber}…`}
        </p>,
      );
    }
    if (isError) {
      statusMessages.push(
        <p key="error" className="text-sm text-destructive">
          Unable to load additional details for order #{selectedOrderNumber}.
        </p>,
      );
    }

    content = (
      <div className="space-y-4 text-sm">
        {statusMessages}
        <section aria-labelledby="order-support-detail-metadata" className="space-y-2">
          <h3 id="order-support-detail-metadata" className="text-sm font-semibold text-muted-foreground">
            Order metadata
          </h3>
          {renderRows(metadataRows)}
        </section>
        <section aria-labelledby="order-support-detail-customer" className="space-y-2">
          <h3 id="order-support-detail-customer" className="text-sm font-semibold text-muted-foreground">
            Customer
          </h3>
          {renderRows(customerRows)}
        </section>
        <section aria-labelledby="order-support-detail-payment" className="space-y-2">
          <h3 id="order-support-detail-payment" className="text-sm font-semibold text-muted-foreground">
            Payment
          </h3>
          {renderRows(paymentRows)}
        </section>
        <section aria-labelledby="order-support-detail-invoice" className="space-y-2">
          <h3 id="order-support-detail-invoice" className="text-sm font-semibold text-muted-foreground">
            Invoice
          </h3>
          {renderRows(invoiceRows)}
        </section>
      </div>
    );
  }

  return (
    <Popover
      open={isOpen}
    >
      <PopoverAnchor virtualRef={virtualAnchorRef} />
      <PopoverContent
        align="start"
        side={popoverSide}
        sideOffset={12}
        collisionPadding={16}
        className="z-50 w-[32rem] max-w-[min(32rem,calc(100vw-2rem))] p-0 shadow-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          bodyRef.current?.focus();
        }}
        onEscapeKeyDown={() => {
          onClose?.();
        }}
        onPointerDownOutside={(event) => {
          const anchorNode = activeAnchorRef.current;
          if (
            anchorNode &&
            typeof Node !== "undefined" &&
            event.target instanceof Node &&
            anchorNode.contains(event.target)
          ) {
            event.preventDefault();
            return;
          }
          onClose?.();
        }}
        onFocusOutside={(event) => {
          const anchorNode = activeAnchorRef.current;
          if (
            anchorNode &&
            typeof Node !== "undefined" &&
            event.target instanceof Node &&
            anchorNode.contains(event.target)
          ) {
            event.preventDefault();
            return;
          }
          onClose?.();
        }}
      >
        <div ref={bodyRef} tabIndex={-1} className="flex flex-col gap-4 p-4 focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Order detail</h2>
              <p className="text-sm text-muted-foreground">
                Reference information for order #{selectedOrderNumber}.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onClose?.()}>
              Close
            </Button>
          </div>
          {content}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  selectedOrderNumber,
  onSelectOrder,
  orderDetailQuery,
}) {
  const [detailAnchorElement, setDetailAnchorElement] = useState(null);
  const reattachFrameRef = useRef(null);

  const cancelReattachFrame = useCallback(() => {
    if (
      reattachFrameRef.current != null &&
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(reattachFrameRef.current);
    }
    reattachFrameRef.current = null;
  }, []);

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

  const selectedOrder = useMemo(() => {
    if (!selectedOrderNumber) {
      return null;
    }
    return orders.find((order) => order?.orderNumber === selectedOrderNumber) ?? null;
  }, [orders, selectedOrderNumber]);

  const handleDetailClose = useCallback(() => {
    cancelReattachFrame();
    setDetailAnchorElement(null);
    onSelectOrder?.(null);
  }, [cancelReattachFrame, onSelectOrder]);

  const handleOrderSelect = useCallback(
    (orderNumber, anchorNode) => {
      if (!orderNumber) {
        handleDetailClose();
        return;
      }

      cancelReattachFrame();
      setDetailAnchorElement(
        anchorNode && typeof anchorNode.getBoundingClientRect === "function"
          ? anchorNode
          : null,
      );
      onSelectOrder?.(orderNumber);
    },
    [cancelReattachFrame, handleDetailClose, onSelectOrder],
  );

  useEffect(() => {
    if (!selectedOrderNumber) {
      cancelReattachFrame();
      setDetailAnchorElement(null);
    }
  }, [cancelReattachFrame, selectedOrderNumber]);

  useEffect(() => {
    if (!selectedOrderNumber || !detailAnchorElement) {
      return;
    }

    if (detailAnchorElement.isConnected) {
      return;
    }

    if (typeof document === "undefined") {
      handleDetailClose();
      return;
    }

    cancelReattachFrame();

    const escapedOrderNumber = escapeForSelector(selectedOrderNumber);
    const selector = `[data-order-support-row="${escapedOrderNumber}"]`;

    const attemptReattach = () => {
      reattachFrameRef.current = null;

      const nextAnchor = document.querySelector(selector);
      if (nextAnchor instanceof HTMLElement) {
        setDetailAnchorElement(nextAnchor);
        return;
      }

      const orderStillVisible = orders.some(
        (candidate) => candidate?.orderNumber === selectedOrderNumber,
      );

      if (orderStillVisible) {
        if (
          typeof window !== "undefined" &&
          typeof window.requestAnimationFrame === "function"
        ) {
          reattachFrameRef.current = window.requestAnimationFrame(attemptReattach);
        }
        return;
      }

      handleDetailClose();
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      reattachFrameRef.current = window.requestAnimationFrame(attemptReattach);
    } else {
      attemptReattach();
    }

    return () => {
      cancelReattachFrame();
    };
  }, [
    orders,
    selectedOrderNumber,
    detailAnchorElement,
    cancelReattachFrame,
    handleDetailClose,
  ]);

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
              <div className="overflow-x-auto">
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
                    {orders.map((order) => {
                      const isSelected = selectedOrderNumber === order.orderNumber;
                      const handleRowSelect = (event) => {
                        if (isSelected) {
                          handleDetailClose();
                          return;
                        }
                        handleOrderSelect(order.orderNumber, event.currentTarget);
                      };
                      const handleRowKeyDown = (event) => {
                        if (event.key === "Enter" || event.key === " " || event.key === "Space") {
                          event.preventDefault();
                          if (isSelected) {
                            handleDetailClose();
                          } else {
                            handleOrderSelect(order.orderNumber, event.currentTarget);
                          }
                        }
                      };
                      return (
                        <TableRow
                          key={order.id ?? order.orderNumber}
                          data-order-support-row={
                            order?.orderNumber != null ? String(order.orderNumber) : undefined
                          }
                          className={cn("relative cursor-pointer", isSelected && "bg-muted/40")}
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={handleRowSelect}
                          onKeyDown={handleRowKeyDown}
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
                            {formatAmount(
                              order.amount ?? order.payment?.amount,
                              order.currency ?? order.payment?.currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatDateTime(order.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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

      <OrderDetailPopover
        anchorElement={detailAnchorElement}
        order={selectedOrder}
        detail={orderDetailQuery.data}
        isLoading={Boolean(orderDetailQuery.isFetching)}
        isError={Boolean(orderDetailQuery.isError)}
        selectedOrderNumber={selectedOrderNumber}
        onClose={handleDetailClose}
      />

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
