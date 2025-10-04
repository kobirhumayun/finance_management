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
      <div className="rounded-lg border">
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
        {!filteredUsers.length && (
          <p className="p-4 text-sm text-muted-foreground">No users match the current search filter.</p>
        )}
      </div>
    </div>
  );
}
