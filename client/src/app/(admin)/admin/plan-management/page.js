// File: src/app/(admin)/admin/plan-management/page.js
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const formatPrice = (value, currency) => {
    if (typeof value !== "number" || Number.isNaN(value)) return value;
    const safeCurrency = currency || "USD";
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: safeCurrency }).format(value);
    } catch {
      return value.toString();
    }
  };

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
    setEditingPlan({
      targetSlug: plan.slug,
      defaults: {
        name: plan.name ?? "",
        slug: plan.slug ?? "",
        price: plan.price != null ? String(plan.price) : "",
        billingCycle: plan.billingCycle ?? "",
        description: plan.description ?? "",
        features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
        isPublic: Boolean(plan.isPublic),
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
          <div className="overflow-x-auto">
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
                    <TableCell colSpan={5}>Loading plans...</TableCell>
                  </TableRow>
                )}
                {errorMessage && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-destructive">
                      {errorMessage}
                    </TableCell>
                  </TableRow>
                )}
                {plansForTable.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell className="text-muted-foreground">{plan.slug}</TableCell>
                    <TableCell>{formatPrice(plan.price, plan.currency)}</TableCell>
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
                        disabled={deletePlanMutation.isPending && deletingSlug === plan.slug}
                        onClick={() => deletePlanMutation.mutate({ slug: plan.slug, name: plan.name })}
                      >
                        {deletePlanMutation.isPending && deletingSlug === plan.slug ? "Removing..." : "Delete"}
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
        <DialogContent className="sm:max-w-lg">
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
    </div>
  );
}
