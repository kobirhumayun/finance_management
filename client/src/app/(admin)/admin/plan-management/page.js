// File: src/app/(admin)/admin/plan-management/page.js
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PlanForm from "@/components/features/admin/plan-form";
import { qk } from "@/lib/query-keys";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import {
  adminPlansOptions,
  createAdminPlan,
  deleteAdminPlan,
  normalizeAdminPlan,
  updateAdminPlan,
} from "@/lib/queries/admin-plans";
import { formatPlanAmount } from "@/lib/formatters";

const coerceBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

// Plan management interface for administrators.
export default function PlanManagementPage() {
  const queryClient = useQueryClient();
  const {
    data: plans = [],
    isLoading,
    isError,
    error,
  } = useQuery(adminPlansOptions());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planToDelete, setPlanToDelete] = useState(null);

  const getErrorMessage = (err, fallback) => {
    if (!err) return fallback;
    if (err.body) {
      if (typeof err.body === "string") return err.body;
      if (err.body?.message) return err.body.message;
      if (Array.isArray(err.body?.errors)) {
        const [first] = err.body.errors;
        if (first?.message) return first.message;
      }
    }
    return err.message || fallback;
  };

  const invalidatePlanQueries = () => {
    const keys = [qk.admin.plans(), qk.plans.all(), qk.plans.current()];
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  };

  const createPlanMutation = useMutation({
    mutationFn: createAdminPlan,
    onMutate: async (newPlan) => {
      await queryClient.cancelQueries({ queryKey: qk.admin.plans() });
      const previousPlans = queryClient.getQueryData(qk.admin.plans());
      const optimisticPlan = normalizeAdminPlan({
        ...newPlan,
        _id: `optimistic-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (optimisticPlan) {
        queryClient.setQueryData(qk.admin.plans(), (current = []) => [optimisticPlan, ...(current || [])]);
      }
      return { previousPlans };
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previousPlans) {
        queryClient.setQueryData(qk.admin.plans(), context.previousPlans);
      }
      toast.error(getErrorMessage(mutationError, "Failed to create plan."));
    },
    onSuccess: (_data, variables) => {
      toast.success(`Plan "${variables.name}" created.`);
      setDialogOpen(false);
      setEditingPlan(null);
    },
    onSettled: () => {
      invalidatePlanQueries();
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: updateAdminPlan,
    onMutate: async (updatedPlan) => {
      await queryClient.cancelQueries({ queryKey: qk.admin.plans() });
      const previousPlans = queryClient.getQueryData(qk.admin.plans());
      queryClient.setQueryData(qk.admin.plans(), (current = []) =>
        (current || []).map((plan) => {
          if (plan.slug !== updatedPlan.targetSlug) return plan;
          const { targetSlug, ...rest } = updatedPlan;
          return normalizeAdminPlan({ ...plan, ...rest });
        })
      );
      return { previousPlans };
    },
    onError: (mutationError, variables, context) => {
      if (context?.previousPlans) {
        queryClient.setQueryData(qk.admin.plans(), context.previousPlans);
      }
      toast.error(getErrorMessage(mutationError, `Failed to update ${variables?.name || "plan"}.`));
    },
    onSuccess: (_data, variables) => {
      toast.success(`Plan "${variables.name}" updated.`);
      setDialogOpen(false);
      setEditingPlan(null);
    },
    onSettled: () => {
      invalidatePlanQueries();
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: deleteAdminPlan,
    onMutate: async ({ slug }) => {
      await queryClient.cancelQueries({ queryKey: qk.admin.plans() });
      const previousPlans = queryClient.getQueryData(qk.admin.plans());
      queryClient.setQueryData(qk.admin.plans(), (current = []) => (current || []).filter((plan) => plan.slug !== slug));
      return { previousPlans };
    },
    onError: (mutationError, variables, context) => {
      if (context?.previousPlans) {
        queryClient.setQueryData(qk.admin.plans(), context.previousPlans);
      }
      toast.error(getErrorMessage(mutationError, `Failed to delete ${variables?.name || "plan"}.`));
    },
    onSuccess: (_data, variables) => {
      toast.success(`Plan "${variables?.name || variables?.slug}" deleted.`);
      setPlanToDelete(null);
    },
    onSettled: () => {
      invalidatePlanQueries();
    },
  });

  const openCreate = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const openEdit = (plan) => {
    const planLimits = plan?.limits ?? {};
    const toLimitInput = (value) => {
      if (value === undefined || value === null) return "";
      return String(value);
    };

    setEditingPlan({
      targetSlug: plan.slug,
      defaults: {
        name: plan.name ?? "",
        slug: plan.slug ?? "",
        price: plan.price != null ? String(plan.price) : "",
        billingCycle: plan.billingCycle ?? "",
        description: plan.description ?? "",
        features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
        isPublic: coerceBoolean(plan.isPublic, false),
        limits: {
          projects: { maxActive: toLimitInput(planLimits?.projects?.maxActive) },
          transactions: {
            perProject: toLimitInput(planLimits?.transactions?.perProject),
            allowAttachments: coerceBoolean(planLimits?.transactions?.allowAttachments, true),
          },
          summary: {
            allowFilters: coerceBoolean(planLimits?.summary?.allowFilters, true),
            allowPagination: coerceBoolean(planLimits?.summary?.allowPagination, true),
            allowExport: coerceBoolean(planLimits?.summary?.allowExport, true),
          },
        },
      },
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = (values) => {
    if (editingPlan) {
      updatePlanMutation.mutate({
        targetSlug: editingPlan.targetSlug,
        ...values,
      });
    } else {
      createPlanMutation.mutate(values);
    }
  };

  const plansForTable = Array.isArray(plans) ? plans : [];
  const isFormSubmitting = createPlanMutation.isPending || updatePlanMutation.isPending;
  const deletingSlug = deletePlanMutation.variables?.slug;
  const isDeletingPlan = deletePlanMutation.isPending;
  const showEmptyState = !isLoading && !isError && plansForTable.length === 0;
  const errorMessage = isError ? getErrorMessage(error, "Failed to load plans.") : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plan management"
        description="Create, update, or retire subscription tiers."
        actions={<Button onClick={openCreate}>Add new plan</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Available plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Billing cycle</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6}>Loading plans...</TableCell>
                  </TableRow>
                )}
                {errorMessage && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-destructive">
                      {errorMessage}
                    </TableCell>
                  </TableRow>
                )}
                {plansForTable.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell className="text-muted-foreground">{plan.slug}</TableCell>
                    <TableCell>{formatPlanAmount(plan.price, plan.currency)}</TableCell>
                    <TableCell>{plan.billingCycle}</TableCell>
                    <TableCell>
                      <Badge variant={plan.isPublic ? "default" : "secondary"}>
                        {plan.isPublic ? "Public" : "Private"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isDeletingPlan}
                        onClick={() => setPlanToDelete(plan)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {showEmptyState && (
              <p className="p-4 text-sm text-muted-foreground">No plans have been configured.</p>
            )}
          </div>

          <div className="space-y-3 md:hidden">
            {isLoading && <p className="text-sm text-muted-foreground">Loading plans...</p>}
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            {plansForTable.map((plan) => (
              <div key={plan.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold leading-tight">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.slug}</p>
                  </div>
                  <Badge variant={plan.isPublic ? "default" : "secondary"}>
                    {plan.isPublic ? "Public" : "Private"}
                  </Badge>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Price</dt>
                    <dd className="font-medium">{formatPlanAmount(plan.price, plan.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Billing</dt>
                    <dd className="font-medium capitalize">{plan.billingCycle}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="flex-1 min-w-[120px]" onClick={() => openEdit(plan)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 min-w-[120px]"
                    disabled={isDeletingPlan}
                    onClick={() => setPlanToDelete(plan)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {showEmptyState && (
              <p className="text-sm text-muted-foreground">No plans have been configured.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingPlan(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit plan" : "Add plan"}</DialogTitle>
          </DialogHeader>
          <PlanForm
            defaultValues={editingPlan?.defaults}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
            isSubmitting={isFormSubmitting}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(planToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingPlan) {
            setPlanToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete the plan "${planToDelete?.name || planToDelete?.slug || "this plan"}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPlan}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingPlan || !planToDelete?.slug}
              onClick={(event) => {
                event.preventDefault();
                if (!planToDelete?.slug || isDeletingPlan) return;
                deletePlanMutation.mutate({ slug: planToDelete.slug, name: planToDelete.name });
              }}
            >
              {isDeletingPlan && deletingSlug === planToDelete?.slug ? "Removing..." : "Delete plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
