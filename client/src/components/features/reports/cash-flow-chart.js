// File: src/components/features/reports/cash-flow-chart.js
"use client";

import {
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"; // recharts-stub
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";
import { useCSSVariable } from "@/hooks/use-css-variable";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatCurrencyTick = (value) => {
  if (!Number.isFinite(value)) return "$0";

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;

  return `$${value.toLocaleString()}`;
};

const X_AXIS_HEIGHT = 32;
const CHART_MARGIN = { top: 8, right: 16, bottom: 0, left: 0 };

const useElementSize = () => {
  const [element, setElement] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") {
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

    observer.observe(element);

    if (element.getBoundingClientRect) {
      updateSizeFromEntry(element.getBoundingClientRect());
    }

    return () => observer.disconnect();
  }, [element]);

  return [
    useCallback((node) => {
      setElement(node ?? null);
    }, []),
    size,
  ];
};

function ChartLegend({ payload, onHeightChange }) {
  const [legendRef, { height }] = useElementSize();

  useEffect(() => {
    if (typeof onHeightChange === "function") {
      onHeightChange(height || 0);
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
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const formatCurrency = (value) => `$${toNumeric(value).toLocaleString()}`;

function CashFlowTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const cashIn = payload.find((p) => p.dataKey === "cashIn")?.value ?? 0;
  const cashOut = payload.find((p) => p.dataKey === "cashOut")?.value ?? 0;
  const balance = toNumeric(cashIn) - toNumeric(cashOut);

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

// Line chart visualizing cash flow trends.
export default function CashFlowChart({ data = [] }) {
  const incomeColor = useCSSVariable("--chart-income");
  const expenseColor = useCSSVariable("--chart-expense");
  const borderColor = useCSSVariable("--border");

  const [containerRef, { height: containerHeight }] = useElementSize();
  const [legendHeight, setLegendHeight] = useState(0);

  const handleLegendSizeChange = useCallback((height) => {
    setLegendHeight((previous) => {
      const nextHeight = height || 0;
      return previous === nextHeight ? previous : nextHeight;
    });
  }, []);

  const { maxValue, scaleMarkers } = useMemo(() => {
    const maxVal = data.reduce((max, item) => {
      return Math.max(max, toNumeric(item.cashIn), toNumeric(item.cashOut));
    }, 0);

    if (maxVal <= 0) {
      return { maxValue: 0, scaleMarkers: [] };
    }

    const anchors = [1, 0.75, 0.5, 0.25, 0];
    const markers = anchors.map((ratio) => ({
      ratio,
      label: `${Math.round(ratio * 100)}%`,
      value: formatCurrencyTick(maxVal * ratio),
      y: maxVal * ratio,
    }));
    return { maxValue: maxVal, scaleMarkers: markers };
  }, [data]);

  const chartBottomPadding = X_AXIS_HEIGHT + (legendHeight || 0);

  const chartMargin = useMemo(
    () => ({ ...CHART_MARGIN, bottom: chartBottomPadding }),
    [chartBottomPadding]
  );

  const plotHeight = useMemo(() => {
    if (!containerHeight) {
      return null;
    }

    return Math.max(containerHeight - chartMargin.top - chartMargin.bottom, 0);
  }, [containerHeight, chartMargin.bottom, chartMargin.top]);

  const markerLayout = useMemo(() => {
    if (scaleMarkers.length === 0) {
      return [];
    }

    return scaleMarkers.map((marker) => {
      const position =
        plotHeight === null ? null : CHART_MARGIN.top + plotHeight * (1 - marker.ratio);

      return { ...marker, position };
    });
  }, [plotHeight, scaleMarkers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <div className="flex h-full items-stretch">
          <div className="flex w-24 shrink-0 flex-col text-xs text-muted-foreground">
            <div style={{ height: CHART_MARGIN.top }} aria-hidden />
            <div className="relative flex-1">
              <div
                className="absolute inset-y-0 right-[calc(0.5rem-1px)] w-px rounded-full bg-border"
                aria-hidden
              />
              {markerLayout.map((marker) => {
                const fallbackTop = `${(1 - marker.ratio) * 100}%`;
                const resolvedTop =
                  marker.position === null ? fallbackTop : `${marker.position - CHART_MARGIN.top}px`;

                return (
                  <div
                    key={marker.ratio}
                    className={`absolute right-2 flex items-center gap-2 ${
                      marker.ratio === 1 ? "" : marker.ratio === 0 ? "-translate-y-full" : "-translate-y-1/2"
                    }`}
                    style={{ top: resolvedTop }}
                  >
                    <div className="text-right leading-tight">
                      <div className="font-medium text-foreground">{marker.value}</div>
                      <div className="text-[10px] uppercase tracking-wide">{marker.label}</div>
                    </div>
                    <div className="h-px w-2 bg-border" aria-hidden />
                  </div>
                );
              })}
            </div>
            <div style={{ height: chartBottomPadding }} aria-hidden />
          </div>
          <div ref={containerRef} className="h-full flex-1 pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={chartMargin}>
                <XAxis
                  dataKey="month"
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  height={X_AXIS_HEIGHT}
                />
                <YAxis hide domain={[0, maxValue]} />
                <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: "var(--primary)" }} />
                <Legend
                  content={(legendProps) => (
                    <ChartLegend {...legendProps} onHeightChange={handleLegendSizeChange} />
                  )}
                />
                {scaleMarkers.map((marker) => (
                  <ReferenceLine key={`marker-${marker.ratio}`} y={marker.y} stroke={borderColor} strokeOpacity={0.5} />
                ))}
                <Line type="monotone" dataKey="cashIn" name="Cash In" stroke={incomeColor} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cashOut" name="Cash Out" stroke={expenseColor} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
