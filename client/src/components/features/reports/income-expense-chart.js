// File: src/components/features/reports/income-expense-chart.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";

const toNumber = (value) => toNumeric(value);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toMonthLabel = (value) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
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

const useCSSVariable = (variableName) => {
  const getValue = useCallback(() => {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  }, [variableName]);

  const [value, setValue] = useState(() => getValue());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateValue = () => {
      setValue(getValue());
    };

    updateValue();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateValue);

    return () => {
      mediaQuery.removeEventListener("change", updateValue);
    };
  }, [getValue]);

  return value;
};

const useElementSize = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const updateSizeFromEntry = (entry) => {
      if (!entry) return;
      const rect = entry.contentRect ?? entry;
      const { width, height } = rect || {};
      if (typeof width === "number" && typeof height === "number") {
        setSize({ width, height });
      }
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      updateSizeFromEntry(entry);
    });

    observer.observe(ref.current);

    updateSizeFromEntry(ref.current.getBoundingClientRect?.());

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, size];
};

const formatCurrency = (value) => `$${toNumber(value).toLocaleString()}`;

const CHART_MARGIN = { top: 8, right: 16, bottom: 0, left: 8 };
const X_AXIS_HEIGHT = 32;

function ChartLegend({ payload, onHeightChange }) {
  const [legendRef, { height }] = useElementSize();

  useEffect(() => {
    if (typeof onHeightChange === "function") {
      onHeightChange(height);
    }
  }, [height, onHeightChange]);

  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      ref={legendRef}
      className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
    >
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

function IncomeExpenseTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const net = payload.reduce((total, entry) => {
    if (entry.dataKey === "income") {
      return total + toNumber(entry.value);
    }
    if (entry.dataKey === "expense") {
      return total - toNumber(entry.value);
    }
    return total;
  }, 0);

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
        <span>Net</span>
        <span className="font-medium text-foreground">{formatCurrency(net)}</span>
      </div>
    </div>
  );
}

