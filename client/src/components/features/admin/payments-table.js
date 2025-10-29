// File: src/components/features/admin/payments-table.js
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyWithCode } from "@/lib/formatters";

const toTitleCase = (value) => {
  if (typeof value !== "string" || !value.trim()) return value;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatAmount = (amount, currency) =>
  formatCurrencyWithCode(amount, currency, { fallback: "—" });

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
export default function PaymentsTable({
  payments = [],
  isLoading = false,
  approvingId = null,
  rejectingId = null,
  onApprove,
  onReject,
}) {
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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const isApproving = approvingId === payment.id;
            const isRejecting = rejectingId === payment.id;
            const statusLabel = payment.statusLabel || toTitleCase(payment.status) || "Unknown";
            const purposeLabel = payment.purpose ? toTitleCase(payment.purpose) : null;
            const methodLabel = payment.paymentGateway ? toTitleCase(payment.paymentGateway) : null;
            const methodDetails = payment.paymentMethodDetails ? toTitleCase(payment.paymentMethodDetails) : null;
            const reviewComment =
              typeof payment.reviewComment === "string" ? payment.reviewComment.trim() : "";
            const hasReviewComment = Boolean(reviewComment);
            const reviewMeta = (() => {
              const pieces = [];
              if (payment.reviewerLabel) {
                pieces.push(`by ${payment.reviewerLabel}`);
              }
              if (payment.reviewedAt) {
                const reviewedLabel = payment.reviewerLabel
                  ? formatDateTime(payment.reviewedAt)
                  : `on ${formatDateTime(payment.reviewedAt)}`;
                pieces.push(reviewedLabel);
              }
              if (pieces.length === 0) return null;
              return `Reviewed ${pieces.join(" • ")}`;
            })();

            const referenceDetails = Array.isArray(payment.referenceDetails)
              ? payment.referenceDetails
              : [];
            const [primaryReference, ...otherReferences] = referenceDetails;

            return (
              <TableRow key={payment.id}>
                <TableCell>
                  <div className="space-y-1">
                    {primaryReference ? (
                      <div className="font-medium">
                        {primaryReference.label}: {primaryReference.value}
                      </div>
                    ) : (
                      <div className="font-medium">{payment.reference || "—"}</div>
                    )}
                    {otherReferences.map((detail) => (
                      <div
                        key={`${detail.type}-${detail.value}`}
                        className="text-xs text-muted-foreground"
                      >
                        {detail.label}: {detail.value}
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-1">
                    <Badge variant={badgeVariantForStatus(payment.status)}>{statusLabel}</Badge>
                    {hasReviewComment ? (
                      <p className="text-xs text-muted-foreground break-words">&ldquo;{reviewComment}&rdquo;</p>
                    ) : null}
                    {reviewMeta ? (
                      <p className="text-xs text-muted-foreground">{reviewMeta}</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(payment.submittedAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                    {onApprove ? (
                      <Button
                        size="sm"
                        disabled={!payment.canApprove || isApproving || isRejecting}
                        onClick={() => onApprove?.(payment)}
                      >
                        {isApproving ? "Approving…" : "Approve"}
                      </Button>
                    ) : null}
                    {onReject ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!payment.canReject || isApproving || isRejecting}
                        onClick={() => onReject?.(payment)}
                      >
                        {isRejecting ? "Rejecting…" : "Reject"}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
