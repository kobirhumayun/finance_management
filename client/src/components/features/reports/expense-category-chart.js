// File: src/components/features/reports/expense-category-chart.js
"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";

const COLORS = [
  "var(--chart-expense, var(--primary))",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const toNumber = (value) => {
  const numeric = toNumeric(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatCurrency = (value) => currencyFormatter.format(toNumber(value));

function CategoryTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const entry = payload[0];
  const percentage = entry.payload?.percentage ?? 0;

  return (
    <div className="min-w-[180px] rounded-md border bg-popover/95 p-3 text-sm shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          {entry.name}
        </span>
        <span className="font-semibold text-foreground">{formatCurrency(entry.value)}</span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{percentage.toFixed(1)}% of total expenses</div>
    </div>
  );
}

// Donut chart representing expense distribution with a detailed legend.
export default function ExpenseCategoryChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    const processed = data
      .map((item) => ({
        name: typeof item?.name === "string" ? item.name.trim() : String(item?.name ?? ""),
        value: toNumber(item?.value),
      }))
      .filter((item) => item.name && Number.isFinite(item.value) && item.value > 0);

    const total = processed.reduce((sum, item) => sum + item.value, 0);

    return processed.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [data]);

  const totalAmount = useMemo(() => chartData.reduce((sum, item) => sum + item.value, 0), [chartData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense by Category</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
        {chartData.length === 0 ? (
          <div className="flex h-[320px] w-full items-center justify-center text-sm text-muted-foreground">
            No categorized expense data available for the selected filters.
          </div>
        ) : (
          <>
            <div className="h-[320px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={3}
                    cornerRadius={8}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CategoryTooltip />} wrapperStyle={{ outline: "none" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex w-full flex-col gap-4 lg:w-72">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total categorized spend</p>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                {chartData.map((item, index) => (
                  <li key={item.name} className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        aria-hidden
                      />
                      <div>
                        <div className="font-medium text-foreground">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.percentage.toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-foreground">{formatCurrency(item.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
