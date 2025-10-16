"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const buildChartData = (data) => {
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => {
      const month = normalizeMonth(entry?.month);
      if (!month) return null;

      return {
        month,
        income: toNumeric(entry?.income),
        expense: toNumeric(entry?.expense),
      };
    })
    .filter(Boolean);
};

const getYAxisDomain = (rows) => {
  const maxSeriesValue = rows.reduce((max, item) => {
    return Math.max(max, Math.abs(item.income ?? 0), Math.abs(item.expense ?? 0));
  }, 0);

  if (!Number.isFinite(maxSeriesValue) || maxSeriesValue <= 0) {
    return [0, "auto"];
  }

  return [0, maxSeriesValue];
};

const getBarSizing = (groups) => {
  if (!groups) {
    return { barCategoryGap: "30%", barGap: 16, barSize: 32 };
  }

  if (groups <= 3) {
    return { barCategoryGap: "45%", barGap: 24, barSize: 40 };
  }
  if (groups <= 6) {
    return { barCategoryGap: "30%", barGap: 18, barSize: 36 };
  }
  if (groups <= 10) {
    return { barCategoryGap: "20%", barGap: 14, barSize: 30 };
  }

  return { barCategoryGap: "16%", barGap: 12, barSize: 24 };
};

const getPositiveNumber = (value) =>
  Number.isFinite(value) && value > 0 ? value : undefined;

function ChartLoadingOverlay({ label, color }) {
  const spinnerColor = color || "var(--ring)";

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 text-sm text-muted-foreground backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        style={{
          borderTopColor: "transparent",
          borderRightColor: spinnerColor,
          borderBottomColor: spinnerColor,
          borderLeftColor: spinnerColor,
        }}
        aria-hidden
      />
      <span className="font-medium text-foreground">{label}</span>
    </div>
  );
}

