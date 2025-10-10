// File: src/app/(user)/dashboard/page.js
"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet, ArrowDownCircle, PiggyBank, Briefcase } from "lucide-react";
import SummaryCard from "@/components/features/dashboard/summary-card";
import RecentTransactionsTable from "@/components/features/dashboard/recent-transactions-table";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { qk } from "@/lib/query-keys";
import { fetchDashboardOverview } from "@/lib/queries/dashboard";

// Authenticated user dashboard summarizing key insights.
export default function DashboardPage() {
  const {
    data,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: qk.dashboard.overview(),
    queryFn: ({ signal }) => fetchDashboardOverview({ signal }),
  });

  const summary = data?.summary;
  const recentTransactions = data?.recentTransactions ?? [];
  const projects = data?.projectCount ?? 0;

  const income = summary?.income ?? 0;
  const expenses = summary?.expense ?? 0;
  const net = summary?.balance ?? income - expenses;

  const isSummaryLoading = isLoading || isFetching;
  const showSummaryPlaceholder = isSummaryLoading || isError;
  const isTransactionsLoading = isSummaryLoading;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back"
        description="Here's a snapshot of your financial performance this month."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Income"
          value={showSummaryPlaceholder ? "--" : `$${income.toLocaleString()}`}
          description="Month to date"
          icon={Wallet}
          trend={{ label: "+12% vs last month", direction: "up" }}
        />
        <SummaryCard
          title="Total Expenses"
          value={showSummaryPlaceholder ? "--" : `$${expenses.toLocaleString()}`}
          description="Month to date"
          icon={ArrowDownCircle}
          trend={{ label: "+4% vs last month", direction: "down" }}
        />
        <SummaryCard
          title="Net Balance"
          value={showSummaryPlaceholder ? "--" : `$${net.toLocaleString()}`}
          description="After expenses"
          icon={PiggyBank}
          trend={{ label: "+8% vs last month", direction: "up" }}
        />
        <SummaryCard
          title="Active Projects"
          value={showSummaryPlaceholder ? "--" : projects.toLocaleString()}
          description="Tracked in FinTrack"
          icon={Briefcase}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="text-sm text-destructive">Unable to load recent transactions.</p>
          ) : (
            <RecentTransactionsTable transactions={recentTransactions} isLoading={isTransactionsLoading} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
