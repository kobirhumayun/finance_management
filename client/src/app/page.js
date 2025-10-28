// File: src/app/page.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart3, ShieldCheck, Wallet } from "lucide-react";

// Marketing landing page welcoming visitors to FinTrack.
export default function HomePage() {
  const features = [
    {
      title: "Unified Financial View",
      description: "Track budgets, cash flow, and profit across every project from a single dashboard.",
      icon: Wallet,
    },
    {
      title: "Actionable Analytics",
      description: "Visualize spending trends and quickly identify opportunities to optimize operations.",
      icon: BarChart3,
    },
    {
      title: "Enterprise-grade Security",
      description: "Safeguard sensitive financial data with RBAC, JWT authentication, and audit trails.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-20 px-4 py-16 sm:px-6">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Financial clarity for every team
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Grow smarter with unified financial insights.
            </h1>
            <p className="text-lg text-muted-foreground">
              FinTrack centralizes your budgets, subscriptions, and transactions so you can focus on
              building a resilient business.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register" className="flex items-center gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <div className="relative w-full max-w-sm">
              <div className="absolute -inset-4 rounded-3xl bg-primary/20 blur-2xl" aria-hidden />
              <div className="relative space-y-4 rounded-3xl border border-border/60 bg-background/80 p-8 text-center shadow-2xl backdrop-blur">
                <p className="text-sm font-semibold text-primary">Plan with confidence</p>
                <p className="text-sm text-muted-foreground">
                  Visualize budgets, collaborate with finance teams, and set goals before you ever sign in.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-semibold">Everything you need to own your finances</h2>
            <p className="text-muted-foreground">
              From freelancers to enterprises, FinTrack adapts to your workflows and scales with your ambitions.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
