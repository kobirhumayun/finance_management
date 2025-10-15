"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";
import { useCSSVariable } from "@/hooks/use-css-variable";

const CHART_MARGIN = { top: 16, right: 16, bottom: 48, left: 16 };

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
  const maxSeriesValue = rows.reduce((max, item) => {
    return Math.max(max, Math.abs(item.cashIn ?? 0), Math.abs(item.cashOut ?? 0));
  }, 0);

  if (!Number.isFinite(maxSeriesValue) || maxSeriesValue <= 0) {
    return [0, "auto"];
  }

  return [0, maxSeriesValue];
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

function CashFlowTooltipCursor({
  fill,
  fillOpacity = 0.16,
  itemCount = 1,
  points,
  x,
  y,
  width,
  height,
  viewBox,
  activeCoordinate,
}) {
  const color = fill || "var(--ring)";

  const plotHeight = Number.isFinite(height) && height > 0
    ? height
    : Number.isFinite(viewBox?.height) && viewBox.height > 0
      ? viewBox.height
      : null;

  if (!Number.isFinite(plotHeight) || plotHeight <= 0) {
    return null;
  }

  const plotTop = Number.isFinite(y)
    ? y
    : Number.isFinite(viewBox?.y)
      ? viewBox.y
      : 0;

  const plotLeft = Number.isFinite(viewBox?.x) ? viewBox.x : 0;
  const viewBoxWidth = Number.isFinite(viewBox?.width) && viewBox.width > 0 ? viewBox.width : null;
  const segments = Math.max(Number(itemCount) || 0, 1);

  let resolvedWidth = Number.isFinite(width) && width > 0 ? width : null;

  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0) {
      resolvedWidth = viewBoxWidth / segments;
    }
  }

  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    const pointXs = Array.isArray(points)
      ? points
          .map((point) => (Number.isFinite(point?.x) ? point.x : null))
          .filter((value) => Number.isFinite(value))
      : [];

    if (pointXs.length > 1) {
      const sorted = [...pointXs].sort((a, b) => a - b);
      const gaps = sorted
        .slice(1)
        .map((value, index) => value - sorted[index])
        .filter((gap) => Number.isFinite(gap) && gap > 0);

      if (gaps.length > 0) {
        resolvedWidth = Math.min(...gaps);
      }
    }
  }

  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    return null;
  }

  if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0) {
    const maxWidth = viewBoxWidth / segments;
    if (resolvedWidth > maxWidth * 1.5) {
      resolvedWidth = maxWidth;
    }
  }

  const pointXs = Array.isArray(points)
    ? points
        .map((point) => (Number.isFinite(point?.x) ? point.x : null))
        .filter((value) => Number.isFinite(value))
    : [];

  const averagePoint = pointXs.length > 0
    ? pointXs.reduce((sum, value) => sum + value, 0) / pointXs.length
    : null;

  let resolvedX = Number.isFinite(x)
    ? x
    : Number.isFinite(activeCoordinate?.x)
      ? activeCoordinate.x - resolvedWidth / 2
      : Number.isFinite(averagePoint)
        ? averagePoint - resolvedWidth / 2
        : plotLeft;

  if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0) {
    const maxX = plotLeft + viewBoxWidth - resolvedWidth;
    resolvedX = Math.min(Math.max(resolvedX, plotLeft), maxX);
  } else {
    resolvedX = Math.max(resolvedX, plotLeft);
  }

  return (
    <Rectangle
      x={resolvedX}
      y={plotTop}
      width={resolvedWidth}
      height={plotHeight}
      fill={color}
      fillOpacity={fillOpacity}
      pointerEvents="none"
    />
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid stroke={borderColor || undefined} vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              height={32}
              stroke="currentColor"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              padding={{ left: 24, right: 24 }}
            />
            <YAxis
              width={72}
              tickFormatter={formatCurrencyTick}
              stroke="currentColor"
              domain={yAxisDomain}
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <Tooltip
              cursor={
                <CashFlowTooltipCursor
                  itemCount={chartData.length}
                  fill={highlightColor || incomeColor || expenseColor || "currentColor"}
                />
              }
              content={<CashFlowTooltipContent />}
            />
            <Legend
              verticalAlign="bottom"
              height={40}
              content={(props) => <ChartLegend {...props} />}
            />
            <ReferenceLine
              y={0}
              stroke={borderColor || highlightColor || undefined}
              strokeWidth={2}
              strokeOpacity={0.85}
              ifOverflow="extendDomain"
              isFront
            />
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
