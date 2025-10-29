// File: src/app/page.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarClock,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Handshake,
  LayoutDashboard,
  ShieldCheck,
  Workflow,
} from "lucide-react";

// Marketing landing page welcoming visitors to FinTrack.
export default function HomePage() {
  const productHighlights = [
    {
      title: "Command central dashboard",
      description:
        "Track income, expenses, net balance, and project activity at a glance with live tiles and recent transactions.",
      icon: LayoutDashboard,
    },
    {
      title: "Project-level control",
      description:
        "Spin up project workspaces, collaborate on budgets, and log every transaction with role-aware permissions.",
      icon: Briefcase,
    },
    {
      title: "Interactive financial reports",
      description:
        "Layer filters by project, type, or date to model income, expense, and cash flow trends in responsive charts.",
      icon: BarChart3,
    },
    {
      title: "Detailed summary analytics",
      description:
        "Slice transaction data with advanced filters, infinite scrolling, and instant totals for every scenario.",
      icon: FileBarChart,
    },
    {
      title: "Subscription intelligence",
      description:
        "Give finance leads transparency into plan usage, renewal milestones, and billing status in real time.",
      icon: CalendarClock,
    },
    {
      title: "Enterprise-grade governance",
      description:
        "Audit trails, error handling, and data validation keep budgets reliable for auditors and stakeholders alike.",
      icon: ShieldCheck,
    },
  ];

  const workflow = [
    {
      title: "Import & categorize",
      description:
        "Bring in projects and historical transactions, then organize them with consistent categories and owners.",
      icon: Workflow,
    },
    {
      title: "Collaborate on budgets",
      description:
        "Use project workspaces to assign responsibilities, update forecasts, and trigger approvals in context.",
      icon: Handshake,
    },
    {
      title: "Report & act",
      description:
        "Share dashboards, drill into summary tables, and soon export polished PDFs and spreadsheets for leadership.",
      icon: FileText,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-24 px-4 py-16 sm:px-6">
        <section className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
              Finance orchestration for growing teams
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Translate every transaction into proactive financial strategy.
            </h1>
            <p className="text-lg text-muted-foreground">
              FinTrack unifies dashboards, project workspaces, deep-dive reports, and subscription visibility so
              revenue, ops, and finance leads stay aligned before they even log in.
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Trusted across finance and operations teams</span>
              <span>Role-based workspaces</span>
              <span>Real-time collaboration</span>
              <span>Audit-friendly controls</span>
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <div className="relative w-full max-w-sm">
              <div className="absolute -inset-4 rounded-3xl bg-primary/20 blur-2xl" aria-hidden />
              <div className="relative space-y-5 rounded-3xl border border-border/60 bg-background/90 p-8 text-left shadow-2xl backdrop-blur">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Live snapshot</p>
                  <p className="text-sm font-semibold text-primary">This month</p>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Income</span>
                    <span className="font-semibold text-foreground">$128k</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expense</span>
                    <span className="font-semibold text-foreground">$82k</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Active projects</span>
                    <span className="font-semibold text-foreground">19</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Invite stakeholders to monitor metrics, reconcile transactions, and prepare exports without
                  waiting on a login.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="space-y-12">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-semibold">What you can explore in FinTrack</h2>
            <p className="text-muted-foreground">
              Every module below mirrors the live product—from dashboards to project workspaces—so prospects can
              see how FinTrack supports day-to-day decision making.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {productHighlights.map((highlight) => {
              const Icon = highlight.icon;
              return (
                <Card key={highlight.title} className="h-full border-border/70">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold">{highlight.title}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {highlight.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.6fr_1.4fr] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Built for the way finance teams actually work
            </span>
            <h2 className="text-3xl font-semibold">A connected workflow from project intake to board-ready insights</h2>
            <p className="text-muted-foreground">
              FinTrack stitches together budgets, approvals, and analytics. Teams move seamlessly from
              transaction capture to trend analysis without exporting data to spreadsheets.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {workflow.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} className="h-full border-border/70">
                  <CardContent className="flex flex-col gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Coming soon
            </span>
            <h2 className="text-3xl font-semibold">Export-ready insights in seconds</h2>
            <p className="text-muted-foreground">
              Soon you can generate presentation-ready PDF decks and Excel models directly from FinTrack data.
              Create a snapshot, select your filters, and share polished files with leadership in one click.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/70">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-foreground">PDF exports</p>
                    <p className="text-muted-foreground">Turn dashboards into branded stakeholder updates.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/70">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-foreground">Excel exports</p>
                    <p className="text-muted-foreground">Push filters and formulas into a ready-to-model sheet.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Why exports matter</CardTitle>
              <CardDescription>
                Teams already review dashboards, deep-dive reports, subscription usage, and summary tables inside
                FinTrack. Soon they will push the same data into board decks without rebuilding charts elsewhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                • Dashboard metrics stay synced with exported visuals, so executives see the same numbers your
                analysts monitor every morning.
              </p>
              <p>
                • Summary tables preserve filters, totals, and pagination logic—perfect for auditors and
                cross-functional partners.
              </p>
              <p>
                • Plan and billing insights combine with forecasts, ensuring stakeholders understand capacity
                before approving new spend.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border border-border/70 bg-muted/20 p-10 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold">See FinTrack in action</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Launch a guided workspace preview to explore dashboards, drill into project transactions, and
              validate that FinTrack fits your reporting cadence.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register" className="flex items-center gap-2">
                  Get started now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Book a walkthrough</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
