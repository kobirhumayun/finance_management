// File: src/lib/recharts-stub.js
import React from "react";

const DEFAULT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function flattenChildren(children) {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    return [child, ...flattenChildren(child.props?.children)];
  });
}

function collect(children, chartType) {
  return flattenChildren(children)
    .filter((child) => child.type?.chartType === chartType)
    .map((child) => child.props);
}

export function ResponsiveContainer({ width = "100%", height = 300, children }) {
  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };
  return (
    <div className="flex h-full w-full items-stretch" style={style} role="presentation">
      {children}
    </div>
  );
}
ResponsiveContainer.chartType = "ResponsiveContainer";

export function CartesianGrid() {
  return null;
}
CartesianGrid.chartType = "CartesianGrid";

export function Tooltip() {
  return null;
}
Tooltip.chartType = "Tooltip";

export function Legend() {
  return null;
}
Legend.chartType = "Legend";

export function XAxis() {
  return null;
}
XAxis.chartType = "XAxis";

export function YAxis() {
  return null;
}
YAxis.chartType = "YAxis";

export function BarChart({ data = [], children }) {
  const bars = collect(children, "Bar");
  const keys = bars.map((bar) => bar.dataKey);
  const colors = bars.map((bar, index) => bar.fill || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
  const numericValues = data.flatMap((row) => keys.map((key) => Number(row[key]) || 0));
  const maxValue = Math.max(...numericValues, 1);

  return (
    <div className="flex w-full items-end gap-6 overflow-hidden px-4" role="img" aria-label="Bar chart">
      {data.map((row, index) => (
        <div key={row.month || row.name || index} className="flex flex-col items-center gap-2 text-xs">
          <div className="flex h-40 items-end gap-2">
            {keys.map((key, keyIndex) => {
              const value = Number(row[key]) || 0;
              const height = Math.max(6, (value / maxValue) * 100);
              return (
                <div
                  key={key}
                  className="w-4 rounded-t-md"
                  style={{ height: `${height}%`, backgroundColor: colors[keyIndex] }}
                  title={`${key}: ${value.toLocaleString()}`}
                />
              );
            })}
          </div>
          <span className="text-muted-foreground">{row.month || row.name || `#${index + 1}`}</span>
        </div>
      ))}
    </div>
  );
}
BarChart.chartType = "BarChart";

export function Bar() {
  return null;
}
Bar.chartType = "Bar";

export function PieChart({ children }) {
  const pies = collect(children, "Pie");
  const cells = collect(children, "Cell");
  const data = pies[0]?.data || [];
  const colors = cells.length ? cells.map((cell, index) => cell.fill || DEFAULT_COLORS[index % DEFAULT_COLORS.length]) : DEFAULT_COLORS;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col gap-2 text-sm">
        {data.map((item, index) => (
          <div key={item.name || index} className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
              aria-hidden
            />
            <span className="font-medium">{item.name}</span>
            <span className="text-muted-foreground">${Number(item.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
PieChart.chartType = "PieChart";

export function Pie(props) {
  return <>{props.children}</>;
}
Pie.chartType = "Pie";

export function Cell() {
  return null;
}
Cell.chartType = "Cell";

export function LineChart({ data = [], children }) {
  const lines = collect(children, "Line");
  const keys = lines.map((line) => line.dataKey);
  const colors = lines.map((line, index) => line.stroke || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
  const numericValues = data.flatMap((row) => keys.map((key) => Number(row[key]) || 0));
  const maxValue = Math.max(...numericValues, 1);

  const points = keys.map((key) =>
    data.map((row, index) => {
      const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 0;
      const y = 100 - (Math.max(0, Number(row[key]) || 0) / maxValue) * 100;
      return `${x},${y}`;
    })
  );

  return (
    <div className="flex h-full w-full flex-col gap-2 px-4">
      <svg className="h-48 w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Line chart">
        {points.map((linePoints, index) => (
          <polyline
            key={keys[index]}
            points={linePoints.join(" ")}
            fill="none"
            stroke={colors[index]}
            strokeWidth={2}
          />
        ))}
        <line x1="0" y1="100" x2="100" y2="100" stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} />
      </svg>
      <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground">
        {data.map((row, index) => (
          <span key={index} className="text-center">
            {row.month || row.name || `#${index + 1}`}
          </span>
        ))}
      </div>
    </div>
  );
}
LineChart.chartType = "LineChart";

export function Line() {
  return null;
}
Line.chartType = "Line";
