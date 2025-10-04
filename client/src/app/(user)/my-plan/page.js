// File: src/app/(user)/my-plan/page.js
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import PageHeader from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { myPlanQueryOptions } from "@/lib/queries/plans";

function formatCurrency(value, currency) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return "—";
  }
  if (numericValue === 0) {
    return "Free";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch (error) {
    return `${currency || ""} ${numericValue}`.trim();
  }
}

function formatBillingCycle(cycle) {
  if (!cycle) return "";
  return cycle
    .toString()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatStatus(status) {
  if (!status) return null;
  return status
    .toString()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

function resolveStatusVariant(status) {
  const normalized = status?.toString().toLowerCase();
  switch (normalized) {
    case "active":
      return "secondary";
    case "trial":
    case "trialing":
      return "default";
    case "expired":
    case "canceled":
    case "cancelled":
      return "outline";
    default:
      return "outline";
  }
}

function resolveUsageEntries(usage) {
  if (!usage || typeof usage !== "object") {
    return [];
  }

  return Object.entries(usage).filter(([key, value]) => {
    if (!key) return false;
    if (!value || typeof value !== "object") return false;
    const used = value.used ?? value.current ?? value.value ?? null;
    const limit = value.limit ?? value.max ?? value.capacity ?? null;
    return used !== null || limit !== null;
  });
}

// My Plan page highlighting subscription benefits and usage with real backend data.
export default function MyPlanPage() {
  const { data, isLoading, isError, error, refetch } = useQuery(myPlanQueryOptions());

  const plan = data?.plan ?? null;
  const status = data?.status ?? plan?.status ?? null;
  const billingCycleLabel = formatBillingCycle(plan?.billingCycle);
  const priceLabel = plan ? formatCurrency(plan.price, plan.currency) : "—";
  const formattedStatus = formatStatus(status);
  const statusVariant = resolveStatusVariant(status);
  const renewalDate = formatDate(data?.endDate ?? data?.renewalDate ?? plan?.endDate);
  const trialEndDate = formatDate(data?.trialEndsAt ?? plan?.trialEndsAt);
  const subscriptionStart = formatDate(data?.startDate ?? plan?.startDate);
  const usageEntries = useMemo(() => resolveUsageEntries(data?.usage), [data?.usage]);

  const errorMessage = (() => {
    if (!error) return null;
    if (error.body && typeof error.body === "object") {
      if (typeof error.body.message === "string") return error.body.message;
      if (typeof error.body.error === "string") return error.body.error;
    }
    return error.message || "Failed to load your subscription details.";
  })();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your subscription"
        description="Review the features available with your current plan and track usage."
      />
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>
              {isLoading ? "Loading plan..." : plan?.name || "No active subscription"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {plan?.description || "Upgrade for more capabilities and advanced analytics."}
            </p>
            {renewalDate ? (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Renews on {renewalDate}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {formattedStatus ? <Badge variant={statusVariant}>{formattedStatus}</Badge> : null}
            {billingCycleLabel ? (
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Billing cycle: {billingCycleLabel}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isError ? (
            <div className="flex flex-col gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <span>{errorMessage}</span>
              <div>
                <Button size="sm" variant="destructive" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-3xl font-semibold">{priceLabel}</p>
              {billingCycleLabel ? (
                <p className="text-sm text-muted-foreground">per {billingCycleLabel.toLowerCase()}</p>
              ) : null}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subscription started</span>
                <span>{subscriptionStart || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next renewal</span>
                <span>{renewalDate || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trial ends</span>
                <span>{trialEndDate || "—"}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Included features</h3>
            {plan && Array.isArray(plan.features) && plan.features.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No feature list available for this plan.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Usage overview</h3>
            {usageEntries.length > 0 ? (
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Capability</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageEntries.map(([key, value]) => {
                    const used = value.used ?? value.current ?? value.value ?? "—";
                    const limit = value.limit ?? value.max ?? value.capacity ?? "—";
                    return (
                      <TableRow key={key}>
                        <TableCell className="capitalize">{key.replace(/[_-]+/g, " ")}</TableCell>
                        <TableCell>{used}</TableCell>
                        <TableCell>{limit}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Usage details are not available.</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button asChild variant="outline">
              <Link href="/pricing">Change Plan</Link>
            </Button>
            <Button asChild>
              <Link href="mailto:sales@example.com?subject=Plan%20inquiry">Contact Sales</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
