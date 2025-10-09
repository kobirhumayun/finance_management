// File: src/components/features/reports/income-expense-chart.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";

const toNumber = (value) => toNumeric(value);

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

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, size];
};

const formatCurrency = (value) => `$${toNumber(value).toLocaleString()}`;

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

  const incomeColor = useCSSVariable("--chart-1");
  const expenseColor = useCSSVariable("--chart-2");
  const ringColor = useCSSVariable("--ring");
  const cursorFill = useCSSVariable("--muted");
  const highlightColor = ringColor || incomeColor || expenseColor;

  const [containerRef, { width: containerWidth }] = useElementSize();
  const [activeBar, setActiveBar] = useState(null);

  const groupCount = chartData.length;

  const targetBarSize = useMemo(() => {
    if (!containerWidth || groupCount === 0) {
      return undefined;
    }

    const MAX_BAR_WIDTH = 48;
    const MIN_BAR_WIDTH = 12;
    const calculated = containerWidth / (groupCount * 3);
    const safeValue = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, calculated));
    return Number.isFinite(safeValue) ? Math.round(safeValue) : undefined;
  }, [containerWidth, groupCount]);

  const barGap = useMemo(() => {
    if (!targetBarSize) return 12;
    return Math.max(6, Math.round(targetBarSize * 0.4));
  }, [targetBarSize]);

  const barCategoryGap = useMemo(() => {
    if (!targetBarSize || !containerWidth || groupCount === 0) {
      return "20%";
    }

    const groupWidth = containerWidth / groupCount;
    const availableForGap = Math.max(groupWidth - targetBarSize * 2, targetBarSize * 0.5);
    const ratio = Math.max(0.1, Math.min(0.6, availableForGap / groupWidth));
    return `${Math.round(ratio * 100)}%`;
  }, [targetBarSize, containerWidth, groupCount]);

  const handleBarEnter = useCallback((dataKey, index) => {
    setActiveBar({ index, dataKey });
  }, []);

  const handleBarLeave = useCallback(() => {
    setActiveBar(null);
  }, []);

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
          <div ref={containerRef} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                barSize={targetBarSize}
                barGap={barGap}
                barCategoryGap={barCategoryGap}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis
                  dataKey="month"
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCurrencyTick}
                />
                <Tooltip
                  cursor={{ fill: cursorFill || undefined, fillOpacity: 0.2 }}
                  content={<IncomeExpenseTooltip />}
                />
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill={incomeColor}
                  onMouseEnter={(_, index) => handleBarEnter("income", index)}
                  onMouseLeave={handleBarLeave}
                  onMouseMove={(_, index) => handleBarEnter("income", index)}
                >
                  {chartData.map((_, index) => {
                    const isActive = activeBar?.dataKey === "income" && activeBar?.index === index;
                    const isOtherActive =
                      activeBar && (activeBar.dataKey !== "income" || activeBar.index !== index);

                    return (
                      <Cell
                        key={`income-${index}`}
                        radius={[4, 4, 0, 0]}
                        fill={incomeColor}
                        fillOpacity={isActive ? 1 : isOtherActive ? 0.35 : 0.85}
                        stroke={isActive ? highlightColor : undefined}
                        strokeWidth={isActive ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
                <Bar
                  dataKey="expense"
                  name="Expense"
                  fill={expenseColor}
                  onMouseEnter={(_, index) => handleBarEnter("expense", index)}
                  onMouseLeave={handleBarLeave}
                  onMouseMove={(_, index) => handleBarEnter("expense", index)}
                >
                  {chartData.map((_, index) => {
                    const isActive = activeBar?.dataKey === "expense" && activeBar?.index === index;
                    const isOtherActive =
                      activeBar && (activeBar.dataKey !== "expense" || activeBar.index !== index);

                    return (
                      <Cell
                        key={`expense-${index}`}
                        radius={[4, 4, 0, 0]}
                        fill={expenseColor}
                        fillOpacity={isActive ? 1 : isOtherActive ? 0.35 : 0.85}
                        stroke={isActive ? highlightColor : undefined}
                        strokeWidth={isActive ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
