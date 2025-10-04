// File: src/app/(user)/dashboard/page.js
"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet, ArrowDownCircle, PiggyBank, Briefcase } from "lucide-react";
import SummaryCard from "@/components/features/dashboard/summary-card";
import RecentTransactionsTable from "@/components/features/dashboard/recent-transactions-table";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { qk } from "@/lib/query-keys";
import { fetchDashboardSummary, fetchRecentTransactions } from "@/lib/mock-data";

// Authenticated user dashboard summarizing key insights.
export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: qk.dashboard.summary(),
    queryFn: fetchDashboardSummary,
  });

  const { data: recentTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: qk.dashboard.recentTransactions(),
    queryFn: fetchRecentTransactions,
  });

  const income = summary?.income ?? 0;
  const expenses = summary?.expenses ?? 0;
  const net = summary?.netBalance ?? 0;
  const projects = summary?.projects ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back"
        description="Here's a snapshot of your financial performance this month."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Income"
          value={summaryLoading ? "--" : `$${income.toLocaleString()}`}
          description="Month to date"
          icon={Wallet}
          trend={{ label: "+12% vs last month", direction: "up" }}
        />
        <SummaryCard
          title="Total Expenses"
          value={summaryLoading ? "--" : `$${expenses.toLocaleString()}`}
          description="Month to date"
          icon={ArrowDownCircle}
          trend={{ label: "+4% vs last month", direction: "down" }}
        />
        <SummaryCard
          title="Net Balance"
          value={summaryLoading ? "--" : `$${net.toLocaleString()}`}
          description="After expenses"
          icon={PiggyBank}
          trend={{ label: "+8% vs last month", direction: "up" }}
        />
        <SummaryCard
          title="Active Projects"
          value={summaryLoading ? "--" : projects}
          description="Tracked in FinTrack"
          icon={Briefcase}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentTransactionsTable transactions={recentTransactions} isLoading={transactionsLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
