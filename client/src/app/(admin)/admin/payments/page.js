// File: src/app/(admin)/admin/payments/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import PaymentsTable from "@/components/features/admin/payments-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { qk } from "@/lib/query-keys";
import { toast } from "@/components/ui/sonner";
import { adminPaymentsOptions, approveAdminPayment } from "@/lib/queries/admin-payments";

// Payments moderation view for administrators.
export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");

  const filters = useMemo(() => {
    if (!statusFilter || statusFilter === "all") return {};
    return { status: statusFilter };
  }, [statusFilter]);

  const {
    data: paymentsData,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery(adminPaymentsOptions(filters));

  const payments = useMemo(() => paymentsData?.items ?? [], [paymentsData]);
  const pagination = paymentsData?.pagination ?? null;
  const availableStatuses = useMemo(() => paymentsData?.availableStatuses ?? [], [paymentsData]);

  const getErrorMessage = (err, fallback) => {
    if (!err) return fallback;
    if (err.body) {
      if (typeof err.body === "string") return err.body;
      if (err.body?.message) return err.body.message;
      if (Array.isArray(err.body?.errors)) {
        const [first] = err.body.errors;
        if (first?.message) return first.message;
      }
    }
    return err.message || fallback;
  };

  const statusOptions = useMemo(() => {
    const normalized = new Set(["pending"]);
    availableStatuses.forEach((status) => {
      if (typeof status === "string" && status.trim()) {
        normalized.add(status.trim().toLowerCase());
      }
    });
    payments.forEach((payment) => {
      if (payment?.status) normalized.add(payment.status);
    });
    if (filters.status) normalized.add(filters.status);
    return ["all", ...Array.from(normalized).sort((a, b) => a.localeCompare(b))];
  }, [availableStatuses, payments, filters.status]);

  useEffect(() => {
    if (!statusOptions.includes(statusFilter)) {
      setStatusFilter("all");
    }
  }, [statusOptions, statusFilter]);

  const approvePaymentMutation = useMutation({
    mutationFn: ({ payment }) =>
      approveAdminPayment({
        appliedUserId: payment.userId,
        newPlanId: payment.planId,
        paymentId: payment.paymentId ?? payment.id,
      }),
    onMutate: async ({ payment, filters: activeFilters }) => {
      const normalizedStatus =
        activeFilters && typeof activeFilters.status === "string"
          ? activeFilters.status.trim().toLowerCase()
          : undefined;
      const normalizedFilters = normalizedStatus && normalizedStatus !== "all"
        ? { status: normalizedStatus }
        : { status: "all" };
      const key = qk.admin.payments(normalizedFilters);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (current) => {
        if (!current) return current;
        const items = Array.isArray(current.items) ? current.items : [];
        const mappedItems = items.map((item) =>
          item.id === payment.id
            ? { ...item, status: "approved", statusLabel: "Approved", canApprove: false }
            : item
        );
        const shouldFilterByStatus = normalizedFilters.status && normalizedFilters.status !== "all";
        const filteredItems = shouldFilterByStatus
          ? mappedItems.filter((item) => item.status === normalizedFilters.status)
          : mappedItems;
        let updatedStatuses = Array.isArray(current.availableStatuses)
          ? new Set(current.availableStatuses.map((status) => (typeof status === "string" ? status.toLowerCase() : status)))
          : new Set();
        mappedItems.forEach((item) => {
          if (item?.status) {
            updatedStatuses.add(item.status);
          }
        });
        if (shouldFilterByStatus && !filteredItems.some((item) => item.status === normalizedFilters.status)) {
          updatedStatuses.delete(normalizedFilters.status);
        }
        const pagination = current.pagination
          ? {
              ...current.pagination,
              totalItems:
                shouldFilterByStatus && current.pagination.totalItems != null
                  ? Math.max(current.pagination.totalItems - 1, 0)
                  : current.pagination.totalItems,
            }
          : current.pagination;
        return {
          ...current,
          items: filteredItems,
          availableStatuses: Array.from(updatedStatuses),
          pagination,
        };
      });
      return { previous, key };
    },
    onError: (mutationError, variables, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error(getErrorMessage(mutationError, "Failed to approve payment."));
    },
    onSuccess: (data, { payment }) => {
      const message = data?.message ?? `Payment ${payment.reference} approved.`;
      toast.success(message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.payments() });
    },
  });

  const approvingId = approvePaymentMutation.isPending
    ? approvePaymentMutation.variables?.payment?.id ?? null
    : null;

  const handleApprove = (payment) => {
    if (!payment?.userId || !payment?.planId || !(payment?.paymentId ?? payment?.id)) {
      toast.error("Payment record is missing required identifiers.");
      return;
    }
    approvePaymentMutation.mutate({ payment, filters });
  };

  const formatStatusLabel = (value) => {
    if (!value || value === "all") return "All";
    return value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const errorMessage = isError ? getErrorMessage(error, "Failed to load payments.") : null;
  const showPaginationSummary = !isLoading && !errorMessage && pagination?.totalItems != null;
  const isRefetching = isFetching && !isLoading;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments"
        description="Review and approve manual payment submissions from customers."
      />
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xs gap-2">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isRefetching ? (
            <p className="text-xs text-muted-foreground">Refreshing…</p>
          ) : null}
        </CardContent>
      </Card>
      {showPaginationSummary ? (
        <p className="text-sm text-muted-foreground">
          Showing {payments.length} {filters.status ? `${formatStatusLabel(filters.status).toLowerCase()} ` : ""}payments
          {typeof pagination.totalItems === "number" ? ` (of ${pagination.totalItems})` : ""}.
        </p>
      ) : null}
      {errorMessage ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <PaymentsTable
          payments={payments}
          isLoading={isLoading}
          approvingId={approvingId}
          onApprove={handleApprove}
        />
      )}
    </div>
  );
}
