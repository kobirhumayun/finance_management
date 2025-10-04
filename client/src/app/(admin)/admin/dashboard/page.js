// File: src/app/(admin)/admin/dashboard/page.js
"use client";

import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminPlansOptions } from "@/lib/queries/admin-plans";
import { adminPaymentsOptions } from "@/lib/queries/admin-payments";
import { adminUsersOptions } from "@/lib/queries/admin-users";

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
        <Card>
          <CardHeader>
            <CardTitle>Enterprise Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {
                users.filter((user) => {
                  const slug = user.planSlug?.toLowerCase();
                  const name = user.planName?.toLowerCase();
                  return slug === "enterprise" || name?.includes("enterprise");
                }).length
              }
            </p>
            <p className="text-sm text-muted-foreground">Managed by customer success</p>
          </CardContent>
        </Card>
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
