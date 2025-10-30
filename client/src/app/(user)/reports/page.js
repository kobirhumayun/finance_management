// File: src/app/(user)/reports/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import IncomeExpenseChart from "@/components/features/reports/income-expense-chart";
import ExpenseCategoryChart from "@/components/features/reports/expense-category-chart";
import IncomeCategoryChart from "@/components/features/reports/income-category-chart";
import CashFlowChart from "@/components/features/reports/cash-flow-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { qk } from "@/lib/query-keys";
import { fetchReportCharts, fetchReportFilters } from "@/lib/queries/reports";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { toNumeric } from "@/lib/utils/numbers";

const toDateInputString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStartOfCurrentYear = () => {
  const now = new Date();
  return toDateInputString(new Date(now.getFullYear(), 0, 1));
};

const getTodayDate = () => toDateInputString(new Date());

// Financial reports page featuring interactive filters and charts backed by real data.
export default function ReportsPage() {
  const [project, setProject] = useState("all");
  const [type, setType] = useState("all");
  const [dateRange, setDateRange] = useState(() => ({
    from: getStartOfCurrentYear(),
    to: getTodayDate(),
  }));

  const from = dateRange.from;
  const to = dateRange.to;

  const isDateRangeInvalid = useMemo(() => {
    if (!from || !to) {
      return false;
    }
    const start = new Date(from);
    const end = new Date(to);
    return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start > end;
  }, [from, to]);

  const chartFilters = useMemo(
    () => ({
      projectId: project !== "all" ? project : undefined,
      type: type !== "all" ? type : undefined,
      startDate: from || undefined,
      endDate: to || undefined,
    }),
    [project, type, from, to],
  );

  const [filtersQuery, chartsQuery] = useQueries({
    queries: [
      {
        queryKey: qk.reports.filters(),
        queryFn: ({ signal }) => fetchReportFilters({ signal }),
        staleTime: 5 * 60_000,
      },
      {
        queryKey: qk.reports.charts(chartFilters),
        queryFn: ({ signal }) => fetchReportCharts({ ...chartFilters, signal }),
        enabled: !isDateRangeInvalid,
        placeholderData: (previousData) => previousData,
        staleTime: 30_000,
      },
    ],
  });

  const filtersData = filtersQuery.data;
  const chartsData = chartsQuery.data;

  const filtersLoading = filtersQuery.isLoading;
  const chartsLoading = chartsQuery.isLoading || chartsQuery.isFetching;
  const chartsRefetching = chartsQuery.isFetching && !chartsQuery.isLoading;

  const projectOptions = useMemo(() => filtersData?.projects ?? [], [filtersData?.projects]);
  const typeOptions = useMemo(() => filtersData?.transactionTypes ?? [], [filtersData?.transactionTypes]);
  const availableDateRange = filtersData?.dateRange ?? { earliest: null, latest: null };

  useEffect(() => {
    if (!projectOptions.length || project === "all") {
      return;
    }
    const exists = projectOptions.some((option) => option.value === project);
    if (!exists) {
      setProject("all");
    }
  }, [projectOptions, project]);

  useEffect(() => {
    if (!typeOptions.length || type === "all") {
      return;
    }
    const exists = typeOptions.some((option) => option.value === type);
    if (!exists) {
      setType("all");
    }
  }, [typeOptions, type]);

  useEffect(() => {
    const earliest = availableDateRange.earliest ?? "";
    const latest = availableDateRange.latest ?? "";
    if (!earliest && !latest) {
      return;
    }
    setDateRange((previous) => {
      let nextFrom = previous.from;
      let nextTo = previous.to;

      if (earliest && (!nextFrom || nextFrom < earliest)) {
        nextFrom = earliest;
      }

      if (latest && (!nextTo || nextTo > latest)) {
        nextTo = latest;
      }

      if (nextFrom && nextTo && nextFrom > nextTo) {
        if (latest) {
          nextFrom = latest;
          nextTo = latest;
        } else if (earliest) {
          nextFrom = earliest;
        }
      }

      if (nextFrom === previous.from && nextTo === previous.to) {
        return previous;
      }

      return { from: nextFrom, to: nextTo };
    });
  }, [availableDateRange.earliest, availableDateRange.latest]);

  const appliedDateStart = chartsData?.dateRange?.start ?? null;
  const appliedDateEnd = chartsData?.dateRange?.end ?? null;

  const activeFiltersCaption = useMemo(() => {
    const projectLabel =
      project === "all"
        ? "All projects"
        : projectOptions.find((option) => option.value === project)?.label || "Selected project";
    const typeLabel =
      type === "all"
        ? "Both transaction types"
        : `${typeOptions.find((option) => option.value === type)?.label || "Selected type"} only`;

    let rangeLabel = "Complete history";
    if (appliedDateStart && appliedDateEnd) {
      rangeLabel = `${appliedDateStart} to ${appliedDateEnd}`;
    } else if (appliedDateStart) {
      rangeLabel = `From ${appliedDateStart}`;
    } else if (appliedDateEnd) {
      rangeLabel = `Through ${appliedDateEnd}`;
    }

    return `${projectLabel} · ${typeLabel} · ${rangeLabel}`;
  }, [project, projectOptions, type, typeOptions, appliedDateStart, appliedDateEnd]);

  const summaryData = chartsData?.summary ?? {
    income: 0,
    expense: 0,
    balance: 0,
    counts: { income: 0, expense: 0, total: 0 },
  };

  const summaryCounts = {
    income: Number(summaryData.counts?.income) || 0,
    expense: Number(summaryData.counts?.expense) || 0,
    total: Number(summaryData.counts?.total) || 0,
  };

  const balanceValue = toNumeric(summaryData.balance);

  const summaryMetrics = [
    {
      key: "income",
      label: "Total Income",
      value: formatCurrency(summaryData.income),
      description: `${formatNumber(summaryCounts.income, { minimumFractionDigits: 0 })} income transactions`,
    },
    {
      key: "expense",
      label: "Total Expense",
      value: formatCurrency(summaryData.expense),
      description: `${formatNumber(summaryCounts.expense, { minimumFractionDigits: 0 })} expense transactions`,
    },
    {
      key: "balance",
      label: "Net Balance",
      value: formatCurrency(summaryData.balance),
      description: balanceValue >= 0 ? "Positive cash flow" : "Negative cash flow",
    },
    {
      key: "transactions",
      label: "Transactions",
      value: formatNumber(summaryCounts.total, { minimumFractionDigits: 0 }),
      description: "Total records in the selected range",
    },
  ];

  const filtersErrorMessage = filtersQuery.error?.body?.message || filtersQuery.error?.message;
  const chartsErrorMessage = chartsQuery.error?.body?.message || chartsQuery.error?.message;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financial Reports"
        description="Visualize income, expenses, cash flow, and category trends with interactive reports."
      />

      {(filtersErrorMessage || chartsErrorMessage) && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <ul className="list-disc space-y-1 pl-4">
            {filtersErrorMessage && <li>{filtersErrorMessage}</li>}
            {chartsErrorMessage && <li>{chartsErrorMessage}</li>}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Projects</Label>
            <Select value={project} onValueChange={setProject} disabled={filtersLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projectOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label || item.name || item.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Transaction type</Label>
            <Select value={type} onValueChange={setType} disabled={filtersLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Both" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both</SelectItem>
                {typeOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label || item.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="from-date">From</Label>
            <Input
              id="from-date"
              type="date"
              value={from}
              min={availableDateRange.earliest || undefined}
              max={availableDateRange.latest || undefined}
              onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="to-date">To</Label>
            <Input
              id="to-date"
              type="date"
              value={to}
              min={availableDateRange.earliest || undefined}
              max={availableDateRange.latest || undefined}
              onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {isDateRangeInvalid && (
        <p className="text-sm text-destructive">The start date must be earlier than the end date.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Report Summary</CardTitle>
          <CardDescription>
            Active filters: {activeFiltersCaption}
            {chartsRefetching && <span className="ml-2 text-xs text-muted-foreground">(Refreshing…)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {summaryMetrics.map((metric) => (
            <div key={metric.key} className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {chartsLoading && (
        <p className="text-sm text-muted-foreground">Loading charts…</p>
      )}

      <IncomeExpenseChart data={chartsData?.incomeVsExpense || []} isLoading={chartsLoading} />
      <CashFlowChart data={chartsData?.cashFlow || []} isLoading={chartsLoading} />
      <div className="grid gap-6 lg:grid-cols-2">
        <IncomeCategoryChart
          data={chartsData?.incomeByCategory || []}
          isLoading={chartsLoading}
        />
        <ExpenseCategoryChart
          data={chartsData?.expenseByCategory || []}
          isLoading={chartsLoading}
        />
      </div>
    </div>
  );
}
