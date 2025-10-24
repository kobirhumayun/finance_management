// File: src/app/(user)/profile/page.js
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import CashFlowChart from "@/components/features/reports/cash-flow-chart";
import PageHeader from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { formatCurrencyWithCode, formatNumber } from "@/lib/formatters";
import { qk } from "@/lib/query-keys";
import {
  listSelfOrders,
  selfProfileQueryOptions,
  selfSettingsQueryOptions,
  updateSelfProfile,
} from "@/lib/queries/self";

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long")
    .max(30, "Username cannot exceed 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores are allowed."),
  firstName: z
    .string()
    .trim()
    .max(50, "First name must be 50 characters or fewer")
    .optional()
    .or(z.literal("")),
  lastName: z
    .string()
    .trim()
    .max(50, "Last name must be 50 characters or fewer")
    .optional()
    .or(z.literal("")),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name cannot be empty")
    .max(80, "Display name must be 80 characters or fewer")
    .optional()
    .or(z.literal("")),
  profilePictureUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
});

const ORDER_PAGE_SIZE = 10;

const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (error.body) {
    if (typeof error.body === "string") return error.body;
    if (typeof error.body?.message === "string") return error.body.message;
    if (Array.isArray(error.body?.errors) && error.body.errors.length > 0) {
      const [first] = error.body.errors;
      if (first?.msg) return first.msg;
      if (first?.message) return first.message;
    }
  }
  return error.message || fallback;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatStatus = (status) => {
  if (!status) return "Unknown";
  return status
    .toString()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
};

const resolveStatusVariant = (status) => {
  const normalized = status?.toString().toLowerCase();
  switch (normalized) {
    case "active":
      return "secondary";
    case "trial":
    case "trialing":
      return "default";
    case "cancelled":
    case "canceled":
    case "expired":
      return "outline";
    default:
      return "outline";
  }
};

const mapProfileValuesToPayload = (values) => ({
  username: values.username,
  firstName: values.firstName ?? "",
  lastName: values.lastName ?? "",
  displayName: values.displayName ?? "",
  profilePictureUrl: values.profilePictureUrl ?? "",
});

const applyOptimisticProfile = (current, values) => {
  if (!current) return current;

  const firstName = values.firstName ?? "";
  const lastName = values.lastName ?? "";
  const displayName = values.displayName?.trim();
  const computedDisplayName =
    displayName || [firstName, lastName].filter(Boolean).join(" ") || values.username;

  return {
    ...current,
    username: values.username,
    firstName,
    lastName,
    displayName: computedDisplayName,
    profilePictureUrl: values.profilePictureUrl ?? "",
  };
};

const buildMonthlyOrderSeries = (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) {
    return [];
  }

  const monthlyMap = new Map();

  for (const order of orders) {
    const dateValue = order.createdAt || order.startDate || order.endDate;
    if (!dateValue) continue;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const existing = monthlyMap.get(monthKey) || {
      month: new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
      }).format(date),
      total: 0,
    };

    existing.total += Number(order.amount) || 0;
    monthlyMap.set(monthKey, existing);
  }

  return Array.from(monthlyMap.entries())
    .sort((a, b) => {
      const [aKey] = a;
      const [bKey] = b;
      return aKey.localeCompare(bKey);
    })
    .map(([, value]) => ({
      month: value.month,
      cashIn: 0,
      cashOut: value.total,
    }));
};

