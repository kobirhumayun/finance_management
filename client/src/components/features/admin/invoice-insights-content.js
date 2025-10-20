"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { sanitizeInvoiceFilters } from "@/lib/queries/admin-invoices";

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
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
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
    <section className="space-y-4" aria-labelledby="invoice-insights-top-customers">
      <div className="space-y-1">
        <h2 id="invoice-insights-top-customers" className="text-lg font-semibold">
          Top customers by billed amount
        </h2>
        <p className="text-sm text-muted-foreground">
          Identify the accounts contributing the highest revenue within the selected filters.
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading top customers…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load top customers.</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customers match the current filters.</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
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
                      <div className="font-medium">{customer.displayName}</div>
                      {customer.userEmail ? (
                        <div className="text-xs text-muted-foreground">{customer.userEmail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{formatInvoiceCount(customer.count)}</TableCell>
                    <TableCell className="text-right">{formatAmount(customer.totalAmount, customer.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={!hasMore || isFetchingNextPage}>
              {isFetchingNextPage ? "Loading…" : hasMore ? "Load more" : "All customers loaded"}
            </Button>
          </div>
        </div>
      )}
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
    <section className="space-y-4" aria-labelledby="invoice-insights-list">
      <div className="space-y-1">
        <h2 id="invoice-insights-list" className="text-lg font-semibold">
          Matching invoices
        </h2>
        <p className="text-sm text-muted-foreground">
          Review individual invoices and open detailed payment context with a single click.
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading invoices…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load invoices.</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices match the current filters.</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
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
                  return (
                    <TableRow
                      key={invoice.id ?? invoice.invoiceNumber}
                      className={isSelected ? "bg-muted/40" : undefined}
                      onClick={() => onSelect(invoice.invoiceNumber)}
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
                        <Badge variant={invoice.status === "paid" ? "outline" : invoice.status === "cancelled" ? "destructive" : "secondary"}>
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
            <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={!hasMore || isFetchingNextPage}>
              {isFetchingNextPage ? "Loading…" : hasMore ? "Load more" : "All invoices loaded"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function InvoiceDetailSection({ detail, isLoading, isError, selectedInvoiceNumber }) {
  if (!selectedInvoiceNumber) {
    return (
      <section aria-labelledby="invoice-insights-detail" className="space-y-2">
        <h2 id="invoice-insights-detail" className="text-lg font-semibold">
          Invoice detail
        </h2>
        <p className="text-sm text-muted-foreground">Select an invoice to preview customer, plan, and payment context.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section aria-labelledby="invoice-insights-detail" className="space-y-2">
        <h2 id="invoice-insights-detail" className="text-lg font-semibold">
          Invoice detail
        </h2>
        <p className="text-sm text-muted-foreground">Loading invoice {selectedInvoiceNumber}…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-labelledby="invoice-insights-detail" className="space-y-2">
        <h2 id="invoice-insights-detail" className="text-lg font-semibold">
          Invoice detail
        </h2>
        <p className="text-sm text-destructive">Unable to load invoice {selectedInvoiceNumber}.</p>
      </section>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <section aria-labelledby="invoice-insights-detail" className="space-y-4">
      <div>
        <h2 id="invoice-insights-detail" className="text-lg font-semibold">
          Invoice detail
        </h2>
        <p className="text-sm text-muted-foreground">
          Reference information for {detail.invoiceNumber}.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Invoice status</span>
            <span className="font-medium">{detail.statusLabel || formatStatusLabel(detail.status)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Issued</span>
            <span className="font-medium">{formatDateTime(detail.issuedDate)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Due</span>
            <span className="font-medium">{formatDateTime(detail.dueDate)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Billing period</span>
            <span className="font-medium">
              {detail.subscriptionStartDate ? formatDateOnly(detail.subscriptionStartDate) : "—"} → {detail.subscriptionEndDate ? formatDateOnly(detail.subscriptionEndDate) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{detail.planName || detail.planSlug || "Unknown plan"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">
              {formatAmount(
                detail.amount ?? detail.paymentAmount,
                detail.currency ?? detail.paymentCurrency,
              )}
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Payment status</span>
            <span className="font-medium">{detail.paymentStatusLabel || formatStatusLabel(detail.paymentStatus)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Gateway</span>
            <span className="font-medium">{detail.paymentGateway || "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-medium">{detail.paymentReference || "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Processed</span>
            <span className="font-medium">{formatDateTime(detail.paymentProcessedAt || detail.paymentUpdatedAt)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Purpose</span>
            <span className="font-medium">{detail.paymentPurpose || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </section>
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
        onSelect={onSelectInvoice}
        selectedInvoiceNumber={selectedInvoiceNumber}
      />
      <InvoiceDetailSection
        detail={detailQuery?.data}
        isLoading={Boolean(detailQuery?.isFetching)}
        isError={Boolean(detailQuery?.isError)}
        selectedInvoiceNumber={selectedInvoiceNumber}
      />
    </div>
  );
}

export default InvoiceInsightsContent;
