// File: src/app/page.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart4,
  BarChart3,
  CheckCircle2,
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
    {
      title: "One-click report exports",
      description:
        "Send polished PDFs to leadership or dive deeper in Excel with every filter and grouping intact.",
      icon: FileDown,
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
        "Build narratives around real data with charts, tables, and one-click exports that keep stakeholders aligned.",
    },
  ];

  const exportFeature = {
    title: "Report exports",
    description:
      "Download presentation-ready PDFs or spreadsheet-friendly Excel files from any report view without leaving FinTrack.",
    details: [
      "Respect applied filters so the exported view matches what you see on screen",
      "Deliver polished layouts for leadership decks and async updates",
      "Enable deeper analysis by piping data into your modeling tools",
    ],
  };

  const differentiators = [
    {
      title: "Real-time rollups",
      description: "Fresh totals for every account and category keep leadership updates minutes, not days, behind.",
    },
    {
      title: "Secure workspace controls",
      description: "Role-based permissions ensure finance, operations, and delivery collaborate with confidence.",
    },
    {
      title: "Audit-ready history",
      description: "Every adjustment is tracked so compliance reviews and investor questions are effortless.",
    },
  ];

  const testimonials = [
    {
      name: "Priya Desai",
      role: "VP Finance, Northwind Logistics",
      quote:
        "FinTrack cut our month-end consolidation time in half. The exports mirror our dashboards perfectly, so reviews are instant.",
    },
    {
      name: "Miguel Alvarez",
      role: "Director of Operations, Lumen Studio",
      quote:
        "Projects, forecasts, and billing finally live together. We spot variances before they spiral and share context in seconds.",
    },
  ];

  const faqs = [
    {
      question: "Can I control who can export reports?",
      answer:
        "Yes. Workspace admins decide which roles can generate PDF or Excel files and every export is logged for audit trails.",
    },
    {
      question: "How quickly can my team get started?",
      answer:
        "Most customers launch in under a week using our CSV importers and guided onboarding with a dedicated success manager.",
    },
    {
      question: "Do you integrate with my accounting stack?",
      answer:
        "FinTrack syncs with QuickBooks Online, Xero, and NetSuite and provides webhooks for custom pipelines.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-16 sm:px-6 lg:py-24">
        <section className="relative overflow-hidden rounded-[3rem] border border-border/40 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-[0_45px_80px_-40px_rgba(15,23,42,0.45)] lg:p-14">
          <div className="absolute inset-x-20 -top-32 h-64 rounded-full bg-primary/30 blur-[120px]" aria-hidden />
          <div className="absolute -bottom-28 right-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="relative grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="bg-primary/15 text-primary">
                  Smart finance OS
                </Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> SOC 2 Type II ready
                </div>
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Translate every transaction into proactive financial strategy.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                FinTrack unifies project budgets, transaction histories, analytics, subscription oversight, and export-ready reports
                so every stakeholder steers the business with clarity.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/register" className="flex items-center gap-2">
                    Start a free trial <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="backdrop-blur">
                  <Link href="/demo">Book a guided tour</Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/40 bg-background/70 p-4 shadow-sm">
                  <p className="text-2xl font-semibold">52%</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Faster reporting cycles</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/70 p-4 shadow-sm">
                  <p className="text-2xl font-semibold">$3.1M</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Spend governed across projects</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/70 p-4 shadow-sm">
                  <p className="text-2xl font-semibold">99.9%</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Uptime backed by SLA</p>
                </div>
              </div>
            </div>
            <Card className="relative border-border/50 bg-background/80 shadow-xl backdrop-blur">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Portfolio health</span>
                  <span>Last 30 days</span>
                </div>
                <CardTitle className="text-2xl">Strategic portfolio snapshot</CardTitle>
                <CardDescription>Dynamic KPIs, forecast trends, and exportable summaries—side by side.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/40 bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Cash runway</p>
                    <p className="text-xl font-semibold">11.2 mo</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Variance</p>
                    <p className="text-xl font-semibold text-emerald-500">-4.7%</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">On track</p>
                    <p className="text-xl font-semibold">23 / 27</p>
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl border border-border/40 bg-background/60 p-4">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Executive summary.pdf</span>
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      PDF Export
                    </Badge>
                  </div>
                  <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <BarChart4 className="h-4 w-4 text-primary" /> Year-to-date revenue up 18%
                    </div>
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-primary" /> Auto-shared with leadership
                    </div>
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4 text-primary" /> Excel version scheduled weekly
                    </div>
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-primary" /> Includes drill-down visuals
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">Trusted by modern finance teams</p>
          <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {["Arcadia", "Silverline", "Northwind", "Lumina", "Vertex", "Harbor"].map((brand) => (
              <div
                key={brand}
                className="flex h-14 items-center justify-center rounded-xl border border-border/40 bg-background/60 text-sm font-medium text-muted-foreground"
              >
                {brand}
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="space-y-12">
          <div className="space-y-4 text-center">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Feature highlights
            </Badge>
            <h2 className="text-3xl font-semibold">Purpose-built modules that mirror the product</h2>
            <p className="text-base text-muted-foreground">
              Every highlight reflects a live FinTrack view—from dashboards and summary reports to projects and billing—so your
              team understands exactly what unlocks after sign in.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featureHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full border-border/50 bg-background/80 shadow-sm backdrop-blur">
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
              From first transaction to executive summary, FinTrack connects the dots for finance leads, project managers, and
              operations partners.
            </p>
          </div>
          <Card className="border-border/60 bg-background/90 shadow-lg">
            <CardContent className="space-y-6 p-8">
              {workflow.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-sm font-semibold">
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
          <Card className="order-2 border-border/50 bg-background/85 shadow-xl backdrop-blur lg:order-1">
            <CardContent className="space-y-5 p-8">
              <div className="flex items-center gap-3 text-primary">
                <FileDown className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">{exportFeature.title}</span>
              </div>
              <p className="text-base text-muted-foreground">{exportFeature.description}</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {exportFeature.details.map((detail) => (
                  <li key={detail} className="flex items-start gap-3">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                    {detail}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <div className="order-1 space-y-5 text-center lg:order-2 lg:text-left">
            <Badge variant="secondary" className="bg-primary/15 text-primary">
              Available now
            </Badge>
            <h2 className="text-3xl font-semibold">Deliver polished updates in minutes</h2>
            <p className="text-base text-muted-foreground">
              Export any filtered report as a PDF for leadership reviews or Excel workbook for detailed modeling—no manual formatting
              required.
            </p>
          </div>
        </section>

        <section className="grid gap-10 rounded-3xl border border-border/40 bg-background/80 p-10 shadow-2xl lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="space-y-8">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Why teams stay
            </Badge>
            <h2 className="text-3xl font-semibold">Operations and finance finally move in sync</h2>
            <p className="text-base text-muted-foreground">
              FinTrack closes the gap between projections and reality. Automated workflows, data-rich exports, and shared context mean
              stakeholders never operate in the dark.
            </p>
            <div className="space-y-6">
              {differentiators.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/40 bg-muted/30 p-5 text-left">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="border-border/40 bg-background/90 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Customer proof</CardTitle>
              <CardDescription>Teams across SaaS, logistics, and services scale with FinTrack.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="space-y-3 rounded-2xl border border-border/40 bg-muted/30 p-5">
                  <p className="text-sm text-muted-foreground">“{testimonial.quote}”</p>
                  <div>
                    <p className="text-sm font-semibold">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="space-y-4">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Questions, answered
            </Badge>
            <h2 className="text-3xl font-semibold">Everything you need to know</h2>
            <p className="text-base text-muted-foreground">
              Still comparing solutions? These are the top questions finance leads ask before switching to FinTrack.
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <Card key={faq.question} className="border-border/50 bg-background/90">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-8 rounded-3xl border border-primary/30 bg-primary/10 p-12 text-center shadow-lg">
          <h2 className="text-3xl font-semibold">Ready to unite finance and delivery?</h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
            Launch FinTrack today and give every stakeholder a shared source of truth for projects, transactions, analytics, billing,
            and one-click report exports.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register" className="flex items-center gap-2">
                Create your workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary/40 text-primary">
              <Link href="/pricing">See pricing tiers</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
