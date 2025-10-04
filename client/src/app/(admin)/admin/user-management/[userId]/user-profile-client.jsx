"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { qk } from "@/lib/query-keys";
import {
  adminUserProfileOptions,
  adminUsersOptions,
  updateAdminUser,
  updateAdminUserStatus,
  resetAdminUserPassword,
  mergeAdminUser,
  formatAdminUserStatus,
} from "@/lib/queries/admin-users";
import { adminPlansOptions } from "@/lib/queries/admin-plans";

const ROLE_OPTIONS = ["user", "admin", "editor", "support"];
const SUBSCRIPTION_STATUS_OPTIONS = [
  "active",
  "trialing",
  "canceled",
  "past_due",
  "pending",
  "free",
];
const ACCOUNT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
];

const toSelectValue = (value) => {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
};

const defaultFormValues = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  role: "",
  planId: "",
  profilePictureUrl: "",
  subscriptionStatus: "",
  subscriptionStartDate: "",
  subscriptionEndDate: "",
  trialEndsAt: "",
  isActive: true,
};

const matchSelectOption = (value, options) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (!Array.isArray(options) || options.length === 0) return trimmed;
  const lower = trimmed.toLowerCase();
  const matched = options.find((option) => option.toLowerCase() === lower);
  return matched ?? trimmed;
};

const normalizeStatusValue = (value) => {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  return normalized;
};

const getAccountStatusLabel = (value) => {
  const normalized = normalizeStatusValue(value);
  const match = ACCOUNT_STATUS_OPTIONS.find((option) => option.value === normalized);
  const label = match?.label ?? formatAdminUserStatus(normalized) ?? normalized;
  return label || "";
};

const resolvePlanFieldValue = (profile) => {
  if (!profile) return "";
  const slug =
    typeof profile.planSlug === "string" ? profile.planSlug.trim() : "";
  if (slug) return slug;
  const planId =
    typeof profile.planId === "string" ? profile.planId.trim() : "";
  return planId;
};

const mapProfileToForm = (profile) => {
  if (!profile) return { ...defaultFormValues };
  const toDateInput = (value) => {
    if (!value) return "";
    const str = String(value);
    return str.length > 10 ? str.slice(0, 10) : str;
  };
  return {
    username: profile.username ?? "",
    email: profile.email ?? "",
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    role: matchSelectOption(profile.role, ROLE_OPTIONS),
    planId: resolvePlanFieldValue(profile),
    profilePictureUrl: profile.profilePictureUrl ?? "",
    subscriptionStatus: matchSelectOption(
      profile.subscriptionStatus,
      SUBSCRIPTION_STATUS_OPTIONS
    ),
    subscriptionStartDate: toDateInput(profile.subscriptionStartDate),
    subscriptionEndDate: toDateInput(profile.subscriptionEndDate),
    trialEndsAt: toDateInput(profile.trialEndsAt),
    isActive: Boolean(profile.isActive),
  };
};

const getErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err?.body === "string") return err.body;
  if (err?.body?.message) return err.body.message;
  if (err?.message) return err.message;
  return fallback;
};

const RESET_REDIRECT_ENV = process.env.NEXT_PUBLIC_PASSWORD_RESET_REDIRECT_URL;

const sanitizeRedirectUri = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const resolvePasswordResetRedirectUri = () => {
  const envValue = sanitizeRedirectUri(RESET_REDIRECT_ENV);
  if (envValue) return envValue;

  if (typeof window !== "undefined") {
    const fallback = sanitizeRedirectUri(
      `${window.location.origin.replace(/\/$/, "")}/auth/reset-password`
    );
    if (fallback) return fallback;
  }

  return undefined;
};

