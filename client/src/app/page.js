// File: src/app/page.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart3, LayoutDashboard, Receipt } from "lucide-react";

// Marketing landing page welcoming visitors to FinTrack.
export default function HomePage() {
  const features = [
    {
      title: "Projects workspace",
      description:
        "Organize project budgets, reconcile transactions, and keep every stakeholder aligned in one place.",
      icon: LayoutDashboard,
    },
    {
      title: "Interactive reports",
      description:
        "Visualize income, expenses, and cash flow trends with filters that adapt to every scenario you explore.",
      icon: BarChart3,
    },
    {
      title: "Plan & billing insights",
      description:
        "Review the features in your subscription, monitor usage, and stay ahead of renewals or upcoming changes.",
      icon: Receipt,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-20 px-4 py-16 sm:px-6">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Outcomes-driven finance for modern teams
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn every project update into confident financial decisions.
            </h1>
            <p className="text-lg text-muted-foreground">
              Organize project budgets, monitor cash flow trends, and stay ahead on subscription renewals—all
              from a single connected workspace.
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
            <h2 className="text-3xl font-semibold">Preview the modules you'll rely on every day</h2>
            <p className="text-muted-foreground">
              Each card mirrors the Projects, Reports, and Plan areas inside FinTrack so prospects see exactly
              how the platform supports real financial workflows.
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
