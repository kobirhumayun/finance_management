// File: src/components/features/reports/income-expense-chart.js
"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";

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

const formatTick = (value) => {
  if (!Number.isFinite(value)) {
    return "$0";
  }

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absolute >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absolute >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }

  return currencyFormatter.format(value);
};

const buildSegments = (max) => {
  if (!Number.isFinite(max) || max <= 0) {
    return [];
  }

  const anchors = [0.25, 0.5, 0.75, 1];
  return anchors.map((ratio) => ({
    ratio,
    value: max * ratio,
    label: `${Math.round(ratio * 100)}%`,
  }));
};

function FlowTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const items = payload.filter((entry) => entry?.value !== undefined);
  const net = items.reduce((total, entry) => {
    if (entry.dataKey === "income") return total + toNumber(entry.value);
    if (entry.dataKey === "expense") return total - toNumber(entry.value);
    return total;
  }, 0);

  return (
    <div className="min-w-[220px] rounded-md border bg-popover/95 p-3 text-sm shadow-lg backdrop-blur">
      <div className="mb-2 font-semibold leading-none text-foreground">{label}</div>
      <ul className="space-y-2">
        {items.map((entry) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {entry.name}
            </span>
            <span className="font-medium text-foreground">{formatCurrency(entry.value)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
        <span>Net Flow</span>
        <span className="font-semibold text-foreground">{formatCurrency(net)}</span>
      </div>
    </div>
  );
}

// Multi-series line chart illustrating income and expense trends over time.
export default function IncomeExpenseChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => {
        const month = typeof item?.month === "string" ? item.month.trim() : String(item?.month ?? "");
        if (!month) {
          return null;
        }

        return {
          month,
          income: toNumber(item?.income),
          expense: toNumber(item?.expense),
        };
      })
      .filter(Boolean);
  }, [data]);

  const extremes = useMemo(() => {
    return chartData.reduce(
      (acc, item) => {
        const values = [item.income, item.expense];
        values.forEach((value) => {
          if (!Number.isFinite(value)) return;
          acc.max = Math.max(acc.max, value);
          acc.min = Math.min(acc.min, value);
        });
        return acc;
      },
      { min: 0, max: 0 },
    );
  }, [chartData]);

  const domain = useMemo(() => {
    const buffer = Math.max(extremes.max * 0.1, 100);
    const upper = Math.max(extremes.max + buffer, 0);
    return [0, upper];
  }, [extremes.max]);

  const segments = useMemo(() => buildSegments(domain[1]), [domain]);

  const incomeColor = "var(--chart-income, var(--primary))";
  const expenseColor = "var(--chart-expense, var(--chart-2))";
  const axisColor = "var(--muted-foreground)";
  const gridColor = "var(--border)";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income &amp; Expense Flow</CardTitle>
      </CardHeader>
      <CardContent className="h-[360px] sm:h-[400px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No income or expense data available for the selected filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="4 4" strokeOpacity={0.4} />
              <XAxis
                dataKey="month"
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                minTickGap={12}
              />
              <YAxis
                domain={domain}
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTick}
              />
              <Tooltip
                content={<FlowTooltip />}
                cursor={{ stroke: "var(--ring)", strokeWidth: 1.5 }}
                wrapperStyle={{ outline: "none" }}
              />
              {segments.map((segment) => (
                <ReferenceLine
                  key={segment.ratio}
                  y={segment.value}
                  stroke={gridColor}
                  strokeOpacity={segment.ratio === 1 ? 0.6 : 0.3}
                  strokeDasharray={segment.ratio === 1 ? "" : "6 6"}
                  ifOverflow="extendDomain"
                />
              ))}
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: 8 }}
              />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke={incomeColor}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expense"
                stroke={expenseColor}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
