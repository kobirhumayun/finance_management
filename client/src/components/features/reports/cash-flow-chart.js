// File: src/components/features/reports/cash-flow-chart.js
"use client";

import { useCallback, useMemo, useState } from "react";
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

const toLabel = (value) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const toNumber = (value) => toNumeric(value);

const formatCurrency = (value) => {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) {
    return "$0";
  }

  return `$${numeric.toLocaleString()}`;
};

const formatCurrencyTick = (value) => {
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
  return `$${value.toLocaleString()}`;
};

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
});

const parseMonthValue = (value) => {
  if (!value) {
    return null;
  }

  const directParse = new Date(value);
  if (Number.isFinite(directParse.getTime())) {
    return new Date(
      Date.UTC(directParse.getUTCFullYear(), directParse.getUTCMonth(), 1),
    );
  }

  const normalized = value.replace(/[-/.]/g, " ");
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const [first, second] = parts;
    const monthIndex = Number.parseInt(first, 10) - 1;
    const year = Number.parseInt(second, 10);
    if (Number.isFinite(monthIndex) && Number.isFinite(year) && monthIndex >= 0 && monthIndex < 12) {
      return new Date(Date.UTC(year, monthIndex, 1));
    }
  }

  return null;
};

function CashFlowTooltip({ active, payload }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const { label, date, cashIn, cashOut } = payload[0]?.payload ?? {};
  const displayLabel = label ?? (Number.isFinite(date) ? monthFormatter.format(new Date(date)) : "");
  const totals = {
    cashIn: toNumber(cashIn),
    cashOut: toNumber(cashOut),
  };
  const net = totals.cashIn - totals.cashOut;

  return (
    <div className="min-w-[220px] rounded-md border bg-popover p-3 text-sm shadow-md">
      <div className="mb-2 font-medium">{displayLabel}</div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" aria-hidden />
            Cash In
          </span>
          <span className="font-medium">{formatCurrency(totals.cashIn)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-3)]" aria-hidden />
            Cash Out
          </span>
          <span className="font-medium">{formatCurrency(totals.cashOut)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
        <span>Net Flow</span>
        <span className="font-medium text-foreground">{formatCurrency(net)}</span>
      </div>
    </div>
  );
}

// Line chart visualizing cash flow trends.
export default function CashFlowChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => {
        const rawLabel = toLabel(item?.month);
        const monthDate = parseMonthValue(rawLabel);

        if (!monthDate) {
          return null;
        }

        const cashIn = toNumber(item?.cashIn);
        const cashOut = toNumber(item?.cashOut);

        return {
          date: monthDate.getTime(),
          label: monthFormatter.format(monthDate),
          cashIn,
          cashOut,
          net: cashIn - cashOut,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date - b.date);
  }, [data]);

  const yExtents = useMemo(() => {
    if (chartData.length === 0) {
      return { min: 0, max: 0 };
    }

    return chartData.reduce(
      (accumulator, item) => {
        const values = [toNumber(item.cashIn), toNumber(item.cashOut), toNumber(item.net)];
        values.forEach((value) => {
          if (!Number.isFinite(value)) {
            return;
          }
          accumulator.min = Math.min(accumulator.min, value);
          accumulator.max = Math.max(accumulator.max, value);
        });
        return accumulator;
      },
      { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    );
  }, [chartData]);

  const segmentLines = useMemo(() => {
    const min = yExtents.min;
    const max = yExtents.max;

    if (!Number.isFinite(min) || !Number.isFinite(max) || min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
      return [];
    }

    if (min === max) {
      return [min];
    }

    const segmentCount = 4;
    const range = max - min;
    if (range <= 0) {
      return [];
    }

    return Array.from({ length: segmentCount - 1 }, (_, index) => min + ((index + 1) * range) / segmentCount);
  }, [yExtents.min, yExtents.max]);

  const [tooltipPosition, setTooltipPosition] = useState(null);

  const xTicks = useMemo(() => chartData.map((item) => item.date), [chartData]);
  const labelByDate = useMemo(() => {
    return chartData.reduce((accumulator, item) => {
      accumulator[item.date] = item.label;
      return accumulator;
    }, {});
  }, [chartData]);

  const handleMouseMove = useCallback((state) => {
    if (!state || !state.isTooltipActive) {
      setTooltipPosition(null);
      return;
    }

    if (typeof state.chartX !== "number" || typeof state.chartY !== "number") {
      setTooltipPosition(null);
      return;
    }

    setTooltipPosition({
      x: state.chartX + 16,
      y: state.chartY - 24,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipPosition(null);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[360px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No cash flow data available for the selected filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <CartesianGrid strokeDasharray="4 8" strokeOpacity={0.25} />
              <XAxis
                dataKey="date"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={xTicks}
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => labelByDate[value] ?? monthFormatter.format(new Date(value))}
                tickMargin={12}
              />
              <YAxis
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrencyTick}
                width={80}
              />
              <Tooltip
                cursor={{ stroke: "var(--ring)", strokeWidth: 1 }}
                content={<CashFlowTooltip />}
                position={tooltipPosition ?? undefined}
                wrapperStyle={{ pointerEvents: "none" }}
                allowEscapeViewBox={{ x: true, y: true }}
              />
              {segmentLines.map((value, index) => (
                <ReferenceLine
                  key={`segment-${index}`}
                  y={value}
                  stroke="var(--border)"
                  strokeDasharray="6 6"
                  strokeOpacity={0.5}
                  ifOverflow="extendDomain"
                />
              ))}
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Line
                type="monotone"
                dataKey="cashIn"
                name="Cash In"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="cashOut"
                name="Cash Out"
                stroke="var(--chart-3)"
                strokeWidth={2}
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
