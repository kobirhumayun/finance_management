// File: src/app/(public)/pricing/page.js
import PlanSelection from "@/components/features/pricing/plan-selection";
import { fetchPublicPlans } from "@/lib/plans";

function normalizePlan(plan) {
  if (!plan) return null;
  const fallbackId = plan.name?.toLowerCase().replace(/\s+/g, "-") || `plan-${Math.random().toString(36).slice(2)}`;
  const id = plan._id ?? plan.id ?? plan.slug ?? fallbackId;
  return {
    id,
    planId: plan._id ?? plan.id ?? plan.slug ?? fallbackId,
    name: plan.name ?? "Untitled plan",
    description: plan.description ?? "",
    price: typeof plan.price === "number" ? plan.price : Number(plan.price ?? 0),
    billingCycle: plan.billingCycle ?? "",
    currency: plan.currency ?? "",
    features: Array.isArray(plan.features) ? plan.features : [],
    slug: plan.slug ?? null,
    isPublic: Boolean(plan.isPublic ?? true),
    displayOrder: plan.displayOrder ?? 0,
    raw: plan,
  };
}

export default async function PricingPage() {
  let plans = [];

  try {
    const data = await fetchPublicPlans();
    plans = Array.isArray(data)
      ? data
          .map(normalizePlan)
          .filter(Boolean)
          .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
      : [];
  } catch (error) {
    console.error("Failed to load public plans", error);
  }

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Choose the right plan</h1>
        <p className="mt-3 text-muted-foreground">
          Flexible pricing for individuals, teams, and enterprises looking to master their finances.
        </p>
      </div>
      <PlanSelection plans={plans} />
    </div>
  );
}
