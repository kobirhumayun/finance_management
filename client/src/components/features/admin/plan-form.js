// File: src/components/features/admin/plan-form.js
"use client";

import { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const limitNumberSchema = z
  .string()
  .refine(
    (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return true;
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) && numeric >= 0;
    },
    { message: "Enter a non-negative number or leave blank." }
  );

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  price: z
    .string()
    .min(1, "Price is required")
    .refine((value) => !Number.isNaN(Number(value)), "Price must be a valid number"),
  billingCycle: z.string().min(2, "Billing cycle required"),
  description: z.string().min(5, "Provide a short description"),
  features: z.string().min(3, "List at least one feature"),
  isPublic: z.boolean(),
  limits: z.object({
    projects: z.object({
      maxActive: limitNumberSchema,
    }),
    transactions: z.object({
      perProject: limitNumberSchema,
      allowAttachments: z.boolean(),
    }),
    summary: z.object({
      allowFilters: z.boolean(),
      allowPagination: z.boolean(),
      allowExport: z.boolean(),
    }),
  }),
});

const parseBooleanInput = (value, fallback) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }

  return Boolean(value);
};

const createDefaultFormValues = () => ({
  name: "",
  slug: "",
  price: "",
  billingCycle: "",
  description: "",
  features: "",
  isPublic: false,
  limits: {
    projects: { maxActive: "" },
    transactions: { perProject: "1000", allowAttachments: true },
    summary: { allowFilters: true, allowPagination: true, allowExport: true },
  },
});

const prepareDefaultValues = (values) => {
  const base = createDefaultFormValues();

  if (!values) {
    return base;
  }

  const normalizeNumberInput = (value, fallback) => {
    if (value === undefined) return fallback;
    if (value === null) return "";
    return String(value);
  };

  return {
    ...base,
    name: values.name ?? base.name,
    slug: values.slug ?? base.slug,
    price: values.price != null ? String(values.price) : base.price,
    billingCycle: values.billingCycle ?? base.billingCycle,
    description: values.description ?? base.description,
    features: values.features ?? base.features,
    isPublic: parseBooleanInput(values.isPublic, base.isPublic),
    limits: {
      projects: {
        maxActive: normalizeNumberInput(values.limits?.projects?.maxActive, base.limits.projects.maxActive),
      },
      transactions: {
        perProject: normalizeNumberInput(
          values.limits?.transactions?.perProject,
          base.limits.transactions.perProject
        ),
        allowAttachments: parseBooleanInput(
          values.limits?.transactions?.allowAttachments,
          base.limits.transactions.allowAttachments
        ),
      },
      summary: {
        allowFilters: parseBooleanInput(
          values.limits?.summary?.allowFilters,
          base.limits.summary.allowFilters
        ),
        allowPagination: parseBooleanInput(
          values.limits?.summary?.allowPagination,
          base.limits.summary.allowPagination
        ),
        allowExport: parseBooleanInput(
          values.limits?.summary?.allowExport,
          base.limits.summary.allowExport
        ),
      },
    },
  };
};