function ChartLegend({ payload }) {
  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {payload.map((entry, index) => (
        <div key={entry.dataKey ?? entry.value ?? index} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function IncomeExpenseTooltipContent({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const income = payload.find((item) => item.dataKey === "income")?.value ?? 0;
  const expense = payload.find((item) => item.dataKey === "expense")?.value ?? 0;
  const balance = toNumeric(income) - toNumeric(expense);

  return (
    <div className="min-w-[200px] rounded-md border bg-popover p-3 text-sm shadow-md">
      <div className="mb-2 font-medium">{label}</div>
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
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

function IncomeExpenseTooltipCursor({
  fill,
  fillOpacity = 0.16,
  itemCount = 1,
  bandSize,
  points,
  x,
  y,
  width,
  height,
  viewBox,
  activeCoordinate,
}) {
  const color = fill || "var(--ring)";

  const plotHeight = getPositiveNumber(height) ?? getPositiveNumber(viewBox?.height);

  if (plotHeight === undefined) {
    return null;
  }

  const fallbackTop = Number.isFinite(viewBox?.y) ? viewBox.y : 0;
  const plotTop = Number.isFinite(y) ? y : getPositiveNumber(viewBox?.y) ?? fallbackTop;

  const fallbackLeft = Number.isFinite(viewBox?.x) ? viewBox.x : 0;
  const plotLeft = getPositiveNumber(viewBox?.x) ?? fallbackLeft;
  const viewBoxWidth = getPositiveNumber(viewBox?.width);
  const segments = Math.max(Number(itemCount) || 0, 1);

  let resolvedWidth = getPositiveNumber(width);

  if (resolvedWidth === undefined) {
    resolvedWidth = getPositiveNumber(bandSize);
  }

  if (resolvedWidth === undefined && viewBoxWidth !== undefined) {
    resolvedWidth = getPositiveNumber(viewBoxWidth / segments);
  }

  if (resolvedWidth === undefined) {
    return null;
  }

  if (viewBoxWidth !== undefined) {
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

  if (viewBoxWidth !== undefined) {
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

export default function IncomeExpenseChart({ data = [], isLoading = false }) {
  const chartData = useMemo(() => buildChartData(data), [data]);
  const hasSeries = chartData.some((row) => row.income !== 0 || row.expense !== 0);

  const yAxisDomain = useMemo(() => getYAxisDomain(chartData), [chartData]);
  const barSizing = useMemo(() => getBarSizing(chartData.length), [chartData.length]);
  const cursorBandSize = useMemo(() => {
    const totalBarWidth = (barSizing?.barSize ?? 0) * 2;
    const gap = typeof barSizing?.barGap === "number" ? barSizing.barGap : 0;

    const estimatedWidth = totalBarWidth + gap;

    if (!Number.isFinite(estimatedWidth) || estimatedWidth <= 0) {
      return undefined;
    }

    return estimatedWidth;
  }, [barSizing]);

  const incomeColor = useCSSVariable("--chart-income");
  const expenseColor = useCSSVariable("--chart-expense");
  const borderColor = useCSSVariable("--border");
  const ringColor = useCSSVariable("--ring");

  const highlightColor = ringColor || incomeColor || expenseColor;

  const [activeBar, setActiveBar] = useState({ index: null, key: null });

  const resetActiveBar = useCallback(() => {
    setActiveBar({ index: null, key: null });
  }, []);

  const handleMouseMove = useCallback(
    (state) => {
      if (!state?.isTooltipActive || typeof state.activeTooltipIndex !== "number") {
        resetActiveBar();
        return;
      }

      setActiveBar({
        index: state.activeTooltipIndex,
        key: state.activePayload?.[0]?.dataKey ?? null,
      });
    },
    [resetActiveBar]
  );

  const hasRenderableSeries = chartData.length > 0 && hasSeries;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs. Expense</CardTitle>
      </CardHeader>
      <CardContent className="relative h-[320px]">
        {hasRenderableSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 16, right: 16, bottom: 48, left: 16 }}
              barCategoryGap={barSizing.barCategoryGap}
              barGap={barSizing.barGap}
              barSize={barSizing.barSize}
              onMouseMove={handleMouseMove}
              onMouseLeave={resetActiveBar}
            >
              <CartesianGrid stroke={borderColor || undefined} vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                height={32}
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={72}
                domain={yAxisDomain}
                tickFormatter={formatCurrencyTick}
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={
                  <IncomeExpenseTooltipCursor
                    itemCount={chartData.length}
                    fill={highlightColor || incomeColor || expenseColor || "currentColor"}
                    bandSize={cursorBandSize}
                  />
                }
                content={<IncomeExpenseTooltipContent />}
              />
              <ReferenceLine
                y={0}
                stroke={borderColor || highlightColor || undefined}
                strokeWidth={2}
                strokeOpacity={0.85}
                ifOverflow="extendDomain"
                isFront
              />
              <Legend
                verticalAlign="bottom"
                height={40}
                content={(props) => <ChartLegend {...props} />}
              />
              <Bar dataKey="income" name="Income" fill={incomeColor} radius={[6, 6, 0, 0]}>
                {chartData.map((_, index) => {
                  const isActive =
                    activeBar.index === index && (activeBar.key === null || activeBar.key === "income");

                  return (
                    <Cell
                      key={`income-${index}`}
                      fill={incomeColor}
                      stroke={isActive ? highlightColor : undefined}
                      strokeWidth={isActive ? 2 : 0}
                    />
                  );
                })}
              </Bar>
              <Bar dataKey="expense" name="Expense" fill={expenseColor} radius={[6, 6, 0, 0]}>
                {chartData.map((_, index) => {
                  const isActive =
                    activeBar.index === index && (activeBar.key === null || activeBar.key === "expense");

                  return (
                    <Cell
                      key={`expense-${index}`}
                      fill={expenseColor}
                      stroke={isActive ? highlightColor : undefined}
                      strokeWidth={isActive ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          !isLoading && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {chartData.length === 0
                ? "No income or expense data available for the selected filters."
                : "No recorded income or expenses for the selected period."}
            </div>
          )
        )}
        {isLoading && (
          <ChartLoadingOverlay label="Loading income and expense data…" color={highlightColor} />
        )}
      </CardContent>
    </Card>
  );
}
