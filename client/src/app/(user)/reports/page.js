// File: src/app/(user)/reports/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import IncomeExpenseChart from "@/components/features/reports/income-expense-chart";
import ExpenseCategoryChart from "@/components/features/reports/expense-category-chart";
import CashFlowChart from "@/components/features/reports/cash-flow-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { qk } from "@/lib/query-keys";
import { fetchReportCharts, fetchReportFilters } from "@/lib/queries/reports";
import { toNumeric } from "@/lib/utils/numbers";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const integerFormatter = new Intl.NumberFormat("en-US");

const toNumber = (value) => toNumeric(value);

const formatCurrency = (value) => currencyFormatter.format(toNumber(value));
const formatInteger = (value) => integerFormatter.format(Math.round(toNumber(value)));

// Financial reports page featuring interactive filters and charts backed by real data.
export default function ReportsPage() {
  const [project, setProject] = useState("all");
  const [type, setType] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

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
    if (dateRange.from || dateRange.to) {
      return;
    }
    const earliest = availableDateRange.earliest ?? "";
    const latest = availableDateRange.latest ?? "";
    if (!earliest && !latest) {
      return;
    }
    setDateRange({ from: earliest || "", to: latest || "" });
  }, [availableDateRange.earliest, availableDateRange.latest, dateRange.from, dateRange.to]);

  const appliedDateStart = chartsData?.dateRange?.start ?? null;
  const appliedDateEnd = chartsData?.dateRange?.end ?? null;

  const activeFiltersCaption = useMemo(() => {
    const projectLabel =
      project === "all"
        ? "All projects"
        : projectOptions.find((option) => option.value === project)?.label || "Selected project";
    const typeLabel =
      type === "all"
        ? "All transaction types"
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

  const summaryMetrics = [
    {
      key: "income",
      label: "Total Income",
      value: formatCurrency(summaryData.income),
      description: `${formatInteger(summaryCounts.income)} income transactions`,
    },
    {
      key: "expense",
      label: "Total Expense",
      value: formatCurrency(summaryData.expense),
      description: `${formatInteger(summaryCounts.expense)} expense transactions`,
    },
    {
      key: "balance",
      label: "Net Balance",
      value: formatCurrency(summaryData.balance),
      description: summaryData.balance >= 0 ? "Positive cash flow" : "Negative cash flow",
    },
    {
      key: "transactions",
      label: "Transactions",
      value: formatInteger(summaryCounts.total),
      description: "Total records in the selected range",
    },
  ];

  const filtersErrorMessage = filtersQuery.error?.body?.message || filtersQuery.error?.message;
  const chartsErrorMessage = chartsQuery.error?.body?.message || chartsQuery.error?.message;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financial Reports"
        description="Visualize income, expenses, and cash flow trends using interactive charts."
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
            <Label>Project</Label>
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
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
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

      <IncomeExpenseChart data={chartsData?.incomeVsExpense || []} />

      <CashFlowChart data={chartsData?.cashFlow || []} />

      <ExpenseCategoryChart data={chartsData?.expenseByCategory || []} />
    </div>
  );
}
