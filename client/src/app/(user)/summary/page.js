// File: src/app/(user)/summary/page.js
"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { myPlanQueryOptions } from "@/lib/queries/plans";
import { formatCurrency, formatNumber } from "@/lib/formatters";

const PAGE_SIZE = 20;

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

function focusDropdownSearch(input, selection) {
  if (!input) {
    return () => {};
  }

  const focus = () => {
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }

    if (typeof input.setSelectionRange === "function") {
      const start = typeof selection?.start === "number" ? selection.start : input.value.length;
      const end = typeof selection?.end === "number" ? selection.end : start;
      input.setSelectionRange(start, end);
    }
  };

  if (typeof window !== "undefined") {
    const frame = window.requestAnimationFrame(focus);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }

  focus();
  return () => {};
}

// Summary view combining filters with a tabular report.
export default function SummaryPage() {
  const planQuery = useQuery(myPlanQueryOptions());
  const planLimits = planQuery.data?.plan?.limits ?? {};
  const planSummaryLimits = planLimits.summary ?? {};
  const planFiltersAllowed = planSummaryLimits.allowFilters !== false;
  const planPaginationAllowed = planSummaryLimits.allowPagination !== false;

  const filtersQuery = useQuery({
    queryKey: qk.reports.summaryFilters(),
    queryFn: fetchSummaryFilters,
    enabled: planFiltersAllowed,
  });
  const filtersData = filtersQuery.data;
  const filtersLoading = planFiltersAllowed && filtersQuery.isLoading;
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [from, setFrom] = useState(() => getStartOfCurrentYear());
  const [to, setTo] = useState(() => getTodayDate());
  const [projectSearch, setProjectSearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [subcategoryMenuOpen, setSubcategoryMenuOpen] = useState(false);
  const deferredProjectSearch = useDeferredValue(projectSearch);
  const deferredSubcategorySearch = useDeferredValue(subcategorySearch);
  const projectSearchInputRef = useRef(null);
  const subcategorySearchInputRef = useRef(null);
  const projectSearchSelectionRef = useRef(null);
  const subcategorySearchSelectionRef = useRef(null);
  const filtersKey = useMemo(() => {
    if (!planFiltersAllowed) {
      return {};
    }
    return {
      projectId: projectFilter !== "all" ? projectFilter : undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      startDate: from || undefined,
      endDate: to || undefined,
      subcategory: subcategoryFilter !== "all" ? subcategoryFilter : undefined,
    };
  }, [planFiltersAllowed, projectFilter, typeFilter, from, to, subcategoryFilter]);

  const isDateRangeInvalid = useMemo(() => {
    if (!from || !to) {
      return false;
    }
    const start = new Date(from);
    const end = new Date(to);
    return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start > end;
  }, [from, to]);

  const summaryQueryKeyParams = useMemo(
    () => ({
      ...filtersKey,
      allowFilters: planFiltersAllowed,
      allowPagination: planPaginationAllowed,
    }),
    [filtersKey, planFiltersAllowed, planPaginationAllowed],
  );

  const summaryQuery = useInfiniteQuery({
    queryKey: qk.reports.summaryTable(summaryQueryKeyParams),
    queryFn: ({ pageParam, signal }) =>
      fetchSummaryReport({
        ...filtersKey,
        cursor: planPaginationAllowed ? pageParam?.cursor : undefined,
        limit: planPaginationAllowed ? PAGE_SIZE : undefined,
        signal,
      }),
    initialPageParam: { cursor: undefined },
    getNextPageParam: (lastPage) => {
      if (!planPaginationAllowed) {
        return undefined;
      }
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
  const latestCapabilities = useMemo(() => {
    for (let index = summaryPages.length - 1; index >= 0; index -= 1) {
      const pageCapabilities = summaryPages[index]?.capabilities;
      if (pageCapabilities) {
        return pageCapabilities;
      }
    }
    return null;
  }, [summaryPages]);
  const latestSummary = summaryPages.length ? summaryPages[summaryPages.length - 1]?.summary : null;
  const summaryTotals = latestSummary ?? { income: 0, expense: 0, balance: 0, counts: { income: 0, expense: 0, total: 0 } };
  const summaryCounts = summaryTotals.counts ?? { income: 0, expense: 0, total: 0 };
  const totalCount = summaryPages.length ? summaryPages[0]?.totalCount ?? 0 : 0;

  const filtersCapabilityFromServer = filtersData?.capabilities?.filters;
  const filtersEnabled = planFiltersAllowed && (filtersCapabilityFromServer ?? true) && (latestCapabilities?.filters ?? true);
  const paginationEnabled = planPaginationAllowed && (latestCapabilities?.pagination ?? true);

  const projectOptions = useMemo(() => {
    if (!filtersEnabled) {
      return [];
    }
    return filtersData?.projects ?? [];
  }, [filtersEnabled, filtersData?.projects]);

  const subcategoryOptions = useMemo(() => {
    if (!filtersEnabled) {
      return [];
    }
    return filtersData?.subcategories ?? [];
  }, [filtersEnabled, filtersData?.subcategories]);

  useEffect(() => {
    if (!filtersEnabled) {
      return;
    }
    if (!filtersData?.projects?.length || projectFilter === "all") {
      return;
    }

    const exists = filtersData.projects.some((project) => project.value === projectFilter);
    if (!exists) {
      setProjectFilter("all");
    }
  }, [filtersEnabled, filtersData?.projects, projectFilter]);

  useEffect(() => {
    if (!filtersEnabled) {
      return;
    }
    if (!filtersData?.subcategories?.length || subcategoryFilter === "all") {
      return;
    }

    const exists = filtersData.subcategories.some((item) => item.value === subcategoryFilter);
    if (!exists) {
      setSubcategoryFilter("all");
    }
  }, [filtersEnabled, filtersData?.subcategories, subcategoryFilter]);

  useEffect(() => {
    if (filtersEnabled) {
      return;
    }
    setProjectSearch("");
    setSubcategorySearch("");
    setProjectMenuOpen(false);
    setSubcategoryMenuOpen(false);
  }, [filtersEnabled]);

  const hasTransactions = transactions.length > 0;
  const isInitialLoading = summaryQuery.isLoading;
  const isRefetching = summaryQuery.isRefetching;
  const isFetchingNextPage = summaryQuery.isFetchingNextPage;
  const serverHasNextPage = summaryPages.length
    ? Boolean(summaryPages[summaryPages.length - 1]?.pageInfo?.hasNextPage)
    : false;
  const hasNextPage = paginationEnabled && serverHasNextPage;
  const errorMessage = summaryQuery.error?.body?.message || summaryQuery.error?.message;

  const filteredProjectOptions = useMemo(() => {
    if (!filtersEnabled) {
      return projectOptions;
    }
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
  }, [filtersEnabled, deferredProjectSearch, projectOptions]);
  const selectedProjectOption = useMemo(
    () => projectOptions.find((project) => project.value === projectFilter),
    [projectOptions, projectFilter],
  );
  const isProjectSelectionFilteredOut = useMemo(() => {
    if (!filtersEnabled) {
      return false;
    }
    if (projectFilter === "all") {
      return false;
    }
    return !filteredProjectOptions.some((project) => project.value === projectFilter);
  }, [filtersEnabled, filteredProjectOptions, projectFilter]);
  const filteredSubcategoryOptions = useMemo(() => {
    if (!filtersEnabled) {
      return subcategoryOptions;
    }
    if (!deferredSubcategorySearch) {
      return subcategoryOptions;
    }

    const searchValue = deferredSubcategorySearch.trim().toLowerCase();
    if (!searchValue) {
      return subcategoryOptions;
    }

    return subcategoryOptions.filter((subcategory) => {
      const label = subcategory.label || subcategory.name || "";
      return (
        label.toLowerCase().includes(searchValue) ||
        String(subcategory.value ?? "").toLowerCase().includes(searchValue) ||
        String(subcategory.id ?? "").toLowerCase().includes(searchValue)
      );
    });
  }, [filtersEnabled, deferredSubcategorySearch, subcategoryOptions]);
  const selectedSubcategoryOption = useMemo(
    () =>
      subcategoryOptions.find((subcategory) => subcategory.value === subcategoryFilter),
    [subcategoryOptions, subcategoryFilter],
  );
  const isSubcategorySelectionFilteredOut = useMemo(() => {
    if (!filtersEnabled) {
      return false;
    }
    if (subcategoryFilter === "all") {
      return false;
    }
    return !filteredSubcategoryOptions.some((subcategory) => subcategory.value === subcategoryFilter);
  }, [filtersEnabled, filteredSubcategoryOptions, subcategoryFilter]);

  const handleProjectSearchChange = (event) => {
    if (!filtersEnabled) {
      return;
    }
    const { value, selectionStart, selectionEnd } = event.target;
    setProjectSearch(value);
    projectSearchSelectionRef.current = {
      start: typeof selectionStart === "number" ? selectionStart : value.length,
      end: typeof selectionEnd === "number" ? selectionEnd : value.length,
    };
  };

  const handleSubcategorySearchChange = (event) => {
    if (!filtersEnabled) {
      return;
    }
    const { value, selectionStart, selectionEnd } = event.target;
    setSubcategorySearch(value);
    subcategorySearchSelectionRef.current = {
      start: typeof selectionStart === "number" ? selectionStart : value.length,
      end: typeof selectionEnd === "number" ? selectionEnd : value.length,
    };
  };
  useEffect(() => {
    if (!filtersEnabled || !projectMenuOpen) {
      return undefined;
    }

    return focusDropdownSearch(projectSearchInputRef.current, projectSearchSelectionRef.current);
  }, [filtersEnabled, projectMenuOpen, projectSearch]);

  useEffect(() => {
    if (!filtersEnabled || !subcategoryMenuOpen) {
      return undefined;
    }

    return focusDropdownSearch(
      subcategorySearchInputRef.current,
      subcategorySearchSelectionRef.current,
    );
  }, [filtersEnabled, subcategoryMenuOpen, subcategorySearch]);
  const typeOptions = filtersEnabled ? filtersData?.transactionTypes ?? [] : [];
  const availableDateRange = filtersEnabled
    ? filtersData?.dateRange ?? { earliest: null, latest: null }
    : { earliest: null, latest: null };

  useEffect(() => {
    if (!filtersEnabled) {
      return;
    }
    const earliest = availableDateRange.earliest ?? "";
    const latest = availableDateRange.latest ?? "";

    if (!earliest && !latest) {
      return;
    }

    let nextFrom = from || getStartOfCurrentYear();
    let nextTo = to || getTodayDate();

    if (earliest) {
      if (!nextFrom || nextFrom < earliest) {
        nextFrom = earliest;
      }
      if (!nextTo || nextTo < earliest) {
        nextTo = earliest;
      }
    }

    if (latest) {
      if (!nextFrom || nextFrom > latest) {
        nextFrom = latest;
      }
      if (!nextTo || nextTo > latest) {
        nextTo = latest;
      }
    }

    if (nextFrom && nextTo && nextFrom > nextTo) {
      if (latest) {
        nextFrom = latest;
        nextTo = latest;
      } else if (earliest) {
        nextFrom = earliest;
        nextTo = earliest;
      } else {
        const today = getTodayDate();
        nextFrom = today;
        nextTo = today;
      }
    }

    if (nextFrom !== from) {
      setFrom(nextFrom);
    }

    if (nextTo !== to) {
      setTo(nextTo);
    }
  }, [filtersEnabled, availableDateRange.earliest, availableDateRange.latest, from, to]);

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
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {!filtersEnabled && (
            <div className="md:col-span-2 lg:col-span-4 xl:col-span-5">
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary">
                <p>Filtering is available on Professional and Enterprise plans.</p>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href="/pricing">See plans</Link>
                </Button>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Projects</Label>
            <Select
              value={projectFilter}
              onValueChange={(value) => {
                if (!filtersEnabled) {
                  return;
                }
                setProjectFilter(value);
              }}
              disabled={filtersLoading || !filtersEnabled}
              onOpenChange={(open) => {
                if (!filtersEnabled) {
                  return;
                }
                setProjectMenuOpen(open);
                if (!open) {
                  setProjectSearch("");
                  projectSearchSelectionRef.current = null;
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <div className="sticky top-0 z-10 bg-popover p-2">
                  <Input
                    ref={projectSearchInputRef}
                    value={projectSearch}
                    onChange={handleProjectSearchChange}
                    placeholder="Search projects..."
                    className="h-8"
                    disabled={!filtersEnabled}
                    onKeyDownCapture={(event) => {
                      // Prevent the parent select from capturing the keystroke and stealing focus.
                      event.stopPropagation();
                      if (event.nativeEvent.stopImmediatePropagation) {
                        event.nativeEvent.stopImmediatePropagation();
                      }
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyUpCapture={(event) => {
                      event.stopPropagation();
                      if (event.nativeEvent.stopImmediatePropagation) {
                        event.nativeEvent.stopImmediatePropagation();
                      }
                    }}
                    onKeyUp={(event) => {
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
                {isProjectSelectionFilteredOut && selectedProjectOption ? (
                  <SelectItem
                    key={`__selected_project_${selectedProjectOption.value}`}
                    value={selectedProjectOption.value}
                    className="hidden"
                    aria-hidden="true"
                    style={{ display: "none" }}
                  >
                    {selectedProjectOption.label ||
                      selectedProjectOption.name ||
                      selectedProjectOption.value}
                  </SelectItem>
                ) : null}
                {filteredProjectOptions.length === 0 && (
                  <SelectItem key="__no_results" value="__no_results" disabled className="text-muted-foreground">
                    No projects found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Transaction Type</Label>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                if (!filtersEnabled) {
                  return;
                }
                setTypeFilter(value);
              }}
              disabled={filtersLoading || !filtersEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Both types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both</SelectItem>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Subcategories</Label>
            <Select
              value={subcategoryFilter}
              onValueChange={(value) => {
                if (!filtersEnabled) {
                  return;
                }
                setSubcategoryFilter(value);
              }}
              disabled={filtersLoading || !filtersEnabled}
              onOpenChange={(open) => {
                if (!filtersEnabled) {
                  return;
                }
                setSubcategoryMenuOpen(open);
                if (!open) {
                  setSubcategorySearch("");
                  subcategorySearchSelectionRef.current = null;
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All subcategories" />
              </SelectTrigger>
              <SelectContent>
                <div className="sticky top-0 z-10 bg-popover p-2">
                  <Input
                    ref={subcategorySearchInputRef}
                    value={subcategorySearch}
                    onChange={handleSubcategorySearchChange}
                    placeholder="Search subcategories..."
                    className="h-8"
                    disabled={!filtersEnabled}
                    onKeyDownCapture={(event) => {
                      event.stopPropagation();
                      if (event.nativeEvent.stopImmediatePropagation) {
                        event.nativeEvent.stopImmediatePropagation();
                      }
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyUpCapture={(event) => {
                      event.stopPropagation();
                      if (event.nativeEvent.stopImmediatePropagation) {
                        event.nativeEvent.stopImmediatePropagation();
                      }
                    }}
                    onKeyUp={(event) => {
                      event.stopPropagation();
                    }}
                  />
                </div>
                <SelectItem value="all">All subcategories</SelectItem>
                {filteredSubcategoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                {isSubcategorySelectionFilteredOut && selectedSubcategoryOption ? (
                  <SelectItem
                    key={`__selected_subcategory_${selectedSubcategoryOption.value}`}
                    value={selectedSubcategoryOption.value}
                    className="hidden"
                    aria-hidden="true"
                    style={{ display: "none" }}
                  >
                    {selectedSubcategoryOption.label ||
                      selectedSubcategoryOption.name ||
                      selectedSubcategoryOption.value}
                  </SelectItem>
                ) : null}
                {filteredSubcategoryOptions.length === 0 && (
                  <SelectItem key="__no_subcategories" value="__no_subcategories" disabled className="text-muted-foreground">
                    No subcategories found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary-from">From</Label>
            <Input
              id="summary-from"
              type="date"
              value={from}
              min={availableDateRange.earliest || undefined}
              max={availableDateRange.latest || undefined}
              onChange={(event) => setFrom(event.target.value)}
              disabled={!filtersEnabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary-to">To</Label>
            <Input
              id="summary-to"
              type="date"
              value={to}
              min={availableDateRange.earliest || undefined}
              max={availableDateRange.latest || undefined}
              onChange={(event) => setTo(event.target.value)}
              disabled={!filtersEnabled}
            />
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
            <p className="text-2xl font-semibold">{formatCurrency(summaryTotals.income)}</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(summaryCounts.income, { minimumFractionDigits: 0 })} income transactions
            </p>
          </div>
          <div className="space-y-1 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-2xl font-semibold">{formatCurrency(summaryTotals.expense)}</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(summaryCounts.expense, { minimumFractionDigits: 0 })} expense transactions
            </p>
          </div>
          <div className="space-y-1 rounded-lg border p-4 lg:col-span-1">
            <p className="text-sm text-muted-foreground">Net balance</p>
            <p className="text-2xl font-semibold">{formatCurrency(summaryTotals.balance)}</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(summaryCounts.total, { minimumFractionDigits: 0 })} total transactions
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-1 sm:flex sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>Transaction Records</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isInitialLoading
                ? "Loading transactions..."
                : `Showing ${formatNumber(transactions.length, { minimumFractionDigits: 0 })} of ${formatNumber(totalCount, { minimumFractionDigits: 0 })} transactions`}
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
                      <TableHead>Projects</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subcategories</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.date}</TableCell>
                        <TableCell>{item.projectName || item.projectId || "--"}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.subcategory || "--"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!hasTransactions && !isRefetching && !summaryQuery.isError && (
                  <p className="p-4 text-sm text-muted-foreground">
                    {filtersEnabled
                      ? "No transactions match the selected filters."
                      : "No transactions recorded yet."}
                  </p>
                )}
                {isRefetching && !isInitialLoading && (
                  <div className="p-4 text-sm text-muted-foreground">Updating results…</div>
                )}
                {hasNextPage && paginationEnabled && (
                  <div className="mt-4 flex justify-center">
                    <Button onClick={() => summaryQuery.fetchNextPage()} disabled={isFetchingNextPage}>
                      {isFetchingNextPage ? "Loading more..." : "Load more"}
                    </Button>
                  </div>
                )}
                {!paginationEnabled && (
                  <div className="mt-4 flex flex-col items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-4 text-center text-sm text-primary">
                    <p>Upgrade to paginate through your full transaction history.</p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/pricing">Explore plans</Link>
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
