// File: src/components/features/pricing/plan-selection.jsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { createPlanOrder, submitManualPayment } from "@/lib/plans";

const orderSchema = z.object({
  planId: z.string().min(1, "Plan is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  paymentGateway: z.string().min(1, "Payment gateway is required"),
  paymentMethodDetails: z.literal("manual"),
  purpose: z.string().min(1, "Purpose is required"),
});

const manualPaymentSchema = z.object({
  amount: z.coerce.number().min(0, "Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  paymentGateway: z.string().min(1, "Payment gateway is required"),
  paymentId: z.string().min(1, "Payment ID is required"),
  gatewayTransactionId: z.string().min(3, "Provide the transaction reference"),
});

function formatCurrency(value, currency) {
  if (Number(value) === 0) {
    return "Free";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch (error) {
    return `${currency || ""} ${value}`.trim();
  }
}

function formatBillingCycle(cycle) {
  if (!cycle) return "";
  return cycle.charAt(0).toUpperCase() + cycle.slice(1).toLowerCase();
}

function resolveNumeric(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === "object") {
    if (typeof value.$numberDecimal === "string") {
      const parsed = Number(value.$numberDecimal);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const defaultOrderValues = {
  planId: "",
  amount: 0,
  currency: "",
  paymentGateway: "",
  paymentMethodDetails: "manual",
  purpose: "subscription_renewal",
};

const defaultManualValues = {
  amount: 0,
  currency: "",
  paymentGateway: "",
  paymentId: "",
  gatewayTransactionId: "",
};

const POPULAR_PLAN_SLUGS = new Set(["professional", "pro", "business"]);

export default function PlanSelection({ plans }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [flowStep, setFlowStep] = useState("payment-mode");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [orderResponse, setOrderResponse] = useState(null);
  const [manualPaymentResponse, setManualPaymentResponse] = useState(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isSubmittingManualPayment, setIsSubmittingManualPayment] = useState(false);
  const [orderPayload, setOrderPayload] = useState(null);

  const orderForm = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: defaultOrderValues,
  });

  const manualPaymentForm = useForm({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: defaultManualValues,
  });

  const resetFlow = useCallback(() => {
    setDialogOpen(false);
    setFlowStep("payment-mode");
    setSelectedPlan(null);
    setOrderResponse(null);
    setManualPaymentResponse(null);
    setOrderPayload(null);
    orderForm.reset(defaultOrderValues);
    manualPaymentForm.reset(defaultManualValues);
  }, [orderForm, manualPaymentForm]);

  const handlePlanSelection = useCallback(
    (plan) => {
      if (!isAuthenticated) {
        const callbackUrl = typeof window !== "undefined" ? window.location.href : "/pricing";
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      setSelectedPlan(plan);
      setOrderResponse(null);
      setManualPaymentResponse(null);
      setOrderPayload(null);
      setFlowStep("payment-mode");
      setDialogOpen(true);
    },
    [isAuthenticated, router]
  );

  const handleDialogChange = (open) => {
    if (!open) {
      resetFlow();
    } else {
      setDialogOpen(true);
    }
  };

  useEffect(() => {
    if (dialogOpen && flowStep === "order" && selectedPlan) {
      orderForm.reset({
        planId: selectedPlan.planId,
        amount: Number(selectedPlan.price) || 0,
        currency: selectedPlan.currency || "BDT",
        paymentGateway: orderPayload?.paymentGateway || "Mobile-Banking",
        paymentMethodDetails: "manual",
        purpose: orderPayload?.purpose || "subscription_renewal",
      });
    }
  }, [dialogOpen, flowStep, orderForm, orderPayload, selectedPlan]);

  useEffect(() => {
    if (dialogOpen && flowStep === "manual-payment" && orderResponse) {
      manualPaymentForm.reset({
        amount: orderPayload?.amount ?? Number(selectedPlan?.price) ?? 0,
        currency: orderPayload?.currency ?? selectedPlan?.currency ?? "BDT",
        paymentGateway: orderPayload?.paymentGateway ?? "Mobile-Banking",
        paymentId: orderResponse.paymentId ?? "",
        gatewayTransactionId: "",
      });
    }
  }, [dialogOpen, flowStep, manualPaymentForm, orderPayload, orderResponse, selectedPlan]);

  const highlightedPlanId = useMemo(() => {
    const popularPlan = plans?.find((plan) => plan.slug && POPULAR_PLAN_SLUGS.has(plan.slug));
    return popularPlan?.id ?? null;
  }, [plans]);

  const handleOrderSubmit = async (values) => {
    if (!selectedPlan) return;
    setIsSubmittingOrder(true);
    try {
      const payload = {
        ...values,
        planId: selectedPlan.planId,
        paymentMethodDetails: "manual",
      };
      const response = await createPlanOrder(payload);
      setOrderPayload(payload);
      setOrderResponse(response);
      toast.success(response?.message || "Order created successfully");
      setFlowStep("manual-payment");
    } catch (error) {
      const message = error?.body?.message || "Unable to create order";
      toast.error(message);
      console.error("Order creation failed", error);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleManualPaymentSubmit = async (values) => {
    if (!orderResponse) return;
    setIsSubmittingManualPayment(true);
    try {
      const payload = {
        ...values,
        paymentId: orderResponse.paymentId ?? values.paymentId,
      };
      const response = await submitManualPayment(payload);
      setManualPaymentResponse(response);
      toast.success(response?.message || "Manual payment submitted");
      setFlowStep("confirmation");
    } catch (error) {
      const message = error?.body?.message || "Unable to submit manual payment";
      toast.error(message);
      console.error("Manual payment submission failed", error);
    } finally {
      setIsSubmittingManualPayment(false);
    }
  };

  const renderDialogContent = () => {
    if (!selectedPlan) return null;

    if (flowStep === "payment-mode") {
      return (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select payment option</DialogTitle>
            <DialogDescription>
              Choose how you would like to pay for the {selectedPlan.name} plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-dashed">
              <CardHeader className="py-4">
                <CardTitle className="text-lg">Automatic payment</CardTitle>
                <CardDescription>Let us process renewals automatically for you.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" variant="outline" onClick={() => setFlowStep("automatic-coming-soon") }>
                  Continue with automatic payment
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-lg">Manual payment</CardTitle>
                <CardDescription>Submit an order and share the payment reference.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" onClick={() => setFlowStep("order")}>
                  Continue with manual payment
                </Button>
              </CardFooter>
            </Card>
          </div>
        </DialogContent>
      );
    }

    if (flowStep === "automatic-coming-soon") {
      return (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Automatic payments</DialogTitle>
            <DialogDescription>
              An automatic payment option will be available soon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              We are working on supporting secure automatic billing. For now, please choose the manual payment option to complete
              your subscription.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetFlow}>
              Close
            </Button>
            <Button onClick={() => setFlowStep("order")}>
              Switch to manual payment
            </Button>
          </DialogFooter>
        </DialogContent>
      );
    }

    if (flowStep === "order") {
      return (
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Order management</DialogTitle>
            <DialogDescription>
              Review the order details before confirming your manual payment.
            </DialogDescription>
          </DialogHeader>
          <form id="plan-order-form" className="space-y-4" onSubmit={orderForm.handleSubmit(handleOrderSubmit)}>
            <input type="hidden" {...orderForm.register("planId")} />
            <input type="hidden" {...orderForm.register("paymentMethodDetails")} />
            <div className="grid gap-2">
              <Label>Selected plan</Label>
              <Input value={selectedPlan.name} readOnly disabled />
            </div>
            <div className="grid gap-2">
              <Label>Payment mode</Label>
              <Input value="Manual" readOnly disabled />
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="plan-order-amount">Amount</Label>
              <Input
                id="plan-order-amount"
                type="number"
                step="0.01"
                disabled={isSubmittingOrder}
                {...orderForm.register("amount", { valueAsNumber: true })}
              />
              {orderForm.formState.errors.amount && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order-currency">Currency</Label>
              <Input id="plan-order-currency" disabled={isSubmittingOrder} {...orderForm.register("currency")} />
              {orderForm.formState.errors.currency && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.currency.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order-gateway">Payment gateway</Label>
              <Input id="plan-order-gateway" disabled={isSubmittingOrder} {...orderForm.register("paymentGateway")} />
              {orderForm.formState.errors.paymentGateway && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.paymentGateway.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order-purpose">Purpose</Label>
              <Input id="plan-order-purpose" disabled={isSubmittingOrder} {...orderForm.register("purpose")} />
              {orderForm.formState.errors.purpose && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.purpose.message}</p>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetFlow} disabled={isSubmittingOrder}>
              Cancel
            </Button>
            <Button type="submit" form="plan-order-form" disabled={isSubmittingOrder}>
              {isSubmittingOrder ? "Creating order..." : "Create order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      );
    }

    if (flowStep === "manual-payment") {
      return (
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manual payment</DialogTitle>
            <DialogDescription>Provide the payment reference so we can verify your order.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Order summary</p>
            <p className="text-muted-foreground">
              Order ID: {orderResponse?.orderId || "-"} · Payment ID: {orderResponse?.paymentId || "-"}
            </p>
            {orderResponse?.status && <p className="text-muted-foreground">Status: {orderResponse.status}</p>}
            <p className="text-muted-foreground">
              {formatCurrency(orderPayload?.amount ?? selectedPlan.price, orderPayload?.currency ?? selectedPlan.currency)} · {formatBillingCycle(selectedPlan.billingCycle)} billing
            </p>
          </div>
          <form id="manual-payment-form" className="mt-4 space-y-4" onSubmit={manualPaymentForm.handleSubmit(handleManualPaymentSubmit)}>
            <input type="hidden" {...manualPaymentForm.register("paymentId")} />
            <div className="grid gap-2">
              <Label htmlFor="manual-payment-amount">Amount</Label>
              <Input
                id="manual-payment-amount"
                type="number"
                step="0.01"
                disabled={isSubmittingManualPayment}
                {...manualPaymentForm.register("amount", { valueAsNumber: true })}
              />
              {manualPaymentForm.formState.errors.amount && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-payment-currency">Currency</Label>
              <Input id="manual-payment-currency" disabled={isSubmittingManualPayment} {...manualPaymentForm.register("currency")} />
              {manualPaymentForm.formState.errors.currency && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.currency.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-payment-gateway">Payment gateway</Label>
              <Input id="manual-payment-gateway" disabled={isSubmittingManualPayment} {...manualPaymentForm.register("paymentGateway")} />
              {manualPaymentForm.formState.errors.paymentGateway && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.paymentGateway.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-payment-reference">Gateway transaction ID</Label>
              <Input
                id="manual-payment-reference"
                placeholder="e.g. ref-0147"
                disabled={isSubmittingManualPayment}
                {...manualPaymentForm.register("gatewayTransactionId")}
              />
              {manualPaymentForm.formState.errors.gatewayTransactionId && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.gatewayTransactionId.message}</p>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={resetFlow} disabled={isSubmittingManualPayment}>
              Cancel
            </Button>
            <Button type="submit" form="manual-payment-form" disabled={isSubmittingManualPayment}>
              {isSubmittingManualPayment ? "Submitting..." : "Confirm payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      );
    }

    if (flowStep === "confirmation") {
      const paymentDetails = manualPaymentResponse?.payment;
      const amountValue = resolveNumeric(paymentDetails?.amount ?? orderPayload?.amount ?? selectedPlan?.price);
      const currencyValue = paymentDetails?.currency ?? orderPayload?.currency ?? selectedPlan?.currency;
      const gatewayValue = paymentDetails?.paymentGateway ?? orderPayload?.paymentGateway;
      return (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submission received</DialogTitle>
            <DialogDescription>{manualPaymentResponse?.message || "We have received your payment details."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Status: {manualPaymentResponse?.payment?.status || "pending"}</p>
            <p>Amount: {formatCurrency(amountValue, currencyValue)}</p>
            {gatewayValue && <p>Gateway: {gatewayValue}</p>}
            {manualPaymentResponse?.payment?.processedAt && (
              <p>Processed at: {new Date(manualPaymentResponse.payment.processedAt).toLocaleString()}</p>
            )}
            {manualPaymentResponse?.payment?.gatewayTransactionId && (
              <p>Reference: {manualPaymentResponse.payment.gatewayTransactionId}</p>
            )}
            {manualPaymentResponse?.payment?.order && <p>Order ID: {manualPaymentResponse.payment.order}</p>}
          </div>
          <DialogFooter>
            <Button onClick={resetFlow}>Done</Button>
          </DialogFooter>
        </DialogContent>
      );
    }

    return null;
  };

  if (!plans?.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Pricing information is temporarily unavailable. Please try again later.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative flex h-full flex-col">
            {(plan.id === highlightedPlanId || plan.price > 0) && (
              <Badge className="absolute right-4 top-4" variant={plan.id === highlightedPlanId ? "default" : "secondary"}>
                {plan.id === highlightedPlanId ? "Popular" : "Paid"}
              </Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-semibold">{formatCurrency(plan.price, plan.currency)}</p>
                <p className="text-sm text-muted-foreground">{formatBillingCycle(plan.billingCycle)}</p>
              </div>
              <ul className="space-y-2 text-sm">
                {plan.features?.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="mt-auto">
              <Button className="w-full" onClick={() => handlePlanSelection(plan)}>
                Choose plan
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        {renderDialogContent()}
      </Dialog>
    </>
  );
}
