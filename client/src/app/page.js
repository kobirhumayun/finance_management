// File: src/app/page.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

// Marketing landing page welcoming visitors to FinTrack.
export default function HomePage() {
  const coreFeatures = [
    {
      title: "Executive-ready dashboard",
      description:
        "Monitor income, expenses, and project activity in real time with comparative trends that surface what changed since last month.",
      icon: LayoutDashboard,
    },
    {
      title: "Project command center",
      description:
        "Track budgets, reconcile transactions, and collaborate on updates within a shared workspace purpose-built for finance teams.",
      icon: Users,
    },
    {
      title: "Interactive reporting",
      description:
        "Apply project, type, and date filters to dynamic charts so every stakeholder understands cash flow from multiple perspectives.",
      icon: BarChart3,
    },
    {
      title: "Plan & billing clarity",
      description:
        "Review subscription status, usage, and renewal timelines without leaving the platform—no surprise invoices or missed upgrades.",
      icon: Receipt,
    },
  ];

  const differentiators = [
    {
      title: "Governance-ready",
      description:
        "Role-aware admin controls, customer records, and plan management tools keep finance operations compliant and audit friendly.",
      icon: ShieldCheck,
    },
    {
      title: "Faster month-end",
      description:
        "Automated summaries, searchable ledgers, and transaction grouping reduce back-and-forth during reconciliation cycles.",
      icon: CalendarCheck,
    },
    {
      title: "Team-wide alignment",
      description:
        "Invite project owners, analysts, and leadership into a single source of truth that scales with every new initiative.",
      icon: Users,
    },
  ];

  const workflow = [
    {
      step: "Collect",
      title: "Ingest transactions by project",
      description:
        "Spin up dedicated project spaces, import historical activity, and keep new transactions organized with flexible tagging.",
    },
    {
      step: "Monitor",
      title: "Watch performance trends",
      description:
        "Stay ahead of revenue and expense shifts with the dashboard's real-time metrics and side-by-side month comparisons.",
    },
    {
      step: "Report",
      title: "Build the story behind the numbers",
      description:
        "Layer on filters, surface category insights, and prepare stakeholders with visual reports that adapt in seconds.",
    },
    {
      step: "Decide",
      title: "Act with subscription confidence",
      description:
        "Review plan usage, renewals, and entitlements so every investment stays aligned with business priorities.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-16 sm:px-6 lg:gap-28">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Purpose-built for finance leaders
              </Badge>
              <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Insight-first workflows
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Every decision-ready insight, before you even log in.
            </h1>
            <p className="text-lg text-muted-foreground">
              FinTrack unifies dashboards, project budgets, transaction history, and subscription health into one
              modern workspace so your team can move from data to direction in minutes.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register" className="flex items-center gap-2">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Projects · Reports · Plan Management · Admin oversight
            </p>
          </div>
          <div className="relative hidden justify-center lg:flex">
            <div className="absolute inset-0 -translate-x-6 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl" />
            <Card className="relative w-full max-w-sm border-primary/20 shadow-xl">
              <CardHeader>
                <Badge variant="outline" className="w-fit border-primary/40 text-primary">
                  Live preview
                </Badge>
                <CardTitle className="text-2xl">Finance summary snapshot</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Income, expense, balance, and project counts update instantly as new activity lands.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-4 py-3">
                    <span className="font-medium text-muted-foreground">Net balance</span>
                    <span className="text-base font-semibold text-primary">+$124,800</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-4 py-3">
                    <span className="font-medium text-muted-foreground">Active projects</span>
                    <span className="text-base font-semibold">12</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-4 py-3">
                    <span className="font-medium text-muted-foreground">Recent transactions</span>
                    <span className="text-base font-semibold">+48 this week</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mirror the in-app dashboard experience with drilldowns for every metric.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="features" className="space-y-12">
          <div className="mx-auto max-w-3xl text-center space-y-4">
            <h2 className="text-3xl font-semibold">Preview the modules powering FinTrack</h2>
            <p className="text-muted-foreground">
              Everything you see here is backed by live product areas—dashboards, project workspaces, financial
              reports, and subscription insights—all available the moment you sign in.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {coreFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full border-border/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Coming soon
            </Badge>
            <h2 className="text-3xl font-semibold">Export polished reports in a click</h2>
            <p className="text-muted-foreground">
              FinTrack already equips you with interactive charts and transaction summaries. Next up: shareable
              exports that meet stakeholder expectations without extra tooling.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/80">
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Excel exports</p>
                    <p className="text-xs text-muted-foreground">
                      Deliver pivot-ready workbooks with filters preserved.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/80">
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">PDF handouts</p>
                    <p className="text-xs text-muted-foreground">
                      Send board-ready snapshots with branded styling.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <p className="text-xs text-muted-foreground">
              Join the waitlist and be the first to export summary, category, and cash flow views directly from
              FinTrack.
            </p>
          </div>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
            <CardHeader>
              <CardTitle className="text-2xl">Why teams choose FinTrack</CardTitle>
              <p className="text-sm text-muted-foreground">
                Built with finance workflows in mind—from audit trails to stakeholder-ready storytelling.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {differentiators.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-4 rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-12">
          <div className="mx-auto max-w-3xl text-center space-y-4">
            <h2 className="text-3xl font-semibold">A workflow that mirrors how finance teams operate</h2>
            <p className="text-muted-foreground">
              From the first transaction import to executive reporting, FinTrack guides teams through each step with
              the same tools available in the live app.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {workflow.map((item) => (
              <Card key={item.step} className="h-full border-border/80">
                <CardContent className="space-y-3 p-6">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">{item.step}</div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-primary/40 bg-primary/5 p-10 text-center">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
            <h2 className="text-3xl font-semibold">Be ready for launch day insights</h2>
            <p className="text-muted-foreground">
              Create your FinTrack account today and explore dashboards, project spaces, reports, and billing tools
              in a guided sandbox. Export to PDF and Excel is around the corner—secure early access by getting
              started now.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register" className="flex items-center gap-2">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-background/80">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
