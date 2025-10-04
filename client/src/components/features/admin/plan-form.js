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
});

const defaultFormValues = {
  name: "",
  slug: "",
  price: "",
  billingCycle: "",
  description: "",
  features: "",
  isPublic: false,
};

// Form fields shared between create and update plan flows.
export default function PlanForm({ defaultValues, onSubmit, onCancel, isSubmitting }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ? { ...defaultFormValues, ...defaultValues } : defaultFormValues,
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({ ...defaultFormValues, ...defaultValues, isPublic: defaultValues.isPublic ?? false });
    } else {
      form.reset(defaultFormValues);
    }
  }, [defaultValues, form]);

  const handleSubmit = (values) => {
    const parsedFeatures = values.features
      .split(/[,\n]/)
      .map((feature) => feature.trim())
      .filter(Boolean);
    const price = Number(values.price);
    const payload = {
      ...values,
      name: values.name.trim(),
      slug: values.slug.trim().toLowerCase(),
      billingCycle: values.billingCycle.trim(),
      description: values.description.trim(),
      price,
      features: parsedFeatures,
      isPublic: Boolean(values.isPublic),
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
