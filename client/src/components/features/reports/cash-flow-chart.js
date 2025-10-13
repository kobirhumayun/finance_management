// File: src/components/features/reports/cash-flow-chart.js
"use client";

import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts"; // recharts-stub
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";
import { useCSSVariable } from "@/hooks/use-css-variable";
import { useMemo } from "react";

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
const CHART_MARGIN = { top: 8, right: 16, bottom: X_AXIS_HEIGHT, left: 0 };

const formatPercentage = (value) => {
  const formatted = Number.parseFloat(value.toFixed(4));
  if (Number.isNaN(formatted)) {
    return "0";
  }

  return `${formatted}`.replace(/\.0+$/, "");
};

const resolveMarkerPosition = (ratio) => {
  const constrainedRatio = Math.min(Math.max(ratio, 0), 1);
  const percent = formatPercentage((1 - constrainedRatio) * 100);
  const topAdjustment = CHART_MARGIN.top * constrainedRatio;
  const bottomAdjustment = (1 - constrainedRatio) * CHART_MARGIN.bottom;
  const offset = topAdjustment - bottomAdjustment;

  if (offset === 0) {
    return `${percent}%`;
  }

  const absoluteOffset = Math.abs(offset).toFixed(2).replace(/\.0+$/, "");
  const operator = offset > 0 ? "+" : "-";
  return `calc(${percent}% ${operator} ${absoluteOffset}px)`;
};

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <div className="flex h-full items-stretch">
          <div
            className="flex w-24 shrink-0 flex-col text-xs text-muted-foreground"
            style={{ paddingBottom: CHART_MARGIN.bottom }}
          >
            <div
              className="relative flex-1"
              style={{ paddingTop: CHART_MARGIN.top, paddingBottom: CHART_MARGIN.bottom }}
            >
              <div className="absolute inset-y-0 right-[calc(0.5rem-1px)] w-px rounded-full bg-border" aria-hidden />
              {scaleMarkers.map((marker) => (
                <div
                  key={marker.ratio}
                  className={`absolute right-2 flex items-center gap-2 ${
                    marker.ratio === 1 ? "" : marker.ratio === 0 ? "-translate-y-full" : "-translate-y-1/2"
                  }`}
                  style={{ top: resolveMarkerPosition(marker.ratio) }}
                >
                  <div className="text-right leading-tight">
                    <div className="font-medium text-foreground">{marker.value}</div>
                    <div className="text-[10px] uppercase tracking-wide">{marker.label}</div>
                  </div>
                  <div className="h-px w-2 bg-border" aria-hidden />
                </div>
              ))}
            </div>
          </div>
          <div className="h-full flex-1 pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={CHART_MARGIN}>
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
                <Legend />
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
