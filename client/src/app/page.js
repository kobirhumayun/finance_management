// File: src/app/page.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  FileDown,
  Gauge,
  Layers,
  LineChart,
  ListChecks,
} from "lucide-react";

// Marketing landing page welcoming visitors to FinTrack.
export default function HomePage() {
  const featureHighlights = [
    {
      title: "Realtime health dashboard",
      description:
        "Surface income, expenses, balance trends, and active projects the second you log in—no spreadsheets required.",
      icon: Gauge,
    },
    {
      title: "Project workspaces",
      description:
        "Track budgets, reconcile transactions, and collaborate on every initiative with filters, search, and inline updates.",
      icon: Briefcase,
    },
    {
      title: "Interactive financial reports",
      description:
        "Pivot charts by project, transaction type, or date range to answer cash flow questions on demand.",
      icon: BarChart3,
    },
    {
      title: "Usage and billing clarity",
      description:
        "Monitor plan entitlements, renewal dates, and historical orders so finance and operations stay aligned.",
      icon: Layers,
    },
  ];

  const workflowSteps = [
    {
      title: "Connect the numbers",
      description:
        "Import or create projects, categorize transactions, and watch key metrics populate the dashboard instantly.",
    },
    {
      title: "Interrogate every trend",
      description:
        "Slice reports with advanced filters, compare periods, and drill into supporting transactions from the same screen.",
    },
    {
      title: "Act with confidence",
      description:
        "Share insights with stakeholders, adjust budgets, and keep subscription usage on track without leaving FinTrack.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-16 sm:px-6 lg:py-24">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-primary">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                <LineChart className="h-3.5 w-3.5" />
                Finance intelligence for project-led teams
              </span>
              <Badge variant="outline" className="border-primary/40 text-primary">
                Upcoming: PDF & Excel report exports
              </Badge>
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Translate complex financial activity into next best actions.
              </h1>
              <p className="text-lg text-muted-foreground">
                FinTrack unifies dashboards, project workspaces, and interactive reports so growing companies can
                move from data collection to decisive guidance in minutes.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register" className="flex items-center gap-2">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">See plans & pricing</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No implementation fees. Cancel anytime.
            </p>
          </div>
          <div className="hidden justify-center lg:flex">
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-6 rounded-3xl bg-primary/20 blur-2xl" aria-hidden />
              <Card className="relative overflow-hidden border-border/70 bg-background/80 shadow-2xl backdrop-blur">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-lg">What you&apos;ll see on day one</CardTitle>
                  <CardDescription>
                    Real-time income, expense, and cash flow signals alongside the projects driving them.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-primary">
                    Dashboard insights refresh automatically as transactions post.
                  </div>
                  <div className="grid gap-3 text-muted-foreground">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <span className="font-medium text-foreground">4 active projects</span>
                      <p>Monitor budgets, owners, and burn without juggling tabs.</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <span className="font-medium text-foreground">Income vs expense trends</span>
                      <p>Spot inflection points before they impact runway.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="space-y-12" id="features">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-semibold">Every pillar of FinTrack is ready before you sign in</h2>
            <p className="text-muted-foreground">
              Explore the same modules your team will use daily—dashboards, project tracking, advanced reporting,
              and plan oversight—all connected to deliver context you can trust.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {featureHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full border-border/70">
                  <CardHeader className="space-y-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[0.75fr_1fr] lg:items-center">
          <div className="space-y-4">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              How teams move through FinTrack
            </Badge>
            <h2 className="text-3xl font-semibold">A guided workflow from first transaction to board update</h2>
            <p className="text-muted-foreground">
              FinTrack brings your finance and operations partners into a single source of truth. Connect the
              dots faster with contextual data, rich filters, and built-in governance.
            </p>
          </div>
          <div className="grid gap-4">
            {workflowSteps.map((step, index) => (
              <Card key={step.title} className="border-border/70">
                <CardContent className="flex items-start gap-4 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {step.description}
                    </CardDescription>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold">Reports built for answers, not exports</h2>
            <p className="text-muted-foreground">
              Toggle between summary tables and visual charts, compare periods, and drill down to the transaction
              level without interrupting your flow. When you&apos;re ready to share, exporting is just a click away.
            </p>
            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <FileDown className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">Upcoming: PDF & Excel report exports</p>
                  <p className="text-sm text-muted-foreground">
                    Package filtered insights exactly as you see them—perfect for quarterly reviews and stakeholder
                    handoffs.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <Card className="border-border/70">
            <CardHeader className="flex flex-row items-center gap-3 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">What finance leaders accomplish</CardTitle>
                <CardDescription>Insights sourced directly from FinTrack modules.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                • Diagnose project profitability by pairing transaction histories with budget burn-downs.
              </p>
              <p>
                • Quantify income and expense swings across categories, teams, or custom time ranges.
              </p>
              <p>
                • Validate subscription usage, upcoming renewals, and support entitlements before conversations begin.
              </p>
              <p>
                • Export polished reports (soon in PDF & Excel) to keep executives and investors aligned.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl bg-primary text-primary-foreground">
          <div className="flex flex-col gap-6 px-8 py-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold">Ready to make confident calls on every project?</h2>
              <p className="text-primary-foreground/80">
                Join finance teams replacing spreadsheet chaos with a collaborative command center built for
                momentum.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary">
                <Link href="/register" className="flex items-center gap-2">
                  Create your workspace <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
