// File: src/app/(user)/dashboard/page.js
"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, CreditCard, Wallet, Briefcase } from "lucide-react";
import SummaryCard from "@/components/features/dashboard/summary-card";
import RecentTransactionsTable from "@/components/features/dashboard/recent-transactions-table";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { qk } from "@/lib/query-keys";
import { fetchDashboardOverview } from "@/lib/queries/dashboard";
import { formatCurrency, formatNumber } from "@/lib/formatters";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

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
  const comparisons = data?.comparisons ?? {};

  const income = summary?.income ?? 0;
  const expenses = summary?.expense ?? 0;
  const net = summary?.balance ?? income - expenses;

  const isSummaryLoading = isLoading || isFetching;
  const showSummaryPlaceholder = isSummaryLoading || isError;
  const isTransactionsLoading = isSummaryLoading;

  const formatTrend = (comparison, { fallbackDirection = "up" } = {}) => {
    if (!comparison || showSummaryPlaceholder) {
      return { label: "-- vs last month", direction: fallbackDirection };
    }

    const percent = Number.isFinite(comparison.percentChange) ? comparison.percentChange : 0;
    const sign = percent > 0 ? "+" : percent < 0 ? "-" : "";
    const magnitude = percentFormatter.format(Math.abs(percent));

    return {
      label: `${sign}${magnitude}% vs last month`,
      direction: comparison.direction ?? fallbackDirection,
    };
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back"
        description="Here's a snapshot of your financial performance this month."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Income"
          value={showSummaryPlaceholder ? "--" : formatCurrency(income)}
          description="Month to date"
          icon={Banknote}
          trend={formatTrend(comparisons.income, { fallbackDirection: "up" })}
        />
        <SummaryCard
          title="Total Expenses"
          value={showSummaryPlaceholder ? "--" : formatCurrency(expenses)}
          description="Month to date"
          icon={CreditCard}
          trend={formatTrend(comparisons.expense, { fallbackDirection: "down" })}
        />
        <SummaryCard
          title="Net Balance"
          value={showSummaryPlaceholder ? "--" : formatCurrency(net)}
          description="After expenses"
          icon={Wallet}
          trend={formatTrend(comparisons.balance, { fallbackDirection: "up" })}
        />
        <SummaryCard
          title="Active Projects"
          value={showSummaryPlaceholder ? "--" : formatNumber(projects)}
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
