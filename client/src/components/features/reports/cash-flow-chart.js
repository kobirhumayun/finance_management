// File: src/components/features/reports/cash-flow-chart.js
"use client";

import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"; // recharts-stub
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumeric } from "@/lib/utils/numbers";

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="month" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
            <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: "var(--primary)" }} />
            <Legend />
            <Line type="monotone" dataKey="cashIn" stroke="var(--primary)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cashOut" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