const buildUpdatePayload = (values, profile) => {
  const payload = {};
  const trimmedUsername = values.username?.trim();
  if (trimmedUsername && trimmedUsername !== profile?.username) {
    payload.username = trimmedUsername;
  }
  const trimmedEmail = values.email?.trim();
  if (trimmedEmail && trimmedEmail !== profile?.email) {
    payload.email = trimmedEmail;
  }
  const firstName = values.firstName?.trim() || null;
  if ((profile?.firstName ?? null) !== firstName) {
    payload.firstName = firstName;
  }
  const lastName = values.lastName?.trim() || null;
  if ((profile?.lastName ?? null) !== lastName) {
    payload.lastName = lastName;
  }
  const role = values.role?.trim();
  if (role && role !== profile?.role) {
    payload.role = role;
  }
  const planId = values.planId?.trim();
  if (planId && planId !== profile?.planId && planId !== profile?.planSlug) {
    payload.planId = planId;
  }
  const profilePictureUrl = values.profilePictureUrl?.trim() || null;
  if ((profile?.profilePictureUrl ?? null) !== profilePictureUrl) {
    payload.profilePictureUrl = profilePictureUrl;
  }
  const subscriptionStatus = values.subscriptionStatus?.trim() || null;
  if ((profile?.subscriptionStatus ?? null) !== subscriptionStatus) {
    payload.subscriptionStatus = subscriptionStatus;
  }
  const subscriptionStartDate = values.subscriptionStartDate ? values.subscriptionStartDate : null;
  if ((profile?.subscriptionStartDate ?? null) !== subscriptionStartDate) {
    payload.subscriptionStartDate = subscriptionStartDate;
  }
  const subscriptionEndDate = values.subscriptionEndDate ? values.subscriptionEndDate : null;
  if ((profile?.subscriptionEndDate ?? null) !== subscriptionEndDate) {
    payload.subscriptionEndDate = subscriptionEndDate;
  }
  const trialEndsAt = values.trialEndsAt ? values.trialEndsAt : null;
  if ((profile?.trialEndsAt ?? null) !== trialEndsAt) {
    payload.trialEndsAt = trialEndsAt;
  }
  const isActive = Boolean(values.isActive);
  if (profile?.isActive !== isActive) {
    payload.isActive = isActive;
  }
  return payload;
};

const initials = (value) => {
  if (!value) return "??";
  const parts = String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase())
    .filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 2).join("");
  return parts[0] ?? String(value).slice(0, 2).toUpperCase();
};