// Form fields shared between create and update plan flows.
export default function PlanForm({ defaultValues, onSubmit, onCancel, isSubmitting }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: prepareDefaultValues(defaultValues),
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset(prepareDefaultValues(defaultValues));
    } else {
      form.reset(prepareDefaultValues());
    }
  }, [defaultValues, form]);

  const handleSubmit = (values) => {
    const { limits, ...baseValues } = values;
    const parsedFeatures = values.features
      .split(/[,\n]/)
      .map((feature) => feature.trim())
      .filter(Boolean);
    const price = Number(values.price);

    const parseLimitNumber = (input) => {
      const raw = typeof input === "string" ? input : String(input ?? "");
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return null;
      }
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      return Math.max(0, Math.floor(numeric));
    };

    const normalizedLimits = {
      summary: {
        allowFilters: parseBooleanInput(limits?.summary?.allowFilters, true),
        allowPagination: parseBooleanInput(limits?.summary?.allowPagination, true),
        allowExport: parseBooleanInput(limits?.summary?.allowExport, true),
      },
    };

    if (limits?.projects) {
      normalizedLimits.projects = {
        maxActive: parseLimitNumber(limits.projects.maxActive ?? ""),
      };
    }

    if (limits?.transactions) {
      normalizedLimits.transactions = {
        perProject: parseLimitNumber(limits.transactions.perProject ?? ""),
        allowAttachments: parseBooleanInput(limits.transactions.allowAttachments, true),
      };
    }

    const payload = {
      ...baseValues,
      name: baseValues.name.trim(),
      slug: baseValues.slug.trim().toLowerCase(),
      billingCycle: baseValues.billingCycle.trim(),
      description: baseValues.description.trim(),
      price,
      features: parsedFeatures,
      isPublic: parseBooleanInput(baseValues.isPublic, false),
      limits: normalizedLimits,
    };

    onSubmit?.(payload);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="plan-name">Plan Name</Label>
        <Input id="plan-name" placeholder="Professional" disabled={isSubmitting} {...form.register("name")} />
        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plan-slug">Slug</Label>
        <Input id="plan-slug" placeholder="professional" disabled={isSubmitting} {...form.register("slug")} />
        {form.formState.errors.slug && <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plan-price">Price</Label>
        <Input
          id="plan-price"
          type="number"
          min="0"
          step="1"
          placeholder="29"
          disabled={isSubmitting}
          {...form.register("price")}
        />
        {form.formState.errors.price && <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plan-cycle">Billing Cycle</Label>
        <Input id="plan-cycle" placeholder="Per month" disabled={isSubmitting} {...form.register("billingCycle")} />
        {form.formState.errors.billingCycle && (
          <p className="text-sm text-destructive">{form.formState.errors.billingCycle.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plan-description">Description</Label>
        <Textarea
          id="plan-description"
          rows={3}
          placeholder="Explain the benefits of this plan"
          disabled={isSubmitting}
          {...form.register("description")}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plan-features">Features (comma or newline separated)</Label>
        <Textarea
          id="plan-features"
          rows={3}
          placeholder="Unlimited projects, Workflow automations"
          disabled={isSubmitting}
          {...form.register("features")}
        />
        {form.formState.errors.features && <p className="text-sm text-destructive">{form.formState.errors.features.message}</p>}
      </div>
      <Controller
        control={form.control}
        name="isPublic"
        render={({ field }) => (
          <div className="flex items-start justify-between gap-3 rounded-md border p-4">
            <div className="space-y-1">
              <Label htmlFor="plan-is-public">Publicly visible</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, this plan is available for customers to view and purchase.
              </p>
            </div>
            <Switch
              id="plan-is-public"
              disabled={isSubmitting}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </div>
        )}
      />
      <div className="space-y-4 rounded-md border p-4">
        <div>
          <h3 className="text-sm font-semibold">Plan limits</h3>
          <p className="text-sm text-muted-foreground">
            Configure per-plan quotas and feature access. Leave numeric fields blank for unlimited.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="limits-projects-max-active">Max active projects</Label>
          <Input
            id="limits-projects-max-active"
            type="number"
            min="0"
            placeholder="Unlimited"
            disabled={isSubmitting}
            {...form.register("limits.projects.maxActive")}
          />
          {form.formState.errors?.limits?.projects?.maxActive && (
            <p className="text-sm text-destructive">
              {form.formState.errors.limits.projects.maxActive.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Leave blank for unlimited projects.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="limits-transactions-per-project">Transactions per project</Label>
          <Input
            id="limits-transactions-per-project"
            type="number"
            min="0"
            placeholder="1000"
            disabled={isSubmitting}
            {...form.register("limits.transactions.perProject")}
          />
          {form.formState.errors?.limits?.transactions?.perProject && (
            <p className="text-sm text-destructive">
              {form.formState.errors.limits.transactions.perProject.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Leave blank for unlimited transactions per project.</p>
        </div>
        <Controller
          control={form.control}
          name="limits.transactions.allowAttachments"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-3 rounded-md border p-4">
              <div className="space-y-1">
                <Label htmlFor="limits-transactions-allow-attachments">Enable transaction attachments</Label>
                <p className="text-sm text-muted-foreground">
                  Disable to prevent uploads or removals of transaction image attachments on this plan.
                </p>
              </div>
              <Switch
                id="limits-transactions-allow-attachments"
                disabled={isSubmitting}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="limits.summary.allowFilters"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-3 rounded-md border p-4">
              <div className="space-y-1">
                <Label htmlFor="limits-summary-allow-filters">Enable summary filters</Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, users on this plan cannot filter summary data.
                </p>
              </div>
              <Switch
                id="limits-summary-allow-filters"
                disabled={isSubmitting}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="limits.summary.allowPagination"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-3 rounded-md border p-4">
              <div className="space-y-1">
                <Label htmlFor="limits-summary-allow-pagination">Allow summary pagination</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle off to restrict the summary view to a single page of results.
                </p>
              </div>
              <Switch
                id="limits-summary-allow-pagination"
                disabled={isSubmitting}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="limits.summary.allowExport"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-3 rounded-md border p-4">
              <div className="space-y-1">
                <Label htmlFor="limits-summary-allow-export">Allow summary exports</Label>
                <p className="text-sm text-muted-foreground">
                  Disable to prevent users on this plan from exporting summary data.
                </p>
              </div>
              <Switch
                id="limits-summary-allow-export"
                disabled={isSubmitting}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Plan"}
        </Button>
      </div>
    </form>
  );
}