// Bar chart comparing income versus expense across time.
export default function IncomeExpenseChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => {
        const month = toMonthLabel(item?.month);
        if (!month) {
          return null;
        }

        const income = toNumber(item?.income);
        const expense = toNumber(item?.expense);

        return { month, income, expense };
      })
      .filter(Boolean);
  }, [data]);

  const hasSeries = chartData.some((item) => item.income !== 0 || item.expense !== 0);
  const maxValue = useMemo(() => {
    return chartData.reduce((max, item) => {
      return Math.max(max, Math.abs(item.income || 0), Math.abs(item.expense || 0));
    }, 0);
  }, [chartData]);

  const scaleMarkers = useMemo(() => {
    if (!Number.isFinite(maxValue) || maxValue <= 0) {
      return [];
    }

    const anchors = [1, 0.75, 0.5, 0.25, 0];
    return anchors.map((ratio) => ({
      ratio,
      label: `${Math.round(ratio * 100)}%`,
      value: formatCurrencyTick(maxValue * ratio),
    }));
  }, [maxValue]);

  const incomeColor = useCSSVariable("--chart-income");
  const expenseColor = useCSSVariable("--chart-expense");
  const ringColor = useCSSVariable("--ring");
  const cursorFill = useCSSVariable("--muted");
  const borderColor = useCSSVariable("--border");
  const referenceLineColor = borderColor || cursorFill;
  const highlightColor = ringColor || incomeColor || expenseColor;

  const [containerRef, { width: containerWidth }] = useElementSize();
  const [legendHeight, setLegendHeight] = useState(0);
  const [activeBar, setActiveBar] = useState({ index: null, dataKey: null });

  const groupCount = chartData.length;
  const seriesPerGroup = 2;

  const sizing = useMemo(() => {
    if (!containerWidth || groupCount === 0) {
      return {
        barSize: undefined,
        barGap: 12,
        barCategoryGap: "20%",
      };
    }

    const MIN_GROUP_GAP = 8;
    const MAX_GROUP_GAP = 32;
    const MIN_SERIES_GAP = 4;
    const MAX_SERIES_GAP = 24;

    const groupGapPx = clamp(containerWidth * 0.03, MIN_GROUP_GAP, MAX_GROUP_GAP);
    const totalGroupGap = groupGapPx * Math.max(groupCount - 1, 0);
    const availableWidth = Math.max(containerWidth - totalGroupGap, 0);
    const groupWidth = availableWidth / Math.max(groupCount, 1);

    const innerGapPx = seriesPerGroup > 1 ? clamp(groupWidth * 0.08, MIN_SERIES_GAP, MAX_SERIES_GAP) : 0;
    const totalInnerGap = innerGapPx * Math.max(seriesPerGroup - 1, 0);

    const computedBarSize = (groupWidth - totalInnerGap) / Math.max(seriesPerGroup, 1);
    const safeBarSize = Math.max(computedBarSize, 1);

    return {
      barSize: safeBarSize,
      barGap: innerGapPx,
      barCategoryGap: groupGapPx,
    };
  }, [containerWidth, groupCount, seriesPerGroup]);

  const handleLegendSizeChange = useCallback((height) => {
    const nextHeight = height || 0;
    setLegendHeight((previous) => (previous === nextHeight ? previous : nextHeight));
  }, []);

  const resetActiveBar = useCallback(() => {
    setActiveBar({ index: null, dataKey: null });
  }, []);

  const yAxisDomain = useMemo(() => {
    if (!Number.isFinite(maxValue) || maxValue <= 0) {
      return [0, "auto"];
    }

    return [0, maxValue];
  }, [maxValue]);

  const handleChartMouseMove = useCallback(
    (state) => {
      if (!state?.isTooltipActive || typeof state.activeTooltipIndex !== "number") {
        resetActiveBar();
        return;
      }

      setActiveBar({
        index: state.activeTooltipIndex,
        dataKey: null,
      });
    },
    [resetActiveBar]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs. Expense</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {chartData.length === 0 || !hasSeries ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {chartData.length === 0
              ? "No income or expense data available for the selected filters."
              : "No recorded income or expenses for the selected period."}
          </div>
        ) : (
          <div className="flex h-full items-stretch gap-4">
            {scaleMarkers.length > 0 ? (
              <div className="flex w-28 shrink-0 flex-col text-xs text-muted-foreground">
                <div
                  className="relative flex-1 pl-4"
                  style={{
                    paddingTop: CHART_MARGIN.top + legendHeight,
                    paddingBottom: CHART_MARGIN.bottom + X_AXIS_HEIGHT,
                  }}
                >
                  <span className="absolute inset-y-0 left-0 w-px rounded-full bg-border" aria-hidden />
                  {scaleMarkers.map((marker) => (
                    <div
                      key={marker.ratio}
                      className={`absolute left-2 flex items-center gap-2 ${
                        marker.ratio === 1 || marker.ratio === 0 ? "" : "-translate-y-1/2"
                      }`}
                      style={{ top: `${(1 - marker.ratio) * 100}%` }}
                    >
                      <div className="leading-tight">
                        <div className="font-medium text-foreground">{marker.value}</div>
                        <div className="text-[10px] uppercase tracking-wide">{marker.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={containerRef} className="h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={CHART_MARGIN}
                  barSize={sizing.barSize}
                  barGap={sizing.barGap}
                  barCategoryGap={sizing.barCategoryGap}
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={resetActiveBar}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis
                    dataKey="month"
                    stroke="currentColor"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    height={X_AXIS_HEIGHT}
                  />
                  <YAxis
                    stroke="currentColor"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCurrencyTick}
                    domain={yAxisDomain}
                    label={{
                      value: "Amount (USD)",
                      angle: -90,
                      position: "insideLeft",
                      offset: -4,
                      fill: "currentColor",
                      fontSize: 12,
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: cursorFill || undefined, fillOpacity: 0.2 }}
                    content={<IncomeExpenseTooltip />}
                  />
                  {scaleMarkers.map((marker) => (
                    <ReferenceLine
                      key={`marker-${marker.ratio}`}
                      y={maxValue * marker.ratio}
                      stroke={referenceLineColor || undefined}
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                      ifOverflow="extendDomain"
                      isFront={false}
                    />
                  ))}
                  <Legend
                    content={(legendProps) => (
                      <ChartLegend
                        {...legendProps}
                        onHeightChange={handleLegendSizeChange}
                      />
                    )}
                  />
                  <Bar dataKey="income" name="Income" fill={incomeColor}>
                    {chartData.map((_, index) => {
                      const isActive =
                        activeBar.index === index && (activeBar.dataKey === null || activeBar.dataKey === "income");

                      return (
                        <Cell
                          key={`income-${index}`}
                          radius={[4, 4, 0, 0]}
                          fill={incomeColor}
                          stroke={isActive ? highlightColor : undefined}
                          strokeWidth={isActive ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                  <Bar dataKey="expense" name="Expense" fill={expenseColor}>
                    {chartData.map((_, index) => {
                      const isActive =
                        activeBar.index === index && (activeBar.dataKey === null || activeBar.dataKey === "expense");

                      return (
                        <Cell
                          key={`expense-${index}`}
                          radius={[4, 4, 0, 0]}
                          fill={expenseColor}
                          stroke={isActive ? highlightColor : undefined}
                          strokeWidth={isActive ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
