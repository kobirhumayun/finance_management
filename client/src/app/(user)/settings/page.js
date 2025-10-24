// File: src/app/(user)/settings/page.js
"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  deleteSelfAccount,
  selfPreferencesQueryOptions,
  selfSettingsQueryOptions,
  updateSelfEmail,
  updateSelfPassword,
  updateSelfPreferences,
} from "@/lib/queries/self";
import { qk } from "@/lib/query-keys";

const emailSchema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
  currentPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
});

const passwordSchema = z.object({
  currentPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
      "Must include upper, lower, number, and symbol"
    ),
});

const deleteSchema = z.object({
  currentPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  reason: z.string().max(500, "Reason must be 500 characters or fewer").optional().or(z.literal("")),
});

const NOTIFICATION_OPTIONS = [
  {
    key: "productUpdates",
    label: "Product updates",
    description: "Hear about new features, improvements, and release notes.",
  },
  {
    key: "billingAlerts",
    label: "Billing alerts",
    description: "Get notified about invoices, renewals, and payment issues.",
  },
  {
    key: "weeklySummary",
    label: "Weekly summary",
    description: "Receive a digest of tasks, projects, and financial activity.",
  },
];

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
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
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

// Account settings page with TanStack Query powered forms and optimistic preference toggles.
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();

  const [settingsQuery, preferencesQuery] = useQueries({
    queries: [selfSettingsQueryOptions(), selfPreferencesQueryOptions()],
  });

  const settings = settingsQuery.data;
  const preferences = preferencesQuery.data;
  const settingsError = settingsQuery.error;
  const preferencesError = preferencesQuery.error;

  useEffect(() => {
    setTheme(preferences?.theme ?? "system");
  }, [preferences?.theme, setTheme]);

  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const deleteForm = useForm({
    resolver: zodResolver(deleteSchema),
    defaultValues: { currentPassword: "", reason: "" },
  });

  const emailMutation = useMutation({
    mutationFn: (values) => updateSelfEmail(values),
    onError: (error) => {
      toast.error(getErrorMessage(error, "Unable to update email."));
    },
    onSuccess: () => {
      toast.success("Email updated. Please verify the new address.");
      emailForm.reset({ newEmail: "", currentPassword: "" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.self.settings() });
      queryClient.invalidateQueries({ queryKey: qk.self.profile() });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (values) => updateSelfPassword(values),
    onError: (error) => {
      toast.error(getErrorMessage(error, "Unable to update password."));
    },
    onSuccess: () => {
      toast.success("Password updated successfully.");
      passwordForm.reset({ currentPassword: "", newPassword: "" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.self.settings() });
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: (updates) => updateSelfPreferences(updates),
    onMutate: async (updates) => {
      const queryKey = qk.self.preferences();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimistic = {
        ...(previous || { theme: "system", notifications: {} }),
        ...updates,
        notifications: {
          ...(previous?.notifications || {}),
          ...(updates.notifications || {}),
        },
      };
      queryClient.setQueryData(queryKey, optimistic);
      return { previous, queryKey };
    },
    onError: (error, _values, context) => {
      if (context?.previous && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error(getErrorMessage(error, "Unable to update preferences."));
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(qk.self.preferences(), data);
      }
      toast.success("Preferences updated.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.self.preferences() });
      queryClient.invalidateQueries({ queryKey: qk.self.settings() });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (values) => deleteSelfAccount(values),
    onError: (error) => {
      toast.error(getErrorMessage(error, "Unable to delete account."));
    },
    onSuccess: async () => {
      deleteForm.reset({ currentPassword: "", reason: "" });
      toast.success("Account deleted. We're signing you out.");
      await signOut({ callbackUrl: "/" });
    },
  });

  const notificationSettings = useMemo(
    () => ({
      ...(preferences?.notifications || {}),
    }),
    [preferences?.notifications]
  );

  const isPreferencesPending = preferencesMutation.isPending;
  const isPreferencesBusy = isPreferencesPending || preferencesQuery.isLoading;

  const handleNotificationToggle = (key) => (checked) => {
    preferencesMutation.mutate({
      notifications: {
        ...notificationSettings,
        [key]: checked,
      },
    });
  };

  const handleThemeChange = (value) => {
    setTheme(value);
    preferencesMutation.mutate({ theme: value });
  };

  const handleEmailSubmit = emailForm.handleSubmit((values) => {
    emailMutation.mutate(values);
  });

  const handlePasswordSubmit = passwordForm.handleSubmit((values) => {
    passwordMutation.mutate(values);
  });

  const handleDeleteSubmit = deleteForm.handleSubmit((values) => {
    deleteAccountMutation.mutate(values);
  });

  const themeValue = preferences?.theme || "system";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Account settings"
        description="Manage login credentials, preferences, and account lifecycle options."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Account overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {settingsError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {getErrorMessage(settingsError, "Unable to load account settings.")}
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Primary email</span>
              <span className="font-medium">{settings?.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email verified</span>
              <Badge variant={settings?.isEmailVerified ? "secondary" : "outline"}>
                {settings?.isEmailVerified ? "Verified" : "Pending"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Auth provider</span>
              <span className="font-medium capitalize">{settings?.authProvider || "password"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span>{formatDate(settings?.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last sign-in</span>
              <span>{formatDate(settings?.lastLoginAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Change email</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...emailForm}>
              <form className="space-y-4" onSubmit={handleEmailSubmit}>
                <FormField
                  control={emailForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New email address</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" disabled={emailMutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          disabled={emailMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={emailMutation.isPending}>
                    {emailMutation.isPending ? "Updating..." : "Update email"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Update password</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          disabled={passwordMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Strong new password"
                          disabled={passwordMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending ? "Saving..." : "Update password"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {preferencesError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {getErrorMessage(preferencesError, "Unable to load preferences.")}
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none text-foreground">Theme</p>
              <Select
                value={themeValue}
                onValueChange={handleThemeChange}
                disabled={isPreferencesBusy || Boolean(preferencesError)}
              >
                <SelectTrigger size="sm" className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent align="start">
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium leading-none text-foreground">Notifications</p>
              <div className="space-y-4">
                {NOTIFICATION_OPTIONS.map((option) => (
                  <div key={option.key} className="flex items-start justify-between gap-4 rounded-md border p-4">
                    <div>
                      <p className="font-medium leading-none">{option.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <Switch
                      checked={Boolean(notificationSettings[option.key])}
                      onCheckedChange={handleNotificationToggle(option.key)}
                      disabled={isPreferencesBusy || Boolean(preferencesError)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <div className="mt-6">
            <Form {...deleteForm}>
              <form className="space-y-4" onSubmit={handleDeleteSubmit}>
                <FormField
                  control={deleteForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          disabled={deleteAccountMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={deleteForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Let us know why you're leaving"
                          rows={4}
                          disabled={deleteAccountMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <CardFooter className="flex justify-end px-0">
                  <Button type="submit" variant="destructive" disabled={deleteAccountMutation.isPending}>
                    {deleteAccountMutation.isPending ? "Deleting..." : "Delete account"}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
