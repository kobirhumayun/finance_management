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

const STOP_WORDS = new Set([
  "plan",
  "plans",
  "account",
  "accounts",
  "user",
  "users",
  "tier",
  "tiers",
  "package",
  "packages",
  "subscription",
  "subscriptions",
]);

const expandIdentifierVariants = (...values) => {
  const variants = new Set();

  const addVariant = (value) => {
    if (!value || STOP_WORDS.has(value)) {
      return;
    }
    variants.add(value);
  };

  values
    .flat()
    .map(normalizeIdentifier)
    .filter(Boolean)
    .forEach((value) => {
      addVariant(value);

      const condensed = value.replace(/[^a-z0-9]/g, "");
      if (condensed && condensed !== value) {
        addVariant(condensed);
      }

      const tokens = value
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter(Boolean);

      if (tokens.length) {
        tokens.forEach((token) => {
          if (token.length > 1) {
            addVariant(token);
          }
        });
      }

      const meaningfulTokens = tokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token));

      if (meaningfulTokens.length > 1) {
        addVariant(meaningfulTokens.join(" "));
        addVariant(meaningfulTokens.join(""));
      }

      if (value.endsWith("s") && value.length > 1) {
        addVariant(value.slice(0, -1));
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

  const publicPlansCount = plans.filter((plan) => Boolean(plan?.isPublic)).length;

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

  const usersByRole = (() => {
    const roleMap = new Map();

    normalizedUsers.forEach(({ user }) => {
      const rawRole = toStringSafe(user.role)?.trim() || null;
      const normalizedKey = normalizeIdentifier(rawRole)
        ?.replace(/[^a-z0-9]+/g, "-")
        ?.replace(/^-+|-+$/g, "");
      const key = normalizedKey || "__unassigned__";
      const existing = roleMap.get(key);

      if (existing) {
        if (!existing.role && rawRole) {
          existing.role = rawRole;
          existing.label = formatStatus(rawRole, rawRole);
        }
        existing.users.push(user);
        return;
      }

      roleMap.set(key, {
        key,
        role: rawRole,
        label: formatStatus(rawRole, rawRole || "Unassigned Role"),
        users: [user],
      });
    });

    return Array.from(roleMap.values());
  })();

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

      <section
        className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
        aria-labelledby="admin-dashboard-overview"
      >
        <div className="border-b border-border px-6 py-4">
          <div className="space-y-1">
            <h2 id="admin-dashboard-overview" className="text-xl font-semibold">
              Overview
            </h2>
            <p className="text-sm text-muted-foreground">
              High-level metrics that highlight platform activity and engagement.
            </p>
          </div>
        </div>
        <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2 xl:grid-cols-3">
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
              <p className="text-3xl font-semibold">{publicPlansCount}</p>
              <p className="text-sm text-muted-foreground">Publicly accessible plans</p>
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
        </div>
      </section>

      <section
        className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
        aria-labelledby="admin-dashboard-users-by-role"
      >
        <div className="border-b border-border px-6 py-4">
          <div className="space-y-1">
            <h2 id="admin-dashboard-users-by-role" className="text-xl font-semibold">
              Users by Role
            </h2>
            <p className="text-sm text-muted-foreground">
              Understand how access is distributed across administrator roles.
            </p>
          </div>
        </div>
        <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2 xl:grid-cols-4">
          {usersByRole.map(({ key, label, users: roleUsers }) => (
            <Card key={`role-${key}`}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{roleUsers.length}</p>
                <p className="text-sm text-muted-foreground">
                  {roleUsers.length === 1 ? "User with this role" : "Users with this role"}
                </p>
                {roleUsers.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No users currently assigned.</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
        aria-labelledby="admin-dashboard-subscribed-user-count"
      >
        <div className="border-b border-border px-6 py-4">
          <div className="space-y-1">
            <h2 id="admin-dashboard-subscribed-user-count" className="text-xl font-semibold">
              Subscribed User Count
            </h2>
            <p className="text-sm text-muted-foreground">
              Review plan adoption, availability, and any users without a catalog match.
            </p>
          </div>
        </div>
        <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2 xl:grid-cols-4">
          {usersByPlan.map(({ plan, users: planUsers }) => {
            const title = plan?.name || plan?.slug || "Unnamed plan";
            const subtitle = plan?.slug && plan?.slug !== plan?.name ? plan.slug : null;

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
                  <p className="mt-2 text-sm text-muted-foreground">
                    Availability: {plan?.isPublic ? "Publicly available" : "Not publicly available"}
                  </p>
                  {planUsers.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">No users currently assigned.</p>
                  ) : null}
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
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
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
                {recentPayments.map((payment) => {
                  const statusLabel = payment.statusLabel || formatStatus(payment.status, "Unknown");
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

                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.reference}</TableCell>
                      <TableCell>
                        <div className="font-medium">{payment.userName || "Unknown user"}</div>
                        {payment.userEmail ? (
                          <div className="text-xs text-muted-foreground">{payment.userEmail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span>{statusLabel}</span>
                          {hasReviewComment ? (
                            <p className="text-xs text-muted-foreground break-words">&ldquo;{reviewComment}&rdquo;</p>
                          ) : null}
                          {reviewMeta ? (
                            <p className="text-xs text-muted-foreground">{reviewMeta}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(payment.submittedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