export default function UserProfileClient({ userId }) {
  const queryClient = useQueryClient();
  const form = useForm({ defaultValues: defaultFormValues });
  const hydrationSignatureRef = useRef(null);
  const {
    data: profileResult,
    isLoading,
    isError,
    error,
  } = useQuery({
    ...adminUserProfileOptions(userId),
    placeholderData: () => {
      const cachedProfile = queryClient.getQueryData(
        qk.admin.userProfile(userId)
      );
      if (cachedProfile) return cachedProfile;

      const cachedLists = queryClient.getQueriesData({
        queryKey: qk.admin.users(),
        exact: false,
      });

      for (const [, value] of cachedLists) {
        const items = Array.isArray(value?.items) ? value.items : [];
        const match = items.find((item) => item?.id === userId);
        if (match) {
          return mergeAdminUser(null, match);
        }
      }

      return undefined;
    },
    select: (data) => {
      const profile = data ?? null;
      return {
        profile,
        formValues: profile ? mapProfileToForm(profile) : null,
      };
    },
  });
  const profile = profileResult?.profile ?? null;
  const formValues = profileResult?.formValues ?? null;
  const { data: listData } = useQuery(adminUsersOptions());
  const { data: plansData = [] } = useQuery({
    ...adminPlansOptions(),
    select: (plans) => (Array.isArray(plans) ? plans : []),
  });

  useEffect(() => {
    if (!profile || !formValues) {
      if (!profile && hydrationSignatureRef.current !== "__default__") {
        form.reset(defaultFormValues);
        hydrationSignatureRef.current = "__default__";
      }
      return;
    }

    const signature = JSON.stringify(formValues);
    if (hydrationSignatureRef.current === signature) {
      return;
    }

    form.reset(formValues);
    hydrationSignatureRef.current = signature;
  }, [form, formValues, profile]);

  const [statusValue, setStatusValue] = useState("");

  useEffect(() => {
    if (!profile) {
      setStatusValue("");
      return;
    }
    const nextStatus = normalizeStatusValue(profile.statusCode || profile.status);
    setStatusValue(nextStatus);
  }, [profile?.statusCode, profile?.status]);

  const accountStatusOptions = useMemo(() => {
    const normalizedCurrent = normalizeStatusValue(profile?.statusCode || profile?.status);
    const base = [...ACCOUNT_STATUS_OPTIONS];
    if (normalizedCurrent && !base.some((option) => option.value === normalizedCurrent)) {
      base.push({
        value: normalizedCurrent,
        label: getAccountStatusLabel(normalizedCurrent),
      });
    }
    return base;
  }, [profile?.statusCode, profile?.status]);

  const planSlugOptions = useMemo(() => {
    const set = new Set();

    plansData.forEach((plan) => {
      if (!plan?.slug || typeof plan.slug !== "string") return;
      const trimmed = plan.slug.trim();
      if (!trimmed) return;
      if (plan.isPublic) {
        set.add(trimmed);
      }
    });

    (listData?.items ?? []).forEach((item) => {
      const slug = item?.planSlug || item?.planId;
      const value = typeof slug === "string" ? slug.trim() : "";
      if (value) set.add(value);
    });

    const profilePlanCandidates = [profile?.planSlug, profile?.planId]
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .filter(Boolean);

    profilePlanCandidates.forEach((candidate) => set.add(candidate));

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listData?.items, plansData, profile?.planId, profile?.planSlug]);

  const subscriptionStatusOptions = useMemo(() => {
    const set = new Set(SUBSCRIPTION_STATUS_OPTIONS);
    const currentStatus =
      typeof profile?.subscriptionStatus === "string"
        ? profile.subscriptionStatus.trim()
        : "";
    if (currentStatus) {
      set.add(currentStatus);
    }
    return Array.from(set);
  }, [profile?.subscriptionStatus]);

  const errorMessage = isError ? getErrorMessage(error, "Failed to load user profile.") : null;

  const updateProfileMutation = useMutation({
    mutationFn: ({ userId: targetUserId, updates }) => updateAdminUser({ userId: targetUserId, updates }),
    onMutate: async ({ userId: targetUserId, updates }) => {
      await queryClient.cancelQueries({ queryKey: qk.admin.userProfile(targetUserId) });
      await queryClient.cancelQueries({ queryKey: qk.admin.users(), exact: false });

      const previousProfile = queryClient.getQueryData(qk.admin.userProfile(targetUserId));
      const previousUserQueries = queryClient.getQueriesData({ queryKey: qk.admin.users(), exact: false });
      const targetId = previousProfile?.id ?? targetUserId;

      if (previousProfile) {
        const optimisticProfile = mergeAdminUser(previousProfile, updates);
        queryClient.setQueryData(qk.admin.userProfile(targetUserId), optimisticProfile);
      }

      previousUserQueries.forEach(([key, value]) => {
        if (!value?.items) return;
        const items = value.items.map((item) =>
          item.id === targetId ? mergeAdminUser(item, updates) : item
        );
        queryClient.setQueryData(key, { ...value, items });
      });

      return { previousProfile, previousUserQueries };
    },
    onError: (mutationError, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(qk.admin.userProfile(variables.userId), context.previousProfile);
      }
      context?.previousUserQueries?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      toast.error(getErrorMessage(mutationError, "Failed to update profile."));
    },
    onSuccess: (response, variables, context) => {
      const nextProfile = mergeAdminUser(
        queryClient.getQueryData(qk.admin.userProfile(variables.userId)) || context?.previousProfile || null,
        response
      );
      queryClient.setQueryData(qk.admin.userProfile(variables.userId), nextProfile);

      const queries = queryClient.getQueriesData({ queryKey: qk.admin.users(), exact: false });
      queries.forEach(([key]) => {
        queryClient.setQueryData(key, (current) => {
          if (!current?.items) return current;
          const items = current.items.map((item) =>
            item.id === nextProfile.id ? mergeAdminUser(item, response) : item
          );
          return { ...current, items };
        });
      });

      form.reset(mapProfileToForm(nextProfile));
      toast.success("Profile updated successfully.");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.admin.userProfile(variables.userId) });
      queryClient.invalidateQueries({ queryKey: qk.admin.users(), exact: false });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId: targetUserId, status }) => updateAdminUserStatus({ userId: targetUserId, status }),
    onMutate: async ({ userId: targetUserId, status }) => {
      await queryClient.cancelQueries({ queryKey: qk.admin.userProfile(targetUserId) });
      await queryClient.cancelQueries({ queryKey: qk.admin.users(), exact: false });

      const previousProfile = queryClient.getQueryData(qk.admin.userProfile(targetUserId));
      const previousUserQueries = queryClient.getQueriesData({ queryKey: qk.admin.users(), exact: false });
      const targetId = previousProfile?.id ?? targetUserId;

      if (previousProfile) {
        const optimistic = mergeAdminUser(previousProfile, { statusCode: status, status });
        queryClient.setQueryData(qk.admin.userProfile(targetUserId), optimistic);
      }

      previousUserQueries.forEach(([key, value]) => {
        if (!value?.items) return;
        const items = value.items.map((item) =>
          item.id === targetId ? mergeAdminUser(item, { statusCode: status, status }) : item
        );
        queryClient.setQueryData(key, { ...value, items });
      });

      return { previousProfile, previousUserQueries };
    },
    onError: (mutationError, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(qk.admin.userProfile(variables.userId), context.previousProfile);
      }
      context?.previousUserQueries?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      toast.error(getErrorMessage(mutationError, "Failed to update status."));
    },
    onSuccess: (response, variables, context) => {
      const resolvedStatus = (response?.statusCode ?? response?.status ?? variables.status) || "";
      const normalizedStatus = normalizeStatusValue(resolvedStatus);
      const displayStatusLabel = getAccountStatusLabel(normalizedStatus);
      const patch = { statusCode: normalizedStatus, status: normalizedStatus };

      const nextProfile = mergeAdminUser(
        queryClient.getQueryData(qk.admin.userProfile(variables.userId)) || context?.previousProfile || null,
        patch
      );
      queryClient.setQueryData(qk.admin.userProfile(variables.userId), nextProfile);

      const queries = queryClient.getQueriesData({ queryKey: qk.admin.users(), exact: false });
      queries.forEach(([key]) => {
        queryClient.setQueryData(key, (current) => {
          if (!current?.items) return current;
          const items = current.items.map((item) =>
            item.id === nextProfile.id ? mergeAdminUser(item, patch) : item
          );
          return { ...current, items };
        });
      });

      setStatusValue(normalizedStatus);
      toast.success(
        `Status updated to ${displayStatusLabel || formatAdminUserStatus(normalizedStatus) || normalizedStatus}.`
      );
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.admin.userProfile(variables.userId) });
      queryClient.invalidateQueries({ queryKey: qk.admin.users(), exact: false });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId: targetUserId, redirectUri }) =>
      resetAdminUserPassword({ userId: targetUserId, redirectUri }),
    onSuccess: (response) => {
      toast.success(response?.message || "Password reset email scheduled.");
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, "Failed to schedule password reset."));
    },
  });

  const handleSubmit = (values) => {
    if (!profile) return;
    const updates = buildUpdatePayload(values, profile);
    if (Object.keys(updates).length === 0) {
      toast.info("No changes detected.");
      return;
    }
    updateProfileMutation.mutate({ userId, updates });
  };

  const handleResetPassword = () => {
    const redirectUri = resolvePasswordResetRedirectUri();
    if (!redirectUri) {
      toast.info(
        "No secure reset redirect configured. The backend default link will be used instead."
      );
    }
    resetPasswordMutation.mutate({ userId, redirectUri });
  };

  const isSaving = updateProfileMutation.isPending;
  const isUpdatingStatus = updateStatusMutation.isPending;
  const isSendingReset = resetPasswordMutation.isPending;

  const title = profile?.username
    ? `User: ${profile.username}`
    : profile?.email
    ? `User: ${profile.email}`
    : "User profile";
  const description = profile?.planName
    ? `Plan: ${profile.planName}`
    : profile?.plan
    ? `Plan: ${profile.plan}`
    : "Manage account details, subscription, and permissions.";

  if (isLoading && !profile) {
    return (
      <div className="space-y-8">
        <PageHeader title="User profile" description="Loading profile details..." />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading user information…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-8">
        <PageHeader title="User profile" description="Unable to load user details." />
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="outline" onClick={handleResetPassword} disabled={isSendingReset}>
            {isSendingReset ? "Sending…" : "Reset password"}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Update profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" placeholder="Username" disabled={isSaving} {...form.register("username")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="user@example.com" disabled={isSaving} {...form.register("email")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" placeholder="First" disabled={isSaving} {...form.register("firstName")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" placeholder="Last" disabled={isSaving} {...form.register("lastName")} />
                </div>
                <Controller
                  control={form.control}
                  name="role"
                  defaultValue={defaultFormValues.role}
                  render={({ field }) => (
                    <div className="grid gap-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={toSelectValue(field.value)}
                        onValueChange={(value) => field.onChange(value ?? "")}
                        disabled={isSaving}
                      >
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
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
                  name="planId"
                  defaultValue={defaultFormValues.planId}
                  render={({ field }) => (
                    <div className="grid gap-2">
                      <Label htmlFor="planId">Plan Slug</Label>
                      <Select
                        value={toSelectValue(field.value)}
                        onValueChange={(value) => field.onChange(value ?? "")}
                        disabled={isSaving || planSlugOptions.length === 0}
                      >
                        <SelectTrigger id="planId">
                          <SelectValue
                            placeholder={
                              planSlugOptions.length ? "Select plan slug" : "No plan slugs"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
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
                  defaultValue={defaultFormValues.subscriptionStatus}
                  render={({ field }) => (
                    <div className="grid gap-2">
                      <Label htmlFor="subscriptionStatus">Subscription status</Label>
                      <Select
                        value={toSelectValue(field.value)}
                        onValueChange={(value) => field.onChange(value ?? "")}
                        disabled={isSaving}
                      >
                        <SelectTrigger id="subscriptionStatus">
                          <SelectValue placeholder="Select subscription status" />
                        </SelectTrigger>
                        <SelectContent>
                          {subscriptionStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
                <div className="grid gap-2">
                  <Label htmlFor="profilePictureUrl">Profile picture URL</Label>
                  <Input
                    id="profilePictureUrl"
                    placeholder="https://"
                    disabled={isSaving}
                    {...form.register("profilePictureUrl")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subscriptionStartDate">Subscription start</Label>
                  <Input
                    id="subscriptionStartDate"
                    type="date"
                    disabled={isSaving}
                    {...form.register("subscriptionStartDate")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subscriptionEndDate">Subscription end</Label>
                  <Input
                    id="subscriptionEndDate"
                    type="date"
                    disabled={isSaving}
                    {...form.register("subscriptionEndDate")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="trialEndsAt">Trial ends</Label>
                  <Input id="trialEndsAt" type="date" disabled={isSaving} {...form.register("trialEndsAt")} />
                </div>
              </div>
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="isActive">Active account</Label>
                      <p className="text-sm text-muted-foreground">
                        Disable to revoke access to the platform without deleting the account.
                      </p>
                    </div>
                    <Switch
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                    />
                  </div>
                )}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => profile && form.reset(mapProfileToForm(profile))}
                  disabled={isSaving || !profile}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={profile?.profilePictureUrl ?? undefined} alt={profile?.username ?? profile?.email ?? "User avatar"} />
                  <AvatarFallback>{initials(profile?.fullName || profile?.username || profile?.email)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle>{profile?.fullName || profile?.username || profile?.email || "User"}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {profile?.statusLabel ? (
                      <Badge variant={profile?.isActive ? "default" : "secondary"}>{profile.statusLabel}</Badge>
                    ) : null}
                    {profile?.role ? <Badge variant="outline">{profile.role}</Badge> : null}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Email</p>
                <p className="text-muted-foreground">{profile?.email || "—"}</p>
              </div>
              <div>
                <p className="font-medium">Plan</p>
                <p className="text-muted-foreground">{profile?.planName || profile?.plan || "—"}</p>
              </div>
              <div>
                <p className="font-medium">Subscription</p>
                <p className="text-muted-foreground">
                  {profile?.subscriptionStartDateLabel || profile?.subscriptionEndDateLabel
                    ? `${profile?.subscriptionStartDateLabel ?? "—"} → ${profile?.subscriptionEndDateLabel ?? "—"}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="font-medium">Registered</p>
                <p className="text-muted-foreground">{profile?.registeredAtDateTimeLabel || profile?.registeredAtLabel || "—"}</p>
              </div>
              <div>
                <p className="font-medium">Last login</p>
                <p className="text-muted-foreground">{profile?.lastLoginAtLabel || "—"}</p>
              </div>
              <div>
                <p className="font-medium">Trial ends</p>
                <p className="text-muted-foreground">{profile?.trialEndsAtLabel || "—"}</p>
              </div>
              <div>
                <p className="font-medium">User ID</p>
                <p className="text-muted-foreground break-all">{profile?.id || userId}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Account status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status-select">Status</Label>
                <Select
                  value={statusValue || undefined}
                  onValueChange={setStatusValue}
                  disabled={isUpdatingStatus || accountStatusOptions.length === 0}
                >
                  <SelectTrigger id="status-select">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountStatusOptions.map((statusOption) => (
                      <SelectItem key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Adjust the account lifecycle to activate, pause, or suspend access.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() =>
                    statusValue &&
                    updateStatusMutation.mutate({ userId, status: statusValue })
                  }
                  disabled={!statusValue || isUpdatingStatus}
                  className="w-full sm:w-auto"
                >
                  {isUpdatingStatus ? "Updating…" : "Apply status"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setStatusValue(
                      normalizeStatusValue(profile?.statusCode || profile?.status)
                    )
                  }
                  disabled={isUpdatingStatus || !profile}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Password reset</p>
                <p className="text-muted-foreground">
                  Send a reset link to {profile?.email || "the user"}. The link will redirect to the hosted reset flow.
                </p>
              </div>
              <Button onClick={handleResetPassword} disabled={isSendingReset} className="w-full">
                {isSendingReset ? "Sending…" : "Send reset email"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
