// File: src/components/features/dashboard/summary-card.js
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Displays a single KPI metric inside the dashboard summary grid.
export default function SummaryCard({ title, value, description, icon: Icon, trend }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && (
          <p className={cn("mt-2 text-xs font-medium", trend.direction === "up" ? "text-emerald-500" : "text-rose-500")}>
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
