// File: src/app/(admin)/admin/user-management/page.js
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import UserTable from "@/components/features/admin/user-table";
import CreateUserDialog from "@/components/features/admin/create-user-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminUsersOptions, formatAdminUserStatus } from "@/lib/queries/admin-users";

const getErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err?.body === "string") return err.body;
  if (err?.body?.message) return err.body.message;
  if (err?.message) return err.message;
  return fallback;
};

// Administrative user list with search, server-backed filtering, and navigation to detail view.
export default function AdminUserManagementPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery(
    adminUsersOptions(statusFilter === "all" ? {} : { status: statusFilter })
  );

  const users = data?.items ?? [];
  const statusOptions = useMemo(() => {
    const set = new Set(["all"]);
    (data?.availableStatuses ?? []).forEach((status) => {
      if (!status) return;
      set.add(String(status));
    });
    if (statusFilter) set.add(statusFilter);
    return Array.from(set);
  }, [data?.availableStatuses, statusFilter]);

  const errorMessage = isError ? getErrorMessage(error, "Failed to load users.") : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="User management"
        description="Search, filter, and inspect customer accounts."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>Create user</Button>
        }
      />
      <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Accounts</h2>
              <p className="text-sm text-muted-foreground">
                {users.length} user{users.length === 1 ? "" : "s"}
                {statusFilter !== "all" && statusFilter ? ` • ${formatAdminUserStatus(statusFilter) ?? statusFilter}` : ""}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-sm text-muted-foreground sm:text-right">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "all" ? "All statuses" : formatAdminUserStatus(status) || status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading users…</div>
          ) : (
            <UserTable
              users={users}
              onViewProfile={(user) => router.push(`/admin/user-management/${user.id}`)}
            />
          )}

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
