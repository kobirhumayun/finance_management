// File: src/components/features/reports/cash-flow-chart.js
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

const formatYAxisTick = (value) => {
  if (!Number.isFinite(value)) {
    return "$0";
  }

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) {
    return `${value < 0 ? "-" : ""}$${(absolute / 1_000_000_000).toFixed(1)}B`;
  }
  if (absolute >= 1_000_000) {
    return `${value < 0 ? "-" : ""}$${(absolute / 1_000_000).toFixed(1)}M`;
  }
  if (absolute >= 1_000) {
    return `${value < 0 ? "-" : ""}$${(absolute / 1_000).toFixed(1)}k`;
  }

  return currencyFormatter.format(value);
};

const buildSegments = (min, max) => {
  const lines = [];
  const anchors = [0.25, 0.5, 0.75, 1];

  if (max > 0) {
    anchors.forEach((ratio) => {
      lines.push({ key: `pos-${ratio}`, value: max * ratio, opacity: ratio === 1 ? 0.6 : 0.3 });
    });
  }

  if (min < 0) {
    anchors.forEach((ratio) => {
      lines.push({ key: `neg-${ratio}`, value: min * ratio, opacity: ratio === 1 ? 0.6 : 0.3 });
    });
  }

  lines.push({ key: "zero", value: 0, opacity: 0.7, highlight: true });

  return lines;
};

function CashFlowTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const entries = payload.filter((item) => item?.value !== undefined);
  const netEntry = entries.find((item) => item.dataKey === "net");

  return (
    <div className="min-w-[220px] rounded-md border bg-popover/95 p-3 text-sm shadow-lg backdrop-blur">
      <div className="mb-2 font-semibold leading-none text-foreground">{label}</div>
      <ul className="space-y-2">
        {entries
          .filter((item) => item.dataKey !== "net")
          .map((entry) => (
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
        <span>Net Cash Flow</span>
        <span className="font-semibold text-foreground">
          {formatCurrency(netEntry?.value ?? 0)}
        </span>
      </div>
    </div>
  );
}

// Cash flow trend chart visualizing monthly cash in, cash out, and net performance.
export default function CashFlowChart({ data = [] }) {
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

        const cashIn = toNumber(item?.cashIn);
        const cashOut = toNumber(item?.cashOut);
        const net = cashIn - cashOut;

        return { month, cashIn, cashOut, net };
      })
      .filter(Boolean);
  }, [data]);

  const extremes = useMemo(() => {
    return chartData.reduce(
      (acc, item) => {
        [item.cashIn, item.cashOut, item.net].forEach((value) => {
          if (!Number.isFinite(value)) return;
          acc.max = Math.max(acc.max, value);
          acc.min = Math.min(acc.min, value);
        });
        return acc;
      },
      { min: 0, max: 0 },
    );
  }, [chartData]);

  const buffer = useMemo(() => {
    const absoluteMax = Math.max(Math.abs(extremes.min), Math.abs(extremes.max));
    return Math.max(absoluteMax * 0.1, 100);
  }, [extremes.min, extremes.max]);

  const domain = useMemo(() => {
    const upper = Math.max(extremes.max + buffer, buffer);
    const lower = Math.min(extremes.min - buffer, -buffer);
    return [lower, upper];
  }, [extremes.max, extremes.min, buffer]);

  const segments = useMemo(() => buildSegments(domain[0], domain[1]), [domain]);

  const cashInColor = "var(--chart-income, var(--primary))";
  const cashOutColor = "var(--chart-expense, var(--chart-3))";
  const netColor = "var(--chart-4)";
  const gridColor = "var(--border)";
  const axisColor = "var(--muted-foreground)";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[380px] sm:h-[420px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No cash flow data available for the selected filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="4 4" strokeOpacity={0.35} />
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
                tickFormatter={formatYAxisTick}
              />
              <Tooltip
                content={<CashFlowTooltip />}
                cursor={{ stroke: "var(--ring)", strokeWidth: 1.5 }}
                wrapperStyle={{ outline: "none" }}
              />
              {segments.map((segment) => (
                <ReferenceLine
                  key={segment.key}
                  y={segment.value}
                  stroke={gridColor}
                  strokeOpacity={segment.highlight ? 0.75 : segment.opacity}
                  strokeDasharray={segment.highlight ? "" : "6 6"}
                  ifOverflow="extendDomain"
                />
              ))}
              <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: 8 }} />
              <Line
                type="monotone"
                dataKey="cashIn"
                name="Cash In"
                stroke={cashInColor}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="cashOut"
                name="Cash Out"
                stroke={cashOutColor}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net Flow"
                stroke={netColor}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
