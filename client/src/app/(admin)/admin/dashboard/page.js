// File: src/app/(admin)/admin/dashboard/page.js
"use client";

import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminPlansOptions } from "@/lib/queries/admin-plans";
import { adminPaymentsOptions } from "@/lib/queries/admin-payments";
import { adminUsersOptions } from "@/lib/queries/admin-users";

const toStringSafe = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value ?? "");
};

const normalizeIdentifier = (value) => {
  if (value == null) return "";
  return toStringSafe(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
};

const expandIdentifierVariants = (...values) => {
  const variants = new Set();

  values
    .flat()
    .map(normalizeIdentifier)
    .filter(Boolean)
    .forEach((value) => {
      variants.add(value);

      const condensed = value.replace(/[^a-z0-9]/g, "");
      if (condensed && condensed !== value) {
        variants.add(condensed);
      }

      const tokens = value.split(/[^a-z0-9]+/).filter(Boolean);
      if (tokens.length) {
        tokens.forEach((token) => variants.add(token));
      }
      if (tokens.length > 1) {
        variants.add(tokens.join(" "));
        variants.add(tokens.join(""));
      }

      if (value.endsWith("s") && value.length > 1) {
        variants.add(value.slice(0, -1));
      }
    });

  return variants;
};

const identifiersIntersect = (left, right) => {
  for (const item of left) {
    if (right.has(item)) return true;
  }
  return false;
};

const formatCurrency = (amount, currency) => {
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

const formatStatus = (status, fallback) => {
  if (!status) return fallback;
  return status
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

// Admin dashboard summarizing platform-wide stats.
export default function AdminDashboardPage() {
  const { data: plans = [] } = useQuery(adminPlansOptions());
  const { data: pendingPaymentsData } = useQuery(adminPaymentsOptions({ status: "pending" }));
  const { data: recentPaymentsData } = useQuery(adminPaymentsOptions());
  const { data: usersData } = useQuery(adminUsersOptions());
  const users = usersData?.items ?? [];

  const pendingPayments = pendingPaymentsData?.items ?? [];
  const pendingPaymentsCount = pendingPaymentsData?.pagination?.totalItems ?? pendingPayments.length;
  const recentPayments = recentPaymentsData?.items ?? [];

  const normalizedUsers = users.map((user) => ({
    user,
    identifiers: expandIdentifierVariants(
      user.planSlug,
      user.planName,
      user.plan,
      user.planId,
      user.subscriptionStatus
    ),
  }));

  const planIdentifierEntries = plans.map((plan) => ({
    plan,
    identifiers: expandIdentifierVariants(plan?.slug, plan?.name, plan?.id),
  }));

  const usersByPlan = planIdentifierEntries.map(({ plan, identifiers }) => {
    const planUsers = normalizedUsers
      .filter(({ identifiers: userIdentifiers }) =>
        identifiers.size && userIdentifiers.size && identifiersIntersect(identifiers, userIdentifiers)
      )
      .map(({ user }) => user);

    return {
      plan,
      users: planUsers,
    };
  });

  const unmatchedUsers = normalizedUsers
    .filter(({ identifiers }) => {
      if (!identifiers.size) return true;
      return !planIdentifierEntries.some(
        ({ identifiers: planIdentifiers }) =>
          planIdentifiers.size && identifiersIntersect(planIdentifiers, identifiers)
      );
    })
    .map(({ user }) => user);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Overview"
        description="Monitor system metrics, pending approvals, and high-level adoption."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{users.length}</p>
            <p className="text-sm text-muted-foreground">Across all plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{plans.length}</p>
            <p className="text-sm text-muted-foreground">Configured in the catalog</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{pendingPaymentsCount}</p>
            <p className="text-sm text-muted-foreground">Require manual approval</p>
          </CardContent>
        </Card>
        {usersByPlan.map(({ plan, users: planUsers }) => {
          const title = plan?.name || plan?.slug || "Unnamed plan";
          const subtitle = plan?.slug && plan?.slug !== plan?.name ? plan.slug : null;
          const moreCount = Math.max(planUsers.length - 5, 0);

          return (
            <Card key={plan?.id ?? plan?.slug ?? title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                {subtitle ? (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{planUsers.length}</p>
                <p className="text-sm text-muted-foreground">
                  {planUsers.length === 1 ? "User on this plan" : "Users on this plan"}
                </p>
                <div className="mt-4 space-y-3">
                  {planUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users currently assigned.</p>
                  ) : (
                    <>
                      {planUsers.slice(0, 5).map((user) => {
                        const identifier =
                          user.fullName || user.username || user.email || "Unknown user";

                        return (
                          <div key={user.id ?? `${user.email ?? identifier}-${plan?.slug ?? title}`}>
                            <div className="text-sm font-medium leading-tight">{identifier}</div>
                            {user.email ? (
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            ) : null}
                          </div>
                        );
                      })}
                      {moreCount > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          +{moreCount} more {moreCount === 1 ? "user" : "users"}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {unmatchedUsers.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Unassigned Plan</CardTitle>
              <p className="text-sm text-muted-foreground">
                Users without a matching catalog plan
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{unmatchedUsers.length}</p>
              <p className="text-sm text-muted-foreground">
                {unmatchedUsers.length === 1 ? "User" : "Users"} without catalog mapping
              </p>
              <div className="mt-4 space-y-3">
                {unmatchedUsers.slice(0, 5).map((user) => {
                  const identifier = user.fullName || user.username || user.email || "Unknown user";

                  return (
                    <div key={user.id ?? `${user.email ?? identifier}-unassigned`}>
                      <div className="text-sm font-medium leading-tight">{identifier}</div>
                      {user.email ? (
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      ) : null}
                    </div>
                  );
                })}
                {unmatchedUsers.length > 5 ? (
                  <p className="text-xs text-muted-foreground">
                    +{unmatchedUsers.length - 5} more {unmatchedUsers.length - 5 === 1 ? "user" : "users"}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent manual payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                {recentPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.reference}</TableCell>
                    <TableCell>
                      <div className="font-medium">{payment.userName || "Unknown user"}</div>
                      {payment.userEmail ? (
                        <div className="text-xs text-muted-foreground">{payment.userEmail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                    <TableCell>{payment.statusLabel || formatStatus(payment.status, "Unknown")}</TableCell>
                    <TableCell>{formatDateTime(payment.submittedAt)}</TableCell>
                  </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
