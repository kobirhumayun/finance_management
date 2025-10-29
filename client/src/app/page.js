// File: src/app/page.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  FileDown,
  LayoutDashboard,
  ListChecks,
  PieChart,
  Receipt,
} from "lucide-react";

// Marketing landing page welcoming visitors to FinTrack.
export default function HomePage() {
  const featureHighlights = [
    {
      title: "Command-center dashboard",
      description:
        "Start each day with income, expense, balance, and active project metrics sourced from real data in your FinTrack workspace.",
      icon: LayoutDashboard,
    },
    {
      title: "Project-level control",
      description:
        "Spin up new initiatives in seconds, collaborate on transactions, and keep running ledgers tidy with inline edit, delete, and sorting tools.",
      icon: ListChecks,
    },
    {
      title: "Filterable summary reports",
      description:
        "Slice performance by project, type, and date range—then scroll through live tables that grow with your history.",
      icon: BarChart3,
    },
    {
      title: "Visual cash-flow analytics",
      description:
        "Explore income, expense, category, and cash-flow charts with dynamic filters for quick what-if analysis.",
      icon: PieChart,
    },
    {
      title: "Subscription transparency",
      description:
        "Track plan perks, renewal dates, trial periods, and usage caps from a dedicated My Plan hub.",
      icon: Receipt,
    },
  ];

  const workflow = [
    {
      title: "Connect every project",
      description:
        "Import budgets, add transactions, and prioritize the initiatives that matter most to your finance and delivery teams.",
    },
    {
      title: "Monitor performance",
      description:
        "Dashboards and summaries surface the deltas that need attention—complete with comparisons against last month.",
    },
    {
      title: "Share confident updates",
      description:
        "Build narratives around real data with charts, tables, and upcoming export options that keep stakeholders aligned.",
    },
  ];

  const upcomingExports = {
    title: "Report exports (coming soon)",
    description:
      "Download presentation-ready PDFs or spreadsheet-friendly Excel files from any report view without leaving FinTrack.",
    details: [
      "Respect applied filters so the exported view matches what you see on screen",
      "Deliver polished layouts for leadership decks and async updates",
      "Enable deeper analysis by piping data into your modeling tools",
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-24 px-4 py-20 sm:px-6 lg:py-24">
        <section className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              Finance leadership, evolved
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              See every project, report, and renewal before you ever log in.
            </h1>
            <p className="text-lg text-muted-foreground">
              FinTrack brings project budgets, transactions, analytics, and subscription insights into one
              connected workspace so revenue, operations, and delivery stay in lockstep.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register" className="flex items-center gap-2">
                  Start a free trial <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden justify-center lg:flex">
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-primary/20 blur-3xl" aria-hidden />
              <div className="relative space-y-5 rounded-[2.5rem] border border-border/60 bg-background/80 p-10 shadow-2xl backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">Live inside the numbers</p>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                    Dashboards highlight income, expense, balance, and projects with trend comparisons.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                    Summary tables respond instantly to project, type, and date filters as you refine insights.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                    Plan management keeps renewal dates, usage limits, and trial periods crystal clear.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-semibold">Purpose-built modules that mirror the product</h2>
            <p className="text-base text-muted-foreground">
              Every highlight reflects a live FinTrack view—from dashboards and summary reports to projects and
              billing—so your team understands exactly what unlocks after sign in.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featureHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full border-border/70">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-5">
            <h2 className="text-3xl font-semibold">A workflow that supports every stakeholder</h2>
            <p className="text-base text-muted-foreground">
              From first transaction to executive summary, FinTrack connects the dots for finance leads, project
              managers, and operations partners.
            </p>
          </div>
          <Card className="border-border/70">
            <CardContent className="space-y-6 p-8">
              {workflow.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Card className="order-2 border-border/70 lg:order-1">
            <CardContent className="space-y-5 p-8">
              <div className="flex items-center gap-3 text-primary">
                <FileDown className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">{upcomingExports.title}</span>
              </div>
              <p className="text-base text-muted-foreground">{upcomingExports.description}</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {upcomingExports.details.map((detail) => (
                  <li key={detail} className="flex items-start gap-3">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                    {detail}
                  </li>
                ))}
              </ul>
              <p className="text-xs uppercase tracking-wide text-primary/80">
                Join the waitlist at signup to be the first to access exports.
              </p>
            </CardContent>
          </Card>
          <div className="order-1 space-y-5 text-center lg:order-2 lg:text-left">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Upcoming capability
            </span>
            <h2 className="text-3xl font-semibold">Deliver polished updates in minutes</h2>
            <p className="text-base text-muted-foreground">
              Export any filtered report as a PDF for leadership reviews or Excel workbook for detailed modeling—no
              manual formatting required.
            </p>
          </div>
        </section>

        <section className="space-y-8 rounded-3xl border border-border/60 bg-muted/30 p-10 text-center">
          <h2 className="text-3xl font-semibold">Ready to unite finance and delivery?</h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
            Launch FinTrack today and give every stakeholder a shared source of truth for projects, transactions,
            analytics, and billing—plus early access to one-click report exports.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register" className="flex items-center gap-2">
                Create your workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing tiers</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
