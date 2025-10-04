// File: src/components/features/admin/create-user-dialog.js
"use client";

import { useEffect, useMemo } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { adminPlansOptions } from "@/lib/queries/admin-plans";
import { createAdminUser, normalizeAdminUser } from "@/lib/queries/admin-users";
import { qk } from "@/lib/query-keys";

const ROLE_OPTIONS = ["user", "admin", "editor", "support"];
const SUBSCRIPTION_STATUS_OPTIONS = ["active", "trialing", "canceled", "past_due", "pending", "free"];
const NONE_VALUE = "__none__";

const schema = z.object({
  username: z.string().min(3, "Username is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().optional(),
  planSlug: z.string().optional(),
  subscriptionStatus: z.string().optional(),
});

const defaultValues = {
  username: "",
  email: "",
  password: "",
  role: undefined,
  planSlug: undefined,
  subscriptionStatus: undefined,
};

const getErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err?.body === "string") return err.body;
  if (err?.body?.message) return err.body.message;
  if (err?.message) return err.message;
  return fallback;
};

// Dialog for provisioning a new admin-managed user account.
export default function CreateUserDialog({ open, onOpenChange }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const queryClient = useQueryClient();

  const { data: plansData = [] } = useQuery({
    ...adminPlansOptions(),
    enabled: open,
    placeholderData: (previous) => previous ?? [],
    select: (plans) => (Array.isArray(plans) ? plans : []),
  });

  const planLookup = useMemo(() => {
    const map = new Map();
    plansData.forEach((plan) => {
      if (!plan?.slug || typeof plan.slug !== "string") return;
      const slug = plan.slug.trim();
      if (!slug) return;
      map.set(slug, plan);
    });
    return map;
  }, [plansData]);

  const planSlugOptions = useMemo(() => {
    const set = new Set();
    plansData.forEach((plan) => {
      if (!plan?.slug || typeof plan.slug !== "string") return;
      if (!plan.isPublic) return;
      const slug = plan.slug.trim();
      if (!slug) return;
      set.add(slug);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [plansData]);

  const createUserMutation = useMutation({
    mutationFn: (input) => createAdminUser(input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: qk.admin.users(), exact: false });
      const queries = queryClient.getQueriesData({ queryKey: qk.admin.users(), exact: false });
      const tempId = `temp-${Date.now()}`;
      const planIdentifier = variables.planId ?? null;
      const selectedPlan = planIdentifier ? planLookup.get(planIdentifier) : null;
      const timestamp = new Date().toISOString();
      const optimisticRaw = {
        _id: tempId,
        id: tempId,
        username: variables.username,
        email: variables.email,
        role: variables.role ?? null,
        planId: planIdentifier,
        planSlug: selectedPlan?.slug ?? planIdentifier,
        plan: selectedPlan?.name ?? null,
        planName: selectedPlan?.name ?? null,
        subscriptionStatus: variables.subscriptionStatus ?? null,
        status: variables.subscriptionStatus ?? null,
        statusCode: variables.subscriptionStatus ?? null,
        isActive: true,
        registeredAt: timestamp,
        createdAt: timestamp,
      };
      const optimisticUser = normalizeAdminUser({ ...optimisticRaw, raw: optimisticRaw });

      const snapshots = queries.map(([key, data]) => {
        queryClient.setQueryData(key, (current) => {
          if (!current) {
            const availableStatuses = optimisticUser.statusCode ? [optimisticUser.statusCode] : [];
            return {
              items: [optimisticUser],
              pagination: null,
              availableStatuses,
              raw: undefined,
            };
          }

          const items = Array.isArray(current.items) ? [optimisticUser, ...current.items] : [optimisticUser];
          const statusSet = new Set(current.availableStatuses ?? []);
          if (optimisticUser.statusCode) {
            statusSet.add(optimisticUser.statusCode);
          }

          return {
            ...current,
            items,
            availableStatuses: Array.from(statusSet),
          };
        });
        return [key, data];
      });

      return { snapshots, tempId, optimisticUser };
    },
    onError: (error, _variables, context) => {
      context?.snapshots?.forEach(([key, previous]) => {
        queryClient.setQueryData(key, previous);
      });
      toast.error(getErrorMessage(error, "Failed to create user."));
    },
    onSuccess: (data, _variables, context) => {
      const normalized = data ? normalizeAdminUser({ ...data, raw: data }) : null;
      const replacement = normalized ?? context?.optimisticUser ?? null;

      if (replacement && context?.snapshots) {
        context.snapshots.forEach(([key]) => {
          queryClient.setQueryData(key, (current) => {
            if (!current?.items) return current;
            const filtered = current.items.filter((item) => item.id !== context.tempId);
            return {
              ...current,
              items: [replacement, ...filtered],
            };
          });
        });
      }

      toast.success("User created successfully.");
      form.reset(defaultValues);
      onOpenChange?.(false);
    },
    onSettled: (_data, _error, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: qk.admin.users(), exact: false });
      if (context?.tempId) {
        queryClient.removeQueries({ queryKey: ["admin", "users", context.tempId] });
      }
    },
  });

  useEffect(() => {
    if (!open) return;

    form.reset(defaultValues);
    createUserMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isSubmitting = createUserMutation.isPending;

  const handleSubmit = async (values) => {
    const payload = {
      username: values.username.trim(),
      email: values.email.trim(),
      password: values.password,
    };

    if (values.role) {
      payload.role = values.role;
    }

    if (values.planSlug) {
      payload.planId = values.planSlug;
    }

    if (values.subscriptionStatus) {
      payload.subscriptionStatus = values.subscriptionStatus;
    }

    try {
      await createUserMutation.mutateAsync(payload);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Provision a new account and immediately sync it across administrative views.
          </DialogDescription>
        </DialogHeader>
        <form id="create-user-form" className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="create-username">Username</Label>
            <Input
              id="create-username"
              placeholder="username"
              disabled={isSubmitting}
              {...form.register("username")}
            />
            {form.formState.errors.username ? (
              <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              placeholder="user@example.com"
              disabled={isSubmitting}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-password">Temporary password</Label>
            <Input
              id="create-password"
              type="password"
              placeholder="********"
              disabled={isSubmitting}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <div className="grid gap-2">
                <Label htmlFor="create-role">Role</Label>
                <Select
                  disabled={isSubmitting}
                  value={field.value ?? NONE_VALUE}
                  onValueChange={(value) => field.onChange(value === NONE_VALUE ? undefined : value)}
                >
                  <SelectTrigger id="create-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>No role</SelectItem>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="planSlug"
            render={({ field }) => (
              <div className="grid gap-2">
                <Label htmlFor="create-plan">Plan Slug</Label>
                <Select
                  disabled={isSubmitting || planSlugOptions.length === 0}
                  value={field.value ?? NONE_VALUE}
                  onValueChange={(value) => field.onChange(value === NONE_VALUE ? undefined : value)}
                >
                  <SelectTrigger id="create-plan">
                    <SelectValue
                      placeholder={planSlugOptions.length ? "Select plan slug" : "No public plans"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>No plan</SelectItem>
                    {planSlugOptions.map((slug) => (
                      <SelectItem key={slug} value={slug}>
                        {slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="subscriptionStatus"
            render={({ field }) => (
              <div className="grid gap-2">
                <Label htmlFor="create-subscription-status">Subscription status</Label>
                <Select
                  disabled={isSubmitting}
                  value={field.value ?? NONE_VALUE}
                  onValueChange={(value) => field.onChange(value === NONE_VALUE ? undefined : value)}
                >
                  <SelectTrigger id="create-subscription-status">
                    <SelectValue placeholder="Select subscription status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>No status</SelectItem>
                    {SUBSCRIPTION_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange?.(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" className="w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

