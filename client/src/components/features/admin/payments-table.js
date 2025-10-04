// File: src/components/features/admin/payments-table.js
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const toTitleCase = (value) => {
  if (typeof value !== "string" || !value.trim()) return value;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatAmount = (amount, currency) => {
  if (amount == null) return "—";
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return currency ? `${amount} ${currency}` : String(amount);
  }
  const safeCurrency = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: safeCurrency }).format(numericAmount);
  } catch {
    return currency ? `${numericAmount} ${currency}` : String(numericAmount);
  }
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

const badgeVariantForStatus = (status) => {
  switch (status) {
    case "approved":
    case "active":
    case "success":
      return "outline";
    case "pending":
    case "processing":
      return "secondary";
    case "rejected":
    case "failed":
    case "declined":
    case "canceled":
    case "cancelled":
    case "refunded":
      return "destructive";
    default:
      return "outline";
  }
};

// Displays manual payment submissions awaiting review.
export default function PaymentsTable({ payments = [], isLoading = false, approvingId = null, onApprove }) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payments…</p>;
  }

  if (!payments.length) {
    return <p className="text-sm text-muted-foreground">No payments found.</p>;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const isApproving = approvingId === payment.id;
            const statusLabel = payment.statusLabel || toTitleCase(payment.status) || "Unknown";
            const purposeLabel = payment.purpose ? toTitleCase(payment.purpose) : null;
            const methodLabel = payment.paymentGateway ? toTitleCase(payment.paymentGateway) : null;
            const methodDetails = payment.paymentMethodDetails ? toTitleCase(payment.paymentMethodDetails) : null;

            return (
              <TableRow key={payment.id}>
                <TableCell>
                  <div className="font-medium">{payment.reference}</div>
                  {payment.paymentId && payment.paymentId !== payment.reference ? (
                    <div className="text-xs text-muted-foreground">{payment.paymentId}</div>
                  ) : null}
                  {payment.orderId ? (
                    <div className="text-xs text-muted-foreground">Order: {payment.orderId}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{payment.userName || "Unknown user"}</div>
                  {payment.userEmail ? (
                    <div className="text-xs text-muted-foreground">{payment.userEmail}</div>
                  ) : null}
                  {payment.planName ? (
                    <div className="text-xs text-muted-foreground">Plan: {payment.planName}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatAmount(payment.amount, payment.currency)}</div>
                  {purposeLabel ? (
                    <div className="text-xs text-muted-foreground">{purposeLabel}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{methodLabel || "—"}</div>
                  {methodDetails ? (
                    <div className="text-xs text-muted-foreground">{methodDetails}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={badgeVariantForStatus(payment.status)}>{statusLabel}</Badge>
                </TableCell>
                <TableCell>{formatDateTime(payment.submittedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    disabled={!payment.canApprove || isApproving || !onApprove}
                    onClick={() => onApprove?.(payment)}
                  >
                    {isApproving ? "Approving…" : "Approve"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
