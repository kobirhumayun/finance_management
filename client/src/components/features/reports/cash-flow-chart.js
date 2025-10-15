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
import { useCSSVariable } from "@/hooks/use-css-variable";

const CHART_MARGIN = { top: 16, right: 24, bottom: 16, left: 0 };

const formatCurrencyTick = (value) => {
  if (!Number.isFinite(value)) {
    return "৳0";
  }

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `৳${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (absolute >= 1_000_000_000) return `৳${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `৳${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `৳${(value / 1_000).toFixed(1)}k`;

  return `৳${value.toLocaleString()}`;
};

const formatCurrency = (value) => `৳${toNumeric(value).toLocaleString()}`;

const normalizeMonth = (value) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const buildChartData = (rows) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((entry) => {
      const month = normalizeMonth(entry?.month);
      if (!month) return null;

      return {
        month,
        cashIn: toNumeric(entry?.cashIn),
        cashOut: toNumeric(entry?.cashOut),
      };
    })
    .filter(Boolean);
};

const getYAxisDomain = (rows) => {
  if (!rows.length) {
    return [0, "auto"];
  }

  let minValue = 0;
  let maxValue = 0;

  rows.forEach((row) => {
    const income = toNumeric(row.cashIn);
    const expense = toNumeric(row.cashOut);

    minValue = Math.min(minValue, income, expense);
    maxValue = Math.max(maxValue, income, expense);
  });

  if (minValue === maxValue) {
    if (maxValue === 0) {
      return [0, "auto"];
    }

    const padding = Math.abs(maxValue) * 0.1;
    return [minValue - padding, maxValue + padding];
  }

  const padding = Math.max(Math.abs(maxValue), Math.abs(minValue)) * 0.1;
  return [minValue - padding, maxValue + padding];
};

function ChartLegend({ payload }) {
  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {payload.map((entry, index) => (
        <div key={entry.dataKey ?? entry.value ?? index} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function CashFlowTooltipContent({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const cashIn = payload.find((item) => item.dataKey === "cashIn")?.value ?? 0;
  const cashOut = payload.find((item) => item.dataKey === "cashOut")?.value ?? 0;
  const balance = toNumeric(cashIn) - toNumeric(cashOut);

  return (
    <div className="min-w-[200px] rounded-md border bg-popover p-3 text-sm shadow-md">
      <div className="mb-2 font-medium">{label}</div>
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {entry.name}
            </span>
            <span className="font-medium">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
        <span>Net Balance</span>
        <span className="font-medium text-foreground">{formatCurrency(balance)}</span>
      </div>
    </div>
  );
}

export default function CashFlowChart({ data = [] }) {
  const chartData = useMemo(() => buildChartData(data), [data]);
  const yAxisDomain = useMemo(() => getYAxisDomain(chartData), [chartData]);

  const incomeColor = useCSSVariable("--chart-income");
  const expenseColor = useCSSVariable("--chart-expense");
  const borderColor = useCSSVariable("--border");
  const ringColor = useCSSVariable("--ring");

  const highlightColor = ringColor || incomeColor || expenseColor;
  const shouldRenderZeroLine = yAxisDomain[0] < 0 && yAxisDomain[1] > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid stroke={borderColor} strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              stroke="currentColor"
              fontSize={12}
            />
            <YAxis
              width={80}
              tickFormatter={formatCurrencyTick}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              stroke="currentColor"
              domain={yAxisDomain}
            />
            <Tooltip
              cursor={{ stroke: highlightColor, strokeWidth: 1.5 }}
              content={<CashFlowTooltipContent />}
            />
            <Legend verticalAlign="bottom" content={<ChartLegend />} />
            {shouldRenderZeroLine ? (
              <ReferenceLine y={0} stroke={borderColor} strokeDasharray="4 4" />
            ) : null}
            <Line
              type="monotone"
              dataKey="cashIn"
              name="Cash In"
              stroke={incomeColor}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5, strokeWidth: 1, stroke: highlightColor }}
            />
            <Line
              type="monotone"
              dataKey="cashOut"
              name="Cash Out"
              stroke={expenseColor}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5, strokeWidth: 1, stroke: highlightColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
