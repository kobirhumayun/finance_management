"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { sanitizeInvoiceFilters } from "@/lib/queries/admin-invoices";
import { cn } from "@/lib/utils";

export const INVOICE_INSIGHTS_PAGE_SIZE = 20;
export const INVOICE_INSIGHTS_TOP_CUSTOMER_PAGE_SIZE = 10;

const invoiceStatusOptions = [
  { value: "all", label: "All invoice statuses" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "cancelled", label: "Cancelled" },
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

export const invoiceInsightsDefaultFilters = {
  invoiceNumber: "",
  status: "all",
  paymentStatus: "all",
  paymentGateway: "",
  planSlug: "",
  userEmail: "",
  startDate: "",
  endDate: "",
};

export const countInvoiceInsightsActiveFilters = (filters) => {
  const sanitized = sanitizeInvoiceFilters(filters);
  return Object.keys(sanitized).filter((key) => !["limit", "cursor", "byUserLimit", "byUserCursor"].includes(key)).length;
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

const clamp = (value, min, max) => {
  if (Number.isNaN(value)) {
    return value;
  }
  return Math.min(Math.max(value, min), max);
};

const formatAmount = (amount, currency) => {
  if (amount == null) {
    return "—";
  }
  const fallback = formatCurrency(amount, { fallback: "—" });
  return formatCurrencyWithCode(amount, currency || "BDT", { fallback });
};

const formatInvoiceCount = (value) => {
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

const BreakdownTable = ({ title, description, rows, emptyLabel = "No data", valueFormatter = (value) => value }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </CardHeader>
    <CardContent className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div key={row.key ?? row.label} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium leading-tight">{row.label}</div>
                  <div className="text-right text-sm font-semibold">
                    {valueFormatter(row)}
                    <div className="text-xs font-normal text-muted-foreground">Billed</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="font-semibold">{formatInvoiceCount(row.count)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key ?? row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right">{formatInvoiceCount(row.count)}</TableCell>
                    <TableCell className="text-right">{valueFormatter(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
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
    <section className="space-y-4" aria-labelledby="invoice-insights-filters">
      <div className="space-y-1">
        <h2 id="invoice-insights-filters" className="text-lg font-semibold">
          Filters
        </h2>
        <p className="text-sm text-muted-foreground">
          Narrow down insights by invoice properties, payment lifecycle, and user metadata.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invoice-filter-number">Invoice number</Label>
          <Input
            id="invoice-filter-number"
            name="invoiceNumber"
            placeholder="INV-2024-00001"
            value={filters.invoiceNumber}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice-filter-email">Customer email</Label>
          <Input
            id="invoice-filter-email"
            name="userEmail"
            placeholder="customer@example.com"
            value={filters.userEmail}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label>Invoice status</Label>
          <Select value={filters.status} onValueChange={(value) => onChange("status", value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {invoiceStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment status</Label>
          <Select value={filters.paymentStatus} onValueChange={(value) => onChange("paymentStatus", value)}>
            <SelectTrigger className="w-full">
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
          <Label htmlFor="invoice-filter-gateway">Payment gateway</Label>
          <Input
            id="invoice-filter-gateway"
            name="paymentGateway"
            placeholder="stripe"
            value={filters.paymentGateway}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice-filter-plan">Plan slug</Label>
          <Input
            id="invoice-filter-plan"
            name="planSlug"
            placeholder="pro-annual"
            value={filters.planSlug}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice-filter-start">Issued after</Label>
          <Input
            id="invoice-filter-start"
            name="startDate"
            type="date"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-moz-calendar-picker-indicator]:cursor-pointer"
            value={filters.startDate}
            onChange={handleInputChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice-filter-end">Issued before</Label>
          <Input
            id="invoice-filter-end"
            name="endDate"
            type="date"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-moz-calendar-picker-indicator]:cursor-pointer"
            value={filters.endDate}
            onChange={handleInputChange}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </section>
  );
}

function SummarySection({ summary, isLoading, isError }) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading invoice summary…</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">Unable to load invoice summary.</p>;
  }

  const totals = summary?.totals ?? { totalInvoices: 0, totalAmount: 0 };

  return (
    <section className="space-y-4" aria-labelledby="invoice-insights-summary">
      <div className="space-y-1">
        <h2 id="invoice-insights-summary" className="text-lg font-semibold">
          Overview totals
        </h2>
        <p className="text-sm text-muted-foreground">
          Aggregate counts update automatically with each filter change.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatInvoiceCount(totals.totalInvoices)}</p>
            <p className="text-sm text-muted-foreground">Matching current filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total billed amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatAmount(totals.totalAmount, totals.currency)}</p>
            <p className="text-sm text-muted-foreground">Across all invoice currencies</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function TopCustomersSection({ customers, hasMore, isFetchingNextPage, onLoadMore, isLoading, isError }) {
  return (
    <section aria-labelledby="invoice-insights-top-customers">
      <Card>
        <CardHeader>
          <CardTitle id="invoice-insights-top-customers">Top customers by billed amount</CardTitle>
          <CardDescription>
            Identify the accounts contributing the highest revenue within the selected filters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading top customers…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">Unable to load top customers.</p>
          ) : customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers match the current filters.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {customers.map((customer) => (
                  <div key={customer.userId ?? customer.displayName} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium leading-tight">{customer.displayName}</div>
                        {customer.userEmail ? (
                          <div className="text-xs text-muted-foreground">{customer.userEmail}</div>
                        ) : null}
                      </div>
                      <div className="text-right text-sm font-semibold">
                        {formatAmount(customer.totalAmount, customer.currency)}
                        <div className="text-xs font-normal text-muted-foreground">Total billed</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Invoices</span>
                      <span className="font-semibold">{formatInvoiceCount(customer.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Total billed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.userId ?? customer.displayName}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium">{customer.displayName}</div>
                            {customer.userEmail ? (
                              <div className="text-xs text-muted-foreground">{customer.userEmail}</div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatInvoiceCount(customer.count)}</TableCell>
                        <TableCell className="text-right">{formatAmount(customer.totalAmount, customer.currency)}</TableCell>
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
                  {isFetchingNextPage ? "Loading…" : hasMore ? "Load more" : "All customers loaded"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function InvoiceListSection({
  invoices,
  isLoading,
  isError,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
  onSelect,
  selectedInvoiceNumber,
}) {
  return (
    <section aria-labelledby="invoice-insights-list">
      <Card>
        <CardHeader>
          <CardTitle id="invoice-insights-list">Matching invoices</CardTitle>
          <CardDescription>
            Review individual invoices and open detailed payment context with a single click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading invoices…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">Unable to load invoices.</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices match the current filters.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {invoices.map((invoice) => {
                  const isSelected = selectedInvoiceNumber === invoice.invoiceNumber;

                  return (
                    <div
                      key={invoice.id ?? invoice.invoiceNumber}
                      className={cn(
                        "rounded-lg border bg-card p-4 shadow-sm transition-colors",
                        isSelected && "border-primary/50 ring-1 ring-primary/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Invoice</div>
                          <div className="text-lg font-semibold leading-tight">{invoice.invoiceNumber}</div>
                          {invoice.planName ? (
                            <div className="text-xs text-muted-foreground">Plan: {invoice.planName}</div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Amount</div>
                          <div className="text-base font-semibold">
                            {formatAmount(invoice.amount, invoice.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDateOnly(invoice.issuedDate)}</div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Customer</span>
                          <span className="text-right font-medium">
                            {invoice.userName}
                            {invoice.userEmail ? (
                              <span className="block text-xs text-muted-foreground">{invoice.userEmail}</span>
                            ) : null}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Status</span>
                          <Badge
                            variant={
                              invoice.status === "paid"
                                ? "outline"
                                : invoice.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {invoice.statusLabel || formatStatusLabel(invoice.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => onSelect(invoice.invoiceNumber, event.currentTarget)}
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
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Issued</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const isSelected = selectedInvoiceNumber === invoice.invoiceNumber;
                      const handleRowSelect = (event) => {
                        if (isSelected) {
                          onSelect(null, null);
                          return;
                        }
                        onSelect(invoice.invoiceNumber, event.currentTarget);
                      };
                      const handleRowKeyDown = (event) => {
                        if (event.key === "Enter" || event.key === " " || event.key === "Space") {
                          event.preventDefault();
                          if (isSelected) {
                            onSelect(null, null);
                          } else {
                            onSelect(invoice.invoiceNumber, event.currentTarget);
                          }
                        }
                      };
                      return (
                        <TableRow
                          key={invoice.id ?? invoice.invoiceNumber}
                          className={cn("cursor-pointer", isSelected && "bg-muted/40")}
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={handleRowSelect}
                          onKeyDown={handleRowKeyDown}
                        >
                          <TableCell>
                            <div className="font-medium">{invoice.invoiceNumber}</div>
                            {invoice.planName ? (
                              <div className="text-xs text-muted-foreground">Plan: {invoice.planName}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{invoice.userName}</div>
                            {invoice.userEmail ? (
                              <div className="text-xs text-muted-foreground">{invoice.userEmail}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invoice.status === "paid"
                                  ? "outline"
                                  : invoice.status === "cancelled"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {invoice.statusLabel || formatStatusLabel(invoice.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatAmount(invoice.amount, invoice.currency)}</TableCell>
                          <TableCell>{formatDateOnly(invoice.issuedDate)}</TableCell>
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
                  {isFetchingNextPage ? "Loading…" : hasMore ? "Load more" : "All invoices loaded"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function InvoiceDetailPopover({
  anchorElement,
  detail,
  isLoading,
  isError,
  selectedInvoiceNumber,
  onClose,
}) {
  const bodyRef = useRef(null);
  const lastMeasuredRectRef = useRef(null);
  const popoverSideRef = useRef("right");
  const [virtualAnchorRef, setVirtualAnchorRef] = useState({ current: null });
  const [popoverSide, setPopoverSide] = useState("right");
  const isOpen = Boolean(selectedInvoiceNumber && anchorElement);

  useEffect(() => {
    if (!isOpen && bodyRef.current) {
      bodyRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (anchorElement && !anchorElement.isConnected) {
      onClose?.();
    }
  }, [anchorElement, onClose]);

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
      const prefersVertical = viewportWidth < 640;
      const nextSide = prefersVertical
        ? "bottom"
        : availableRight >= availableLeft
          ? "right"
          : "left";
      const anchorX = clamp(
        nextSide === "right"
          ? rect.right
          : nextSide === "left"
            ? rect.left
            : rect.left + rect.width / 2,
        margin,
        Math.max(margin, viewportWidth - margin),
      );
      const anchorY = clamp(
        nextSide === "bottom"
          ? rect.bottom
          : nextSide === "top"
            ? rect.top
            : rect.top + rect.height / 2,
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

  let content = null;

  if (isLoading) {
    content = (
      <p className="text-sm text-muted-foreground">Loading invoice {selectedInvoiceNumber}…</p>
    );
  } else if (isError) {
    content = (
      <p className="text-sm text-destructive">Unable to load invoice {selectedInvoiceNumber}.</p>
    );
  } else if (!detail) {
    content = (
      <p className="text-sm text-muted-foreground">
        No additional details are available for invoice {selectedInvoiceNumber}.
      </p>
    );
  } else {
    const metadataRows = [
      {
        key: "invoice-status",
        label: "Invoice status",
        value: detail.statusLabel || formatStatusLabel(detail.status),
      },
      {
        key: "issued",
        label: "Issued",
        value: formatDateTime(detail.issuedDate),
      },
      {
        key: "due",
        label: "Due",
        value: formatDateTime(detail.dueDate),
      },
      {
        key: "billing-period",
        label: "Billing period",
        value: `${
          detail.subscriptionStartDate ? formatDateOnly(detail.subscriptionStartDate) : "—"
        } → ${detail.subscriptionEndDate ? formatDateOnly(detail.subscriptionEndDate) : "—"}`,
      },
      {
        key: "plan",
        label: "Plan",
        value: detail.planName || detail.planSlug || "Unknown plan",
      },
      {
        key: "amount",
        label: "Amount",
        value: formatAmount(
          detail.amount ?? detail.paymentAmount,
          detail.currency ?? detail.paymentCurrency,
        ),
      },
    ];

    const paymentRows = [
      {
        key: "payment-status",
        label: "Payment status",
        value: detail.paymentStatusLabel || formatStatusLabel(detail.paymentStatus),
      },
      {
        key: "gateway",
        label: "Gateway",
        value: detail.paymentGateway || "—",
      },
      {
        key: "reference",
        label: "Reference",
        value: detail.paymentReference || "—",
      },
      {
        key: "processed",
        label: "Processed",
        value: formatDateTime(detail.paymentProcessedAt || detail.paymentUpdatedAt),
      },
      {
        key: "purpose",
        label: "Purpose",
        value: detail.paymentPurpose || "—",
      },
    ];

    const renderRows = (rows) => (
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    );

    content = (
      <div className="space-y-4 text-sm">
        <section aria-labelledby="invoice-insights-detail-metadata" className="space-y-2">
          <h3 id="invoice-insights-detail-metadata" className="text-sm font-semibold text-muted-foreground">
            Invoice metadata
          </h3>
          {renderRows(metadataRows)}
        </section>
        <section aria-labelledby="invoice-insights-detail-payment" className="space-y-2">
          <h3 id="invoice-insights-detail-payment" className="text-sm font-semibold text-muted-foreground">
            Payment
          </h3>
          {renderRows(paymentRows)}
        </section>
      </div>
    );
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <PopoverAnchor virtualRef={virtualAnchorRef} />
      <PopoverContent
        align={popoverSide === "bottom" ? "center" : "start"}
        side={popoverSide}
        sideOffset={12}
        collisionPadding={16}
        className="z-50 w-[28rem] max-w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto p-0 shadow-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          bodyRef.current?.focus();
        }}
      >
        <div ref={bodyRef} tabIndex={-1} className="flex flex-col gap-4 p-4 focus:outline-none">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Invoice detail</h2>
            <p className="text-sm text-muted-foreground">
              Reference information for {selectedInvoiceNumber}.
            </p>
          </div>
          {content}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function InvoiceInsightsContent({
  filters,
  onFilterChange,
  onResetFilters,
  summaryQuery,
  invoicesQuery,
  detailQuery,
  selectedInvoiceNumber,
  onSelectInvoice,
}) {
  const [detailAnchorElement, setDetailAnchorElement] = useState(null);

  const handleDetailClose = useCallback(() => {
    setDetailAnchorElement(null);
    onSelectInvoice?.(null);
  }, [onSelectInvoice]);

  const handleInvoiceSelect = useCallback(
    (invoiceNumber, anchorNode) => {
      if (!invoiceNumber) {
        handleDetailClose();
        return;
      }

      setDetailAnchorElement(
        anchorNode &&
          typeof anchorNode.getBoundingClientRect === "function"
          ? anchorNode
          : null,
      );

      onSelectInvoice?.(invoiceNumber);
    },
    [handleDetailClose, onSelectInvoice],
  );

  useEffect(() => {
    if (!selectedInvoiceNumber) {
      setDetailAnchorElement(null);
    }
  }, [selectedInvoiceNumber]);
  const summaryPages = summaryQuery?.data?.pages ?? [];
  const summary = summaryPages[0]?.summary;
  const topCustomers = summaryPages.flatMap((page) => page.byUserNodes ?? []);

  const invoicePages = invoicesQuery?.data?.pages ?? [];
  const invoices = invoicePages.flatMap((page) => page.nodes ?? []);

  return (
    <div className="space-y-10">
      <FiltersSection filters={filters} onChange={onFilterChange} onReset={onResetFilters} />
      <Separator />
      <SummarySection summary={summary} isLoading={summaryQuery?.isLoading} isError={summaryQuery?.isError} />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable
          title="Invoice statuses"
          description="Distribution of invoice lifecycle states."
          rows={(summary?.byStatus ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount, row.currency)}
        />
        <BreakdownTable
          title="Payment statuses"
          description="Outcome of associated payments."
          rows={(summary?.byPaymentStatus ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount, row.currency)}
        />
        <BreakdownTable
          title="Payment gateways"
          description="Gateway usage across invoices."
          rows={(summary?.byPaymentGateway ?? []).map((item) => ({
            key: item.key ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount, row.currency)}
        />
        <BreakdownTable
          title="Currencies"
          description="Invoice totals grouped by currency."
          rows={(summary?.byCurrency ?? []).map((item) => ({
            key: item.currency ?? item.label,
            label: item.label,
            count: item.count,
            totalAmount: item.totalAmount,
            currency: item.currency,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount, row.currency)}
        />
      </div>
      <BreakdownTable
        title="Plans"
        description="Top plans driving invoicing volume."
        rows={(summary?.byPlan ?? []).map((item) => ({
          key: item.planId ?? item.label,
          label: item.label,
          count: item.count,
          totalAmount: item.totalAmount,
        }))}
        valueFormatter={(row) => formatAmount(row.totalAmount, row.currency)}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownTable
          title="By year"
          description="Annual cohort of invoices."
          rows={(summary?.byYear ?? []).map((item) => ({
            key: item.year ?? item.label,
            label: item.year ?? "Unknown",
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount, row.currency)}
        />
        <BreakdownTable
          title="By month"
          description="Monthly velocity of billing."
          rows={(summary?.byMonth ?? []).map((item) => ({
            key: `${item.year ?? "unknown"}-${item.month ?? "00"}`,
            label: formatMonthLabel(item),
            count: item.count,
            totalAmount: item.totalAmount,
          }))}
          valueFormatter={(row) => formatAmount(row.totalAmount, row.currency)}
        />
      </div>
      <TopCustomersSection
        customers={topCustomers}
        hasMore={Boolean(summaryQuery?.hasNextPage)}
        isFetchingNextPage={Boolean(summaryQuery?.isFetchingNextPage)}
        onLoadMore={() => summaryQuery?.fetchNextPage?.()}
        isLoading={Boolean(summaryQuery?.isLoading)}
        isError={Boolean(summaryQuery?.isError)}
      />
      <InvoiceListSection
        invoices={invoices}
        isLoading={Boolean(invoicesQuery?.isLoading)}
        isError={Boolean(invoicesQuery?.isError)}
        hasMore={Boolean(invoicesQuery?.hasNextPage)}
        isFetchingNextPage={Boolean(invoicesQuery?.isFetchingNextPage)}
        onLoadMore={() => invoicesQuery?.fetchNextPage?.()}
        onSelect={handleInvoiceSelect}
        selectedInvoiceNumber={selectedInvoiceNumber}
      />
      <InvoiceDetailPopover
        anchorElement={detailAnchorElement}
        detail={detailQuery?.data}
        isLoading={Boolean(detailQuery?.isFetching)}
        isError={Boolean(detailQuery?.isError)}
        selectedInvoiceNumber={selectedInvoiceNumber}
        onClose={handleDetailClose}
      />
    </div>
  );
}

export default InvoiceInsightsContent;
