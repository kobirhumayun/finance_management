// File: src/app/(admin)/admin/payments/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import PaymentsTable from "@/components/features/admin/payments-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { qk } from "@/lib/query-keys";
import { toast } from "@/components/ui/sonner";
import {
  adminPaymentsInfiniteOptions,
  approveAdminPayment,
  rejectAdminPayment,
} from "@/lib/queries/admin-payments";
import { formatNumber } from "@/lib/formatters";

// Payments moderation view for administrators.
export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [paymentToReject, setPaymentToReject] = useState(null);
  const [rejectComment, setRejectComment] = useState("");

  const filters = useMemo(() => {
    if (!statusFilter || statusFilter === "all") return {};
    return { status: statusFilter };
  }, [statusFilter]);

  const PAGE_SIZE = 20;

  const paginatedFilters = useMemo(() => ({ ...filters, limit: PAGE_SIZE }), [filters]);

  const {
    data: paymentsPages,
    isLoading,
    isError,
    error,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(adminPaymentsInfiniteOptions(paginatedFilters));

  const payments = useMemo(() => {
    if (!paymentsPages?.pages?.length) return [];
    return paymentsPages.pages.flatMap((page) =>
      Array.isArray(page?.items) ? page.items : []
    );
  }, [paymentsPages]);

  const pagination = useMemo(() => {
    if (!paymentsPages?.pages?.length) return null;
    const lastPage = paymentsPages.pages[paymentsPages.pages.length - 1];
    return lastPage?.pagination ?? paymentsPages.pages[0]?.pagination ?? null;
  }, [paymentsPages]);

  const availableStatuses = useMemo(() => {
    const statusSet = new Set();
    paymentsPages?.pages?.forEach((page) => {
      if (Array.isArray(page?.availableStatuses)) {
        page.availableStatuses.forEach((status) => {
          if (typeof status === "string" && status.trim()) {
            statusSet.add(status.trim().toLowerCase());
          }
        });
      }
      if (Array.isArray(page?.items)) {
        page.items.forEach((item) => {
          if (item?.status) {
            statusSet.add(item.status);
          }
        });
      }
    });
    return Array.from(statusSet);
  }, [paymentsPages]);

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
      const normalizedFilters =
        normalizedStatus && normalizedStatus !== "all"
          ? { status: normalizedStatus, limit: PAGE_SIZE }
          : { limit: PAGE_SIZE };
      const key = qk.admin.payments(normalizedFilters);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (current) => {
        if (!current) return current;

        const shouldFilterByStatus =
          normalizedFilters.status && normalizedFilters.status !== "all";

        const updateItems = (items = []) =>
          items.map((item) =>
            item.id === payment.id
              ? { ...item, status: "approved", statusLabel: "Approved", canApprove: false }
              : item
          );

        const filterItems = (items = []) =>
          shouldFilterByStatus
            ? items.filter((item) => item.status === normalizedFilters.status)
            : items;

        const mapStatuses = (items = []) => {
          const statuses = new Set();
          items.forEach((item) => {
            if (item?.status) {
              statuses.add(item.status);
            }
          });
          return statuses;
        };

        if (Array.isArray(current.pages)) {
          const updatedPages = current.pages.map((page) => {
            if (!page) return page;
            const mappedItems = updateItems(Array.isArray(page.items) ? page.items : []);
            const filteredItems = filterItems(mappedItems);
            const updatedStatuses = Array.isArray(page.availableStatuses)
              ? new Set(
                  page.availableStatuses.map((status) =>
                    typeof status === "string" ? status.toLowerCase() : status
                  )
                )
              : new Set();
            mapStatuses(mappedItems).forEach((status) => updatedStatuses.add(status));
            if (
              shouldFilterByStatus &&
              !filteredItems.some((item) => item.status === normalizedFilters.status)
            ) {
              updatedStatuses.delete(normalizedFilters.status);
            }
            return {
              ...page,
              items: filteredItems,
              availableStatuses: Array.from(updatedStatuses),
            };
          });
          return {
            ...current,
            pages: updatedPages,
          };
        }

        const items = Array.isArray(current.items) ? current.items : [];
        const mappedItems = updateItems(items);
        const filteredItems = filterItems(mappedItems);
        let updatedStatuses = Array.isArray(current.availableStatuses)
          ? new Set(
              current.availableStatuses.map((status) =>
                typeof status === "string" ? status.toLowerCase() : status
              )
            )
          : new Set();
        mapStatuses(mappedItems).forEach((status) => updatedStatuses.add(status));
        if (
          shouldFilterByStatus &&
          !filteredItems.some((item) => item.status === normalizedFilters.status)
        ) {
          updatedStatuses.delete(normalizedFilters.status);
        }
        return {
          ...current,
          items: filteredItems,
          availableStatuses: Array.from(updatedStatuses),
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

  const rejectPaymentMutation = useMutation({
    mutationFn: ({ payment, comment }) =>
      rejectAdminPayment({
        appliedUserId: payment.userId,
        paymentId: payment.paymentId ?? payment.id,
        comment,
      }),
    onMutate: async ({ payment, comment, filters: activeFilters }) => {
      const normalizedStatus =
        activeFilters && typeof activeFilters.status === "string"
          ? activeFilters.status.trim().toLowerCase()
          : undefined;
      const normalizedFilters =
        normalizedStatus && normalizedStatus !== "all"
          ? { status: normalizedStatus, limit: PAGE_SIZE }
          : { limit: PAGE_SIZE };
      const key = qk.admin.payments(normalizedFilters);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      const trimmedComment = typeof comment === "string" ? comment.trim() : "";
      const commentValue = trimmedComment ? trimmedComment : null;
      const optimisticReviewedAt = new Date().toISOString();

      queryClient.setQueryData(key, (current) => {
        if (!current) return current;
        const shouldFilterByStatus =
          normalizedFilters.status && normalizedFilters.status !== "all";

        const updateItems = (items = []) =>
          items.map((item) =>
            item.id === payment.id
              ? {
                  ...item,
                  status: "rejected",
                  statusLabel: "Rejected",
                  canApprove: false,
                  canReject: false,
                  reviewComment: commentValue,
                  reviewedAt: optimisticReviewedAt,
                }
              : item
          );

        const filterItems = (items = []) =>
          shouldFilterByStatus
            ? items.filter((item) => item.status === normalizedFilters.status)
            : items;

        const mapStatuses = (items = []) => {
          const statuses = new Set();
          items.forEach((item) => {
            if (item?.status) {
              statuses.add(item.status);
            }
          });
          return statuses;
        };

        if (Array.isArray(current.pages)) {
          const updatedPages = current.pages.map((page) => {
            if (!page) return page;
            const mappedItems = updateItems(Array.isArray(page.items) ? page.items : []);
            const filteredItems = filterItems(mappedItems);
            const updatedStatuses = Array.isArray(page.availableStatuses)
              ? new Set(
                  page.availableStatuses.map((status) =>
                    typeof status === "string" ? status.toLowerCase() : status
                  )
                )
              : new Set();
            mapStatuses(mappedItems).forEach((status) => updatedStatuses.add(status));
            if (
              shouldFilterByStatus &&
              !filteredItems.some((item) => item.status === normalizedFilters.status)
            ) {
              updatedStatuses.delete(normalizedFilters.status);
            }
            return {
              ...page,
              items: filteredItems,
              availableStatuses: Array.from(updatedStatuses),
            };
          });
          return {
            ...current,
            pages: updatedPages,
          };
        }

        const items = Array.isArray(current.items) ? current.items : [];
        const mappedItems = updateItems(items);
        const filteredItems = filterItems(mappedItems);
        let updatedStatuses = Array.isArray(current.availableStatuses)
          ? new Set(
              current.availableStatuses.map((status) =>
                typeof status === "string" ? status.toLowerCase() : status
              )
            )
          : new Set();
        mapStatuses(mappedItems).forEach((status) => updatedStatuses.add(status));
        if (
          shouldFilterByStatus &&
          !filteredItems.some((item) => item.status === normalizedFilters.status)
        ) {
          updatedStatuses.delete(normalizedFilters.status);
        }
        return {
          ...current,
          items: filteredItems,
          availableStatuses: Array.from(updatedStatuses),
        };
      });

      return { previous, key };
    },
    onError: (mutationError, variables, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error(getErrorMessage(mutationError, "Failed to reject payment."));
    },
    onSuccess: (data, { payment }) => {
      const message = data?.message ?? `Payment ${payment.reference} rejected.`;
      toast.success(message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.payments() });
    },
  });

  const approvingId = approvePaymentMutation.isPending
    ? approvePaymentMutation.variables?.payment?.id ?? null
    : null;

  const rejectingId = rejectPaymentMutation.isPending
    ? rejectPaymentMutation.variables?.payment?.id ?? null
    : null;

  const handleApprove = (payment) => {
    if (!payment?.userId || !payment?.planId || !(payment?.paymentId ?? payment?.id)) {
      toast.error("Payment record is missing required identifiers.");
      return;
    }
    approvePaymentMutation.mutate({ payment, filters: paginatedFilters });
  };

  const handleRejectIntent = (payment) => {
    if (!payment?.userId || !(payment?.paymentId ?? payment?.id)) {
      toast.error("Payment record is missing required identifiers.");
      return;
    }
    if (rejectPaymentMutation.isPending) {
      toast.error("Please wait for the current rejection to finish.");
      return;
    }
    setPaymentToReject(payment);
    setRejectComment(typeof payment.reviewComment === "string" ? payment.reviewComment : "");
    setRejectDialogOpen(true);
  };

  const handleRejectDialogChange = (open) => {
    setRejectDialogOpen(open);
    if (!open) {
      setPaymentToReject(null);
      setRejectComment("");
    }
  };

  const handleRejectConfirm = () => {
    if (!paymentToReject) {
      setRejectDialogOpen(false);
      return;
    }
    if (rejectPaymentMutation.isPending) {
      return;
    }
    if (!paymentToReject.userId || !(paymentToReject.paymentId ?? paymentToReject.id)) {
      toast.error("Payment record is missing required identifiers.");
      return;
    }
    const trimmedComment = rejectComment.trim();
    rejectPaymentMutation.mutate({
      payment: paymentToReject,
      comment: trimmedComment ? trimmedComment : undefined,
      filters: paginatedFilters,
    });
    setRejectDialogOpen(false);
    setPaymentToReject(null);
    setRejectComment("");
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
  const isRefetching = isFetching && !isLoading && !isFetchingNextPage;

  return (
    <>
      <Dialog open={isRejectDialogOpen} onOpenChange={handleRejectDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>
              {paymentToReject
                ? `Add an optional note before rejecting payment ${paymentToReject.reference ?? paymentToReject.id}.`
                : "Add an optional note before rejecting a payment."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-payment-reject-comment">Comment (optional)</Label>
            <Textarea
              id="admin-payment-reject-comment"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Let the requester know why this payment was rejected."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleRejectDialogChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectPaymentMutation.isPending}
            >
              {rejectPaymentMutation.isPending ? "Rejecting…" : "Reject payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            Showing
            {" "}
            {formatNumber(payments.length, {
              fallback: "0",
              minimumFractionDigits: 0,
            })}{" "}
            {filters.status ? `${formatStatusLabel(filters.status).toLowerCase()} ` : ""}payments
            {typeof pagination.totalItems === "number"
              ? ` (of ${formatNumber(pagination.totalItems, {
                  fallback: "0",
                  minimumFractionDigits: 0,
                })})`
              : ""}
            .
          </p>
        ) : null}
        {errorMessage ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : (
          <div className="space-y-4">
            <PaymentsTable
              payments={payments}
              isLoading={isLoading}
              approvingId={approvingId}
              rejectingId={rejectingId}
              onApprove={handleApprove}
              onReject={handleRejectIntent}
            />
            {hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading more…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