// My Profile page powered by TanStack Query with optimistic updates and infinite order history.
export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [orderStatus, setOrderStatus] = useState("all");

  const [profileQuery, settingsQuery] = useQueries({
    queries: [selfProfileQueryOptions(), selfSettingsQueryOptions()],
  });

  const profile = profileQuery.data;
  const settings = settingsQuery.data;

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      displayName: "",
      profilePictureUrl: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        username: profile.username ?? "",
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        displayName: profile.displayName ?? "",
        profilePictureUrl: profile.profilePictureUrl ?? "",
      });
    }
  }, [profile, form]);

  const updateProfileMutation = useMutation({
    mutationFn: (values) => updateSelfProfile(values),
    onMutate: async (values) => {
      const submission = mapProfileValuesToPayload(values);
      const queryKey = qk.self.profile();
      await queryClient.cancelQueries({ queryKey });
      const previousProfile = queryClient.getQueryData(queryKey);
      if (previousProfile) {
        const optimistic = applyOptimisticProfile(previousProfile, submission);
        queryClient.setQueryData(queryKey, optimistic);
      }
      return { previousProfile, queryKey };
    },
    onError: (error, _values, context) => {
      if (context?.previousProfile && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousProfile);
      }
      toast.error(getErrorMessage(error, "Unable to update your profile."));
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(qk.self.profile(), data);
      }
      toast.success("Profile updated successfully.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.self.profile() });
    },
  });

  const normalizedStatus = orderStatus === "all" ? undefined : orderStatus;
  const orderFilters = useMemo(
    () => ({
      status: normalizedStatus,
      limit: ORDER_PAGE_SIZE,
    }),
    [normalizedStatus]
  );

  const ordersQuery = useInfiniteQuery({
    queryKey: qk.self.orders.list(orderFilters),
    queryFn: ({ pageParam, signal }) =>
      listSelfOrders({ ...orderFilters, cursor: pageParam ?? undefined, signal }),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage?.pageInfo?.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
  });

  const orderPages = useMemo(() => ordersQuery.data?.pages ?? [], [ordersQuery.data]);
  const orders = useMemo(
    () =>
      orderPages.flatMap((page) => (Array.isArray(page?.orders) ? page.orders : [])).map((order) => ({
        ...order,
        amount: Number(order.amount) || 0,
      })),
    [orderPages]
  );

  const ordersSummary = useMemo(() => {
    if (!Array.isArray(orders) || orders.length === 0) {
      return {
        totalOrders: 0,
        activeOrders: 0,
        lifetimeSpend: 0,
      };
    }

    return orders.reduce(
      (acc, order) => {
        acc.totalOrders += 1;
        if (order.status?.toLowerCase() === "active") {
          acc.activeOrders += 1;
        }
        acc.lifetimeSpend += Number(order.amount) || 0;
        return acc;
      },
      { totalOrders: 0, activeOrders: 0, lifetimeSpend: 0 }
    );
  }, [orders]);

  const monthlySeries = useMemo(() => buildMonthlyOrderSeries(orders), [orders]);

  const handleSubmit = form.handleSubmit((values) => {
    updateProfileMutation.mutate(mapProfileValuesToPayload(values));
  });

  const isProfileLoading = profileQuery.isLoading || profileQuery.isFetching;
  const profileError = profileQuery.error;

  const ordersError = ordersQuery.error;
  const isOrdersLoading = ordersQuery.isLoading && orders.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="My profile"
        description="Update how you appear in the app and review your subscription activity."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {getErrorMessage(profileError, "We couldn't load your profile. Try refreshing the page.")}
              </div>
            ) : null}
            <Form {...form}>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="janedoe" disabled={updateProfileMutation.isPending || isProfileLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane D." disabled={updateProfileMutation.isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" disabled={updateProfileMutation.isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" disabled={updateProfileMutation.isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="profilePictureUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile image URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://images.example.com/avatar.jpg"
                          disabled={updateProfileMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={updateProfileMutation.isPending || isProfileLoading}
                  >
                    Reset
                  </Button>
                  <Button type="submit" disabled={updateProfileMutation.isPending || isProfileLoading}>
                    {updateProfileMutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{profile?.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email verified</span>
                <Badge variant={settings?.isEmailVerified ? "secondary" : "outline"}>
                  {settings?.isEmailVerified ? "Verified" : "Pending"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span>{formatDate(profile?.metadata?.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last sign-in</span>
                <span>{formatDate(settings?.lastLoginAt)}</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current plan</span>
                <span className="font-medium">{profile?.subscription?.plan?.name || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {profile?.subscription?.status ? (
                  <Badge variant={resolveStatusVariant(profile.subscription.status)}>
                    {formatStatus(profile.subscription.status)}
                  </Badge>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next renewal</span>
                <span>{formatDate(profile?.subscription?.endDate ?? profile?.subscription?.trialEndsAt)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href="/pricing">Manage subscription</Link>
            </Button>
            <Button asChild variant="link" className="px-0 text-sm">
              <Link href="/settings">Go to account settings</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Lifetime activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs uppercase text-muted-foreground">Total orders</p>
              <p className="text-2xl font-semibold">{formatNumber(ordersSummary.totalOrders, { fallback: "0" })}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs uppercase text-muted-foreground">Active</p>
              <p className="text-2xl font-semibold">{formatNumber(ordersSummary.activeOrders, { fallback: "0" })}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs uppercase text-muted-foreground">Lifetime spend</p>
              <p className="text-2xl font-semibold">
                {formatCurrencyWithCode(ordersSummary.lifetimeSpend, profile?.subscription?.plan?.currency || "BDT", {
                  fallback: "৳0",
                })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order value over time</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={monthlySeries} isLoading={ordersQuery.isLoading && monthlySeries.length === 0} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Order history</CardTitle>
            <p className="text-sm text-muted-foreground">
              Browse every subscription charge tied to your account with cursor-based pagination.
            </p>
          </div>
          <Select value={orderStatus} onValueChange={setOrderStatus}>
            <SelectTrigger size="sm" aria-label="Filter orders by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent align="end">
              {ORDER_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {ordersError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {getErrorMessage(ordersError, "We couldn't load your order history.")}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && !isOrdersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No orders yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {orders.map((order) => (
                  <TableRow key={order.id ?? order.orderNumber}>
                    <TableCell className="font-medium">{order.orderNumber || "—"}</TableCell>
                    <TableCell>{order.plan?.name || "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyWithCode(order.amount, order.currency || profile?.subscription?.plan?.currency || "BDT")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={resolveStatusVariant(order.status)}>{formatStatus(order.status)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {isOrdersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      Loading orders...
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {ordersQuery.hasNextPage
              ? "Scroll through your historical invoices as needed."
              : "You've reached the end of your order history."}
          </p>
          <Button
            variant="outline"
            onClick={() => ordersQuery.fetchNextPage()}
            disabled={!ordersQuery.hasNextPage || ordersQuery.isFetchingNextPage}
          >
            {ordersQuery.isFetchingNextPage ? "Loading..." : ordersQuery.hasNextPage ? "Load more" : "All caught up"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
