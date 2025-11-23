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
import { formatPlanAmount, resolveNumericValue } from "@/lib/formatters";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  acceptedBanks,
  acceptedMobileOperators,
  manualPaymentDetails,
} from "@/config/payment-methods";

const orderSchema = z.object({
  planId: z.string().min(1, "Plan is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  paymentGateway: z.literal("manual"),
  paymentMethodDetails: z
    .string()
    .min(1, "Manual payment instructions are required"),
  purpose: z.enum([
    "subscription_initial",
    "subscription_renewal",
    "plan_upgrade",
    "plan_downgrade",
    "one_time_purchase",
  ]),
});

const manualPaymentSchema = z.object({
  amount: z.coerce.number().min(0, "Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  paymentGateway: z.literal("manual"),
  paymentId: z.string().min(1, "Payment ID is required"),
  paymentProvider: z.string().min(1, "Select the payment provider used"),
  gatewayTransactionId: z.string().min(3, "Provide the transaction reference"),
});

function formatBillingCycle(cycle) {
  if (!cycle) return "";
  return cycle.charAt(0).toUpperCase() + cycle.slice(1).toLowerCase();
}

const READ_ONLY_INPUT_STYLES = "bg-muted/60 text-muted-foreground";

const defaultOrderValues = {
  planId: "",
  amount: 0,
  currency: "",
  paymentGateway: "manual",
  paymentMethodDetails: "",
  purpose: "subscription_renewal",
};

const defaultManualValues = {
  amount: 0,
  currency: "",
  paymentGateway: "manual",
  paymentId: "",
  paymentProvider: "",
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

  const purposeValue = orderForm.watch("purpose");
  const paymentProviderValue = manualPaymentForm.watch("paymentProvider");

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
        amount: orderPayload?.amount ?? (Number(selectedPlan.price) || 0),
        currency: orderPayload?.currency ?? (selectedPlan.currency || "BDT"),
        paymentGateway: "manual",
        paymentMethodDetails: orderPayload?.paymentMethodDetails || "",
        purpose: orderPayload?.purpose || "subscription_renewal",
      });
    }
  }, [dialogOpen, flowStep, orderForm, orderPayload, selectedPlan]);

  useEffect(() => {
    if (dialogOpen && flowStep === "manual-payment" && orderResponse) {
      manualPaymentForm.reset({
        amount: orderPayload?.amount ?? Number(selectedPlan?.price) ?? 0,
        currency: orderPayload?.currency ?? selectedPlan?.currency ?? "BDT",
        paymentGateway: "manual",
        paymentId: orderResponse.paymentId ?? "",
        paymentProvider: "",
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
      const { paymentProvider, gatewayTransactionId, ...restValues } = values;
      const prefixedTransactionId = paymentProvider
        ? `${paymentProvider}-${gatewayTransactionId}`
        : gatewayTransactionId;

      const payload = {
        ...restValues,
        paymentGateway: "manual",
        paymentId: orderResponse.paymentId ?? values.paymentId,
        gatewayTransactionId: prefixedTransactionId,
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

  const providerLookup = useMemo(() => {
    const providers = [...acceptedBanks, ...acceptedMobileOperators];
    return providers.reduce((map, provider) => {
      map.set(provider.id, provider);
      return map;
    }, new Map());
  }, []);

  const providerOptions = useMemo(() => {
    const providers = [...acceptedBanks, ...acceptedMobileOperators];
    return providers.map((provider) => ({ id: provider.id, name: provider.name }));
  }, []);

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
                readOnly
                aria-readonly="true"
                className={READ_ONLY_INPUT_STYLES}
                {...orderForm.register("amount", { valueAsNumber: true })}
              />
              {orderForm.formState.errors.amount && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order-currency">Currency</Label>
              <Input
                id="plan-order-currency"
                readOnly
                aria-readonly="true"
                className={READ_ONLY_INPUT_STYLES}
                {...orderForm.register("currency")}
              />
              {orderForm.formState.errors.currency && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.currency.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order-gateway">Payment gateway</Label>
              <Input
                id="plan-order-gateway"
                readOnly
                aria-readonly="true"
                className={READ_ONLY_INPUT_STYLES}
                {...orderForm.register("paymentGateway")}
              />
              {orderForm.formState.errors.paymentGateway && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.paymentGateway.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order-purpose">Purpose</Label>
              <Select
                value={purposeValue}
                onValueChange={(value) =>
                  orderForm.setValue("purpose", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                disabled={isSubmittingOrder}
              >
                <SelectTrigger id="plan-order-purpose">
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription_initial">Subscription initial</SelectItem>
                  <SelectItem value="subscription_renewal">Subscription renewal</SelectItem>
                  <SelectItem value="plan_upgrade">Plan upgrade</SelectItem>
                  <SelectItem value="plan_downgrade">Plan downgrade</SelectItem>
                  <SelectItem value="one_time_purchase">One-time purchase</SelectItem>
                </SelectContent>
              </Select>
              {orderForm.formState.errors.purpose && (
                <p className="text-sm text-destructive">{orderForm.formState.errors.purpose.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order-payment-method-details">Manual payment instructions</Label>
              <Textarea
                id="plan-order-payment-method-details"
                placeholder="Provide instructions for submitting manual payment details"
                rows={4}
                disabled={isSubmittingOrder}
                {...orderForm.register("paymentMethodDetails")}
              />
              {orderForm.formState.errors.paymentMethodDetails && (
                <p className="text-sm text-destructive">
                  {orderForm.formState.errors.paymentMethodDetails.message}
                </p>
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
            <DialogDescription>
              Provide the payment reference so we can verify your order. The manual gateway and pricing details are locked for
              this confirmation step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 rounded-md border border-primary/40 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Payment instructions</p>
              <p className="text-sm text-muted-foreground">
                Send funds to <span className="font-semibold text-foreground">{manualPaymentDetails.recipientName}</span> using
                any account below, then share the transaction reference.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-md border bg-background/50 p-3">
                <p className="text-sm font-medium text-muted-foreground">Bank accounts</p>
                <div className="space-y-3 text-sm">
                  {manualPaymentDetails.bankAccounts.map((account) => {
                    const provider = providerLookup.get(account.providerId);
                    return (
                      <div key={`${account.providerId}-${account.accountNumber}`} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{provider?.name || account.providerId}</p>
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {account.accountNumber}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {account.accountName}
                          {account.notes ? ` · ${account.notes}` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 rounded-md border bg-background/50 p-3">
                <p className="text-sm font-medium text-muted-foreground">Mobile wallets</p>
                <div className="space-y-3 text-sm">
                  {manualPaymentDetails.mobileWallets.map((account) => {
                    const provider = providerLookup.get(account.providerId);
                    return (
                      <div key={`${account.providerId}-${account.accountNumber}`} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{provider?.name || account.providerId}</p>
                          <Badge variant="outline" className="text-xs font-semibold">
                            {account.accountNumber}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {account.accountName}
                          {account.notes ? ` · ${account.notes}` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Steps to follow</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {manualPaymentDetails.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Order summary</p>
            <p className="text-muted-foreground">
              Order ID: {orderResponse?.orderId || "-"} · Payment ID: {orderResponse?.paymentId || "-"}
            </p>
            {orderResponse?.status && <p className="text-muted-foreground">Status: {orderResponse.status}</p>}
            <p className="text-muted-foreground">
              {formatPlanAmount(orderPayload?.amount ?? selectedPlan.price, orderPayload?.currency ?? selectedPlan.currency)} · {formatBillingCycle(selectedPlan.billingCycle)} billing
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
                readOnly
                aria-readonly="true"
                className={READ_ONLY_INPUT_STYLES}
                {...manualPaymentForm.register("amount", { valueAsNumber: true })}
              />
              {manualPaymentForm.formState.errors.amount && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-payment-currency">Currency</Label>
              <Input
                id="manual-payment-currency"
                readOnly
                aria-readonly="true"
                className={READ_ONLY_INPUT_STYLES}
                {...manualPaymentForm.register("currency")}
              />
              {manualPaymentForm.formState.errors.currency && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.currency.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-payment-gateway">Payment gateway</Label>
              <Input
                id="manual-payment-gateway"
                readOnly
                aria-readonly="true"
                className={READ_ONLY_INPUT_STYLES}
                {...manualPaymentForm.register("paymentGateway")}
              />
              {manualPaymentForm.formState.errors.paymentGateway && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.paymentGateway.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-payment-provider">Payment provider</Label>
              <Select
                value={paymentProviderValue}
                onValueChange={(value) => manualPaymentForm.setValue("paymentProvider", value)}
                disabled={isSubmittingManualPayment}
              >
                <SelectTrigger id="manual-payment-provider">
                  <SelectValue placeholder="Select bank or mobile wallet" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" {...manualPaymentForm.register("paymentProvider")} />
              {manualPaymentForm.formState.errors.paymentProvider && (
                <p className="text-sm text-destructive">{manualPaymentForm.formState.errors.paymentProvider.message}</p>
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
      const amountValue = resolveNumericValue(
        paymentDetails?.amount ?? orderPayload?.amount ?? selectedPlan?.price
      );
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
            <p>Amount: {formatPlanAmount(amountValue, currencyValue)}</p>
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
                <p className="text-3xl font-semibold">{formatPlanAmount(plan.price, plan.currency)}</p>
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
      <div className="mt-10 space-y-4 rounded-lg border bg-card/40 p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accepted providers</p>
          <h3 className="text-xl font-semibold">Bank & mobile payments</h3>
          <p className="text-sm text-muted-foreground">
            We currently support manual payments through the following partner banks and mobile wallet operators.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-md border bg-background/60 p-4">
            <p className="text-sm font-medium text-muted-foreground">Banks</p>
            <div className="flex flex-wrap gap-2">
              {acceptedBanks.map((provider) => (
                <Badge key={provider.id} variant="secondary" className="gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-xs font-semibold uppercase shadow-sm ring-1 ring-border">
                    {provider.logo}
                  </span>
                  {provider.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-md border bg-background/60 p-4">
            <p className="text-sm font-medium text-muted-foreground">Mobile operators</p>
            <div className="flex flex-wrap gap-2">
              {acceptedMobileOperators.map((provider) => (
                <Badge key={provider.id} variant="outline" className="gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-xs font-semibold uppercase shadow-sm ring-1 ring-border">
                    {provider.logo}
                  </span>
                  {provider.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        {renderDialogContent()}
      </Dialog>
    </>
  );
}
