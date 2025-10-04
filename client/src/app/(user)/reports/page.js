// File: src/app/(user)/reports/page.js
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/page-header";
import IncomeExpenseChart from "@/components/features/reports/income-expense-chart";
import ExpenseCategoryChart from "@/components/features/reports/expense-category-chart";
import CashFlowChart from "@/components/features/reports/cash-flow-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { qk } from "@/lib/query-keys";
import { fetchReportFilters, fetchChartSeries } from "@/lib/mock-data";

// Financial reports page featuring interactive filters and charts.
export default function ReportsPage() {
  const { data: filters } = useQuery({ queryKey: qk.reports.filters(), queryFn: fetchReportFilters });
  const { data: charts } = useQuery({ queryKey: qk.reports.charts(), queryFn: fetchChartSeries });

  const [project, setProject] = useState("all");
  const [type, setType] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financial Reports"
        description="Visualize income, expenses, and cash flow trends using interactive charts."
      />
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {filters?.projects?.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Transaction type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {filters?.transactionTypes?.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
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
              value={dateRange.from}
              onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="to-date">To</Label>
            <Input
              id="to-date"
              type="date"
              value={dateRange.to}
              onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <IncomeExpenseChart data={charts?.incomeVsExpense || []} />
        <ExpenseCategoryChart data={charts?.expenseByCategory || []} />
      </div>
      <CashFlowChart data={charts?.cashFlow || []} />
    </div>
  );
}
