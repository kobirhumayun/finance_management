// File: src/components/features/reports/income-category-chart.js
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCSSVariable } from "@/hooks/use-css-variable";
import { toNumeric } from "@/lib/utils/numbers";

const normalizeLabel = (value) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const buildChartData = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry) => {
      const name = normalizeLabel(entry?.name ?? entry?.category);
      const value = toNumeric(entry?.value ?? entry?.amount ?? 0);

      if (!name || !Number.isFinite(value) || value <= 0) {
        return null;
      }

      return {
        name,
        value,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);
};

const formatCurrency = (value) => `৳${toNumeric(value).toLocaleString()}`;

const calculatePercent = (value, total) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return "0%";
  }

  const percent = (value / total) * 100;
  if (percent >= 99.5) {
    return "100%";
  }

  return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
};

function IncomeCategoryTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0];
  const name = item?.name ?? item?.payload?.name;
  const value = item?.value ?? item?.payload?.value;

  return (
    <div className="min-w-[180px] rounded-md border bg-popover p-3 text-sm shadow-md">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">
          {calculatePercent(value, item?.payload?.total ?? 0)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Amount</span>
        <span className="font-semibold text-foreground">{formatCurrency(value)}</span>
      </div>
    </div>
  );
}

function IncomeCategoryTotalLabel({ viewBox, total }) {
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }

  const cx = Number.isFinite(viewBox?.cx) ? viewBox.cx : null;
  const cy = Number.isFinite(viewBox?.cy) ? viewBox.cy : null;

  if (cx === null || cy === null) {
    return null;
  }

  return (
    <text x={cx} y={cy} textAnchor="middle" fill="var(--foreground)" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" fontSize="12" fill="var(--muted-foreground)">
        Total
      </tspan>
      <tspan x={cx} dy="1.4em" fontSize="16" fontWeight="600" fill="var(--foreground)">
        {formatCurrency(total)}
      </tspan>
    </text>
  );
}

function IncomeCategoryLegend({ payload, total }) {
  if (!payload || payload.length === 0 || !Number.isFinite(total) || total <= 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 px-4 text-xs text-muted-foreground">
      {payload.map((entry, index) => {
        const value = entry?.payload?.value ?? 0;
        const percent = calculatePercent(value, total);

        return (
          <div
            key={entry?.dataKey ?? entry?.value ?? index}
            className="flex items-center gap-3"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{entry.value}</span>
              <span>{percent}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function IncomeCategoryChart({ data = [] }) {
  const chartData = useMemo(() => buildChartData(data), [data]);
  const total = useMemo(
    () => chartData.reduce((sum, entry) => sum + (entry.value ?? 0), 0),
    [chartData],
  );

  const chart1 = useCSSVariable("--chart-1");
  const chart2 = useCSSVariable("--chart-2");
  const chart3 = useCSSVariable("--chart-3");
  const chart4 = useCSSVariable("--chart-4");
  const chart5 = useCSSVariable("--chart-5");
  const chartPrimary = useCSSVariable("--primary");
  const chartIncome = useCSSVariable("--chart-income");
  const chartExpense = useCSSVariable("--chart-expense");

  const palette = useMemo(
    () => {
      const resolved = [
        chart1,
        chart2,
        chart3,
        chart4,
        chart5,
        chartPrimary,
        chartIncome,
        chartExpense,
      ].filter(Boolean);

      if (resolved.length === 0) {
        return [
          "var(--chart-1)",
          "var(--chart-2)",
          "var(--chart-3)",
          "var(--chart-4)",
          "var(--chart-5)",
        ];
      }

      return resolved;
    },
    [chart1, chart2, chart3, chart4, chart5, chartPrimary, chartIncome, chartExpense],
  );

  const [activeIndex, setActiveIndex] = useState(null);

  const handleSliceEnter = useCallback((_, index) => {
    setActiveIndex(index);
  }, []);

  const handleSliceLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const legendRenderer = useCallback(
    (legendProps) => <IncomeCategoryLegend {...legendProps} total={total} />,
    [total],
  );

  const tooltipRenderer = useCallback(
    (tooltipProps) => {
      if (!tooltipProps?.payload?.[0]) {
        return null;
      }

      const enrichedPayload = tooltipProps.payload.map((item) => ({
        ...item,
        payload: { ...item.payload, total },
      }));

      return <IncomeCategoryTooltip {...tooltipProps} payload={enrichedPayload} />;
    },
    [total],
  );

  const labelRenderer = useCallback(
    (labelProps) => <IncomeCategoryTotalLabel {...labelProps} total={total} />,
    [total],
  );

  const emptyState = chartData.length === 0 || total <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income by Category</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {emptyState ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No categorized income data is available for the selected filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 12, bottom: 12 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={64}
                outerRadius={112}
                paddingAngle={chartData.length > 1 ? 4 : 0}
                cornerRadius={8}
                startAngle={90}
                endAngle={-270}
                onMouseEnter={handleSliceEnter}
                onMouseLeave={handleSliceLeave}
              >
                {chartData.map((entry, index) => {
                  const color = palette[index % palette.length] ?? "var(--chart-1)";
                  const isActive = activeIndex === index;

                  return (
                    <Cell
                      key={entry.name}
                      fill={color}
                      stroke={color}
                      strokeWidth={isActive ? 3 : 1}
                      fillOpacity={isActive || activeIndex === null ? 1 : 0.5}
                    />
                  );
                })}
                <Label position="center" content={labelRenderer} />
              </Pie>
              <Tooltip cursor={false} wrapperClassName="text-sm" content={tooltipRenderer} />
              <Legend verticalAlign="bottom" height={60} content={legendRenderer} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

