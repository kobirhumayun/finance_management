// File: src/components/features/admin/user-table.js
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const toSearchable = (value) => {
  if (value == null) return "";
  return String(value).toLowerCase();
};

// Table of users with quick search and navigation to profiles.
export default function UserTable({ users = [], onViewProfile }) {
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const normalizedUsers = Array.isArray(users) ? users : [];
    const term = search.trim().toLowerCase();
    if (!term) return normalizedUsers;
    return normalizedUsers.filter((user) => {
      const fields = [
        user.username,
        user.email,
        user.fullName,
        user.planName,
        user.plan,
        user.statusLabel,
        user.role,
      ];
      return fields.some((value) => toSearchable(value).includes(term));
    });
  }, [users, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Users</h2>
        <Input
          className="w-full sm:max-w-xs"
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {!filteredUsers.length ? (
        <p className="text-sm text-muted-foreground">No users match the current search filter.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredUsers.map((user) => (
              <div
                key={user.id ?? user.username ?? user.email}
                className="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-tight">{user.username || "—"}</p>
                    {user.fullName ? (
                      <p className="text-xs text-muted-foreground">{user.fullName}</p>
                    ) : null}
                    {user.email ? (
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    ) : null}
                  </div>
                  {user.statusLabel ? (
                    <Badge variant={user.isActive ? "default" : "secondary"}>{user.statusLabel}</Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">Plan</p>
                    <p className="text-sm text-foreground">{user.planName || user.plan || "—"}</p>
                    {user.subscriptionStatusLabel ? <p>{user.subscriptionStatusLabel}</p> : null}
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-xs font-medium text-foreground">Joined</p>
                    <p className="text-sm text-foreground">{user.registeredAtLabel || user.registeredAt || "—"}</p>
                    {user.isActiveLabel ? <p>{user.isActiveLabel}</p> : null}
                  </div>
                  {user.lastLoginAtLabel ? (
                    <div className="col-span-2 space-y-0.5 border-t pt-3 text-right text-xs">
                      <p className="text-xs font-medium text-foreground">Last seen</p>
                      <p className="text-sm text-foreground">{user.lastLoginAtLabel}</p>
                    </div>
                  ) : null}
                </div>

                <Button className="w-full" variant="outline" onClick={() => onViewProfile?.(user)}>
                  View Profile
                </Button>
              </div>
            ))}
          </div>

          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id ?? user.username ?? user.email}>
                    <TableCell className="font-medium">
                      <div>{user.username || "—"}</div>
                      {user.fullName ? (
                        <div className="text-xs text-muted-foreground">{user.fullName}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {user.email || "—"}
                      {user.lastLoginAtLabel ? (
                        <div className="text-xs text-muted-foreground">Last seen {user.lastLoginAtLabel}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div>{user.planName || user.plan || "—"}</div>
                      {user.subscriptionStatusLabel ? (
                        <div className="text-xs text-muted-foreground">{user.subscriptionStatusLabel}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {user.statusLabel ? (
                        <Badge variant={user.isActive ? "default" : "secondary"}>{user.statusLabel}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {user.registeredAtLabel || user.registeredAt || "—"}
                      {user.isActiveLabel ? (
                        <div className="text-xs text-muted-foreground">{user.isActiveLabel}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => onViewProfile?.(user)}>
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
