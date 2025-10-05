// File: src/app/(user)/summary/page.js
"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { qk } from "@/lib/query-keys";
import { fetchSummaryFilters, fetchSummaryReport } from "@/lib/queries/reports";

const PAGE_SIZE = 20;

// Summary view combining filters with a tabular report.
export default function SummaryPage() {
  const { data: filtersData, isLoading: filtersLoading } = useQuery({
    queryKey: qk.reports.filters(),
    queryFn: fetchSummaryFilters,
  });
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const deferredProjectSearch = useDeferredValue(projectSearch);
  const projectOptions = useMemo(() => filtersData?.projects ?? [], [filtersData?.projects]);

  useEffect(() => {
    if (!filtersData?.projects?.length || projectFilter === "all") {
      return;
    }

    const exists = filtersData.projects.some((project) => project.value === projectFilter);
    if (!exists) {
      setProjectFilter("all");
    }
  }, [filtersData?.projects, projectFilter]);

  const filtersKey = useMemo(() => ({
    projectId: projectFilter !== "all" ? projectFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    startDate: from || undefined,
    endDate: to || undefined,
  }), [projectFilter, typeFilter, from, to]);

  const isDateRangeInvalid = useMemo(() => {
    if (!from || !to) {
      return false;
    }
    const start = new Date(from);
    const end = new Date(to);
    return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start > end;
  }, [from, to]);

  const summaryQuery = useInfiniteQuery({
    queryKey: qk.reports.summaryTable(filtersKey),
    queryFn: ({ pageParam, signal }) =>
      fetchSummaryReport({
        ...filtersKey,
        cursor: pageParam?.cursor,
        limit: PAGE_SIZE,
        signal,
      }),
    initialPageParam: { cursor: undefined },
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pageInfo?.hasNextPage) {
        return undefined;
      }
      return { cursor: lastPage.pageInfo.nextCursor ?? undefined };
    },
    enabled: !isDateRangeInvalid,
    staleTime: 30_000,
  });

  const transactions = useMemo(() => {
    const pages = summaryQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.transactions ?? []);
  }, [summaryQuery.data]);

  const summaryPages = summaryQuery.data?.pages ?? [];
  const latestSummary = summaryPages.length ? summaryPages[summaryPages.length - 1]?.summary : null;
  const summaryTotals = latestSummary ?? { income: 0, expense: 0, balance: 0, counts: { income: 0, expense: 0, total: 0 } };
  const summaryCounts = summaryTotals.counts ?? { income: 0, expense: 0, total: 0 };
  const totalCount = summaryPages.length ? summaryPages[0]?.totalCount ?? 0 : 0;

  const hasTransactions = transactions.length > 0;
  const isInitialLoading = summaryQuery.isLoading;
  const isRefetching = summaryQuery.isRefetching;
  const isFetchingNextPage = summaryQuery.isFetchingNextPage;
  const hasNextPage = Boolean(summaryQuery.hasNextPage);
  const errorMessage = summaryQuery.error?.body?.message || summaryQuery.error?.message;

  const filteredProjectOptions = useMemo(() => {
    if (!deferredProjectSearch) {
      return projectOptions;
    }

    const searchValue = deferredProjectSearch.trim().toLowerCase();
    if (!searchValue) {
      return projectOptions;
    }

    return projectOptions.filter((project) => {
      const name = project.label || project.name || "";
      return (
        name.toLowerCase().includes(searchValue) ||
        String(project.value ?? "").toLowerCase().includes(searchValue) ||
        String(project.id ?? "").toLowerCase().includes(searchValue)
      );
    });
  }, [deferredProjectSearch, projectOptions]);
  const typeOptions = filtersData?.transactionTypes ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Summary"
        description="Filter financial activity across projects and export insights."
      />
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select
              value={projectFilter}
              onValueChange={setProjectFilter}
              disabled={filtersLoading}
              onOpenChange={(open) => {
                if (!open) {
                  setProjectSearch("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <div className="sticky top-0 z-10 bg-popover p-2">
                  <Input
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder="Search projects..."
                    className="h-8"
                    onKeyDown={(event) => {
                      // Prevent the parent select from capturing the keystroke and stealing focus.
                      event.stopPropagation();
                    }}
                  />
                </div>
                <SelectItem value="all">All projects</SelectItem>
                {filteredProjectOptions.map((project) => (
                  <SelectItem key={project.value} value={project.value}>
                    {project.label || project.name || project.value}
                  </SelectItem>
                ))}
                {filteredProjectOptions.length === 0 && (
                  <SelectItem key="__no_results" value="__no_results" disabled className="text-muted-foreground">
                    No projects found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter} disabled={filtersLoading}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary-from">From</Label>
            <Input id="summary-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary-to">To</Label>
            <Input id="summary-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Income</p>
            <p className="text-2xl font-semibold">${summaryTotals.income.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{summaryCounts.income} income transactions</p>
          </div>
          <div className="space-y-1 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-2xl font-semibold">${summaryTotals.expense.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{summaryCounts.expense} expense transactions</p>
          </div>
          <div className="space-y-1 rounded-lg border p-4 lg:col-span-1">
            <p className="text-sm text-muted-foreground">Net balance</p>
            <p className="text-2xl font-semibold">${summaryTotals.balance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{summaryCounts.total} total transactions</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-1 sm:flex sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isInitialLoading
                ? "Loading transactions..."
                : `Showing ${transactions.length.toLocaleString()} of ${totalCount.toLocaleString()} transactions`}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isDateRangeInvalid ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Start date cannot be later than end date.
            </p>
          ) : isInitialLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {summaryQuery.isError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {errorMessage || "Unable to load transactions."}
                </p>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.date}</TableCell>
                        <TableCell>{item.projectName || item.projectId || "--"}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.category || "--"}</TableCell>
                        <TableCell className="text-right font-medium">${item.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!hasTransactions && !isRefetching && !summaryQuery.isError && (
                  <p className="p-4 text-sm text-muted-foreground">No transactions match the selected filters.</p>
                )}
                {isRefetching && !isInitialLoading && (
                  <div className="p-4 text-sm text-muted-foreground">Updating results…</div>
                )}
                {hasNextPage && (
                  <div className="mt-4 flex justify-center">
                    <Button onClick={() => summaryQuery.fetchNextPage()} disabled={isFetchingNextPage}>
                      {isFetchingNextPage ? "Loading more..." : "Load more"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
