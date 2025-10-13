// File: src/lib/recharts-stub.js
import React, { useMemo, useState } from "react";

const DEFAULT_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
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
    .map((child) => ({ ...child.props, __stubKey: child.key }));
}

function parseBars(children) {
  return React.Children.toArray(children)
    .filter((child) => React.isValidElement(child) && child.type?.chartType === "Bar")
    .map((bar) => ({
      dataKey: bar.props?.dataKey,
      name: bar.props?.name,
      fill: bar.props?.fill,
      fillOpacity: bar.props?.fillOpacity,
      stroke: bar.props?.stroke,
      strokeWidth: bar.props?.strokeWidth,
      radius: bar.props?.radius,
      cells: React.Children.toArray(bar.props?.children)
        .filter((cell) => React.isValidElement(cell) && cell.type?.chartType === "Cell")
        .map((cell) => cell.props || {}),
    }));
}

function resolveRadiusStyle(radius) {
  if (!radius && radius !== 0) {
    return {};
  }

  if (Array.isArray(radius)) {
    const [topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0] = radius;
    return {
      borderTopLeftRadius: `${topLeft}px`,
      borderTopRightRadius: `${topRight}px`,
      borderBottomRightRadius: `${bottomRight}px`,
      borderBottomLeftRadius: `${bottomLeft}px`,
    };
  }

  if (typeof radius === "number") {
    return { borderRadius: `${radius}px` };
  }

  return {};
}

function resolveGap(value, fallback, barSize) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    if (Number.isFinite(numeric)) {
      if (value.trim().endsWith("%")) {
        return (numeric / 100) * (barSize ? barSize * 2 : 24);
      }
      return numeric;
    }
  }

  return fallback;
}

function buildTooltipElement(tooltipNode, hoverState) {
  if (!tooltipNode) return null;

  const content = tooltipNode.props?.content;
  if (!content) return null;

  const tooltipProps = {
    active: Boolean(hoverState),
    payload: hoverState?.payload ?? [],
    label: hoverState?.label ?? null,
  };

  if (React.isValidElement(content)) {
    return React.cloneElement(content, tooltipProps);
  }

  if (typeof content === "function") {
    const Content = content;
    return <Content {...tooltipProps} />;
  }

  return null;
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

export function ReferenceLine() {
  return null;
}
ReferenceLine.chartType = "ReferenceLine";

export function BarChart({
  data = [],
  children,
  onMouseMove,
  onMouseLeave,
  barSize,
  barGap = 12,
  barCategoryGap = "20%",
}) {
  const [hoverState, setHoverState] = useState(null);

  const bars = useMemo(() => parseBars(children), [children]);
  const referenceLines = useMemo(() => collect(children, "ReferenceLine"), [children]);
  const tooltipNode = useMemo(
    () => flattenChildren(children).find((child) => child.type?.chartType === "Tooltip"),
    [children]
  );

  const keys = bars.map((bar) => bar.dataKey);
  const colors = bars.map((bar, index) => bar.fill || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
  const resolvedBarSize = Number.isFinite(barSize) ? barSize : 24;
  const resolvedBarGap = resolveGap(barGap, 12, resolvedBarSize);
  const resolvedCategoryGap = resolveGap(barCategoryGap, 24, resolvedBarSize);

  const numericValues = data.flatMap((row) => keys.map((key) => Number(row?.[key]) || 0));
  const maxValue = Math.max(...numericValues, 1);

  const tooltipElement = buildTooltipElement(tooltipNode, hoverState);
  const cursorStyles = tooltipNode?.props?.cursor || {};

  const payloadForIndex = (groupIndex) =>
    keys.map((key, keyIndex) => ({
      dataKey: key,
      name: bars[keyIndex]?.name ?? key,
      value: Number(data[groupIndex]?.[key]) || 0,
      color: colors[keyIndex],
      payload: data[groupIndex],
    }));

  const labelForIndex = (groupIndex) =>
    data[groupIndex]?.month || data[groupIndex]?.name || `#${groupIndex + 1}`;

  const handleBarHover = (groupIndex) => (event) => {
    const state = {
      isTooltipActive: true,
      activeTooltipIndex: groupIndex,
      activeLabel: labelForIndex(groupIndex),
      activePayload: payloadForIndex(groupIndex),
      chartX: event.clientX,
      chartY: event.clientY,
    };
    onMouseMove?.(state, event);
    handleChartMouseMove(state);
  };

  const handleChartMouseMove = (event) => {
    const { isTooltipActive, activeTooltipIndex, activePayload, activeLabel } = event;
    if (isTooltipActive) {
      setHoverState({
        index: activeTooltipIndex,
        payload: activePayload,
        label: activeLabel,
        coordinate: { x: event.chartX, y: event.chartY },
      });
    } else {
      setHoverState(null);
    }
  };

  const handleMouseLeave = (event) => {
    setHoverState(null);
    onMouseMove?.({ isTooltipActive: false }, event);
    onMouseLeave?.(event);
  };

  const tooltipStyle = {
    position: "fixed",
    top: hoverState?.coordinate?.y ?? 0,
    left: hoverState?.coordinate?.x ?? 0,
    transform: "translate(1rem, -50%)",
    transition: "transform 150ms ease-out, top 150ms ease-out, left 150ms ease-out",
    opacity: hoverState ? 1 : 0,
    visibility: hoverState ? "visible" : "hidden",
    pointerEvents: "none",
  };

  return (
    <div
      className="relative flex h-full w-full flex-col"
      role="img"
      aria-label="Bar chart"
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="relative flex flex-1 items-end justify-center overflow-hidden px-4"
        style={{ gap: `${resolvedCategoryGap}px` }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex flex-col" aria-hidden>
          {referenceLines
            .map((line, index) => {
              const value = Number(line?.y);
              if (!Number.isFinite(value)) {
                return null;
              }

              const clamped = Math.max(0, Math.min(value, maxValue));
              const ratio = maxValue === 0 ? 0 : clamped / maxValue;
              const top = 100 - ratio * 100;
              const strokeColor = line?.stroke || "var(--border)";
              const strokeWidth = Number(line?.strokeWidth) || 1.5;
              const strokeOpacity =
                typeof line?.strokeOpacity === "number" ? line.strokeOpacity : 0.5;

              return (
                <div
                  key={line?.__stubKey ?? `reference-${index}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${top}%`,
                    borderTop: `${strokeWidth}px solid ${strokeColor}`,
                    opacity: strokeOpacity,
                  }}
                />
              );
            })
            .filter(Boolean)}
        </div>
        {data.map((row, index) => {
          const groupLabel = row?.month || row?.name || `#${index + 1}`;
          const isGroupActive = hoverState?.index === index;

          return (
            <div
              key={groupLabel}
              className="flex h-full flex-col items-stretch gap-2 text-xs"
              style={{ alignSelf: "stretch", flex: "1 1 0%", minWidth: 0 }}
            >
              <div
                className="relative z-[1] flex h-full w-full items-end justify-center rounded-md px-2 py-1 transition-all"
                style={{
                  backgroundColor: isGroupActive ? cursorStyles.fill || "var(--muted)" : "transparent",
                  opacity: isGroupActive ? cursorStyles.fillOpacity ?? 0.25 : 1,
                  gap: `${resolvedBarGap}px`,
                }}
                onMouseEnter={handleBarHover(index)}
                onMouseMove={handleBarHover(index)}
              >
                {keys.map((key, keyIndex) => {
                  const value = Number(row?.[key]) || 0;
                  const height = Math.max(6, (value / maxValue) * 100);
                  const barDefinition = bars[keyIndex] || {};
                  const cell = barDefinition.cells?.[index] || {};
                  const fill = cell.fill || barDefinition.fill || colors[keyIndex];
                  const opacity = cell.fillOpacity ?? barDefinition.fillOpacity ?? 1;
                  const radiusStyle = resolveRadiusStyle(cell.radius ?? barDefinition.radius);

                  const isSeriesActive = hoverState?.index === index && (!hoverState?.dataKey || hoverState.dataKey === key);
                  const strokeColor = isSeriesActive ? cell.stroke || barDefinition.stroke : undefined;
                  const strokeWidth = isSeriesActive ? cell.strokeWidth ?? barDefinition.strokeWidth ?? 0 : 0;
                  const shadow = strokeColor && strokeWidth ? `0 0 0 ${strokeWidth}px ${strokeColor}` : undefined;

                  return (
                    <div
                      key={`${key}-${index}`}
                      style={{
                        height: `${height}%`,
                        flex: "1 1 0%",
                        minWidth: 0,
                        maxWidth: `${resolvedBarSize}px`,
                        backgroundColor: fill,
                        opacity,
                        boxShadow: shadow,
                        transition: "opacity 150ms ease, box-shadow 150ms ease",
                        ...radiusStyle,
                      }}
                      title={`${barDefinition.name || key}: ${value.toLocaleString()}`}
                    />
                  );
                })}
              </div>
              <span className="block w-full text-center text-muted-foreground">{groupLabel}</span>
            </div>
          );
        })}
      </div>
      {tooltipElement ? <div className="z-10" style={tooltipStyle}>{tooltipElement}</div> : null}
    </div>
  );
}
BarChart.chartType = "BarChart";

export function Bar() {
  return null;
}
Bar.chartType = "Bar";

export function Rectangle() {
  return null;
}
Rectangle.chartType = "Rectangle";

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

function getPath(points, tension = 0.2) {
  if (points.length < 2) return "";

  const path = points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point.x},${point.y}`;

    const prev = a[i - 1];
    const next = a[i + 1];
    const p0 = a[i - 2] || prev;
    const p1 = prev;
    const p2 = point;
    const p3 = next || p2;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }, "");

  return path;
}

export function LineChart({ data = [], children, margin = {} }) {
  const [hoverState, setHoverState] = useState(null);

  const lines = collect(children, "Line");
  const tooltipNode = useMemo(
    () => flattenChildren(children).find((child) => child.type?.chartType === "Tooltip"),
    [children]
  );
  const referenceLines = useMemo(
    () => collect(children, "ReferenceLine"),
    [children]
  );

  const keys = lines.map((line) => line.dataKey);
  const colors = lines.map((line, index) => line.stroke || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
  const numericValues = data.flatMap((row) => keys.map((key) => Number(row[key]) || 0));
  const maxValue = Math.max(...numericValues, 1);

  const tooltipElement = buildTooltipElement(tooltipNode, hoverState);

  const points = keys.map((key) =>
    data.map((row, index) => {
      const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 0;
      const y = 100 - ((Math.max(0, Number(row[key]) || 0) / maxValue) * 100);
      return { x, y };
    })
  );

  const handleMouseMove = (event) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - left;
    const ratio = x / width;
    const index = Math.round(ratio * (data.length - 1));

    if (index >= 0 && index < data.length) {
      const item = data[index];
      const payload = keys.map((key, keyIndex) => ({
        dataKey: key,
        name: lines[keyIndex]?.name ?? key,
        value: Number(item?.[key]) || 0,
        color: colors[keyIndex],
        payload: item,
      }));
      setHoverState({
        index,
        label: item.month || item.name || `#${index + 1}`,
        payload,
        coordinate: { x: event.clientX, y: event.clientY },
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverState(null);
  };

  const tooltipStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    transform: `translate(${hoverState?.coordinate.x ?? 0}px, ${hoverState?.coordinate.y ?? 0}px)`,
    transition: "transform 150ms ease-out",
    opacity: hoverState ? 1 : 0,
    visibility: hoverState ? "visible" : "hidden",
  };

  return (
    <div
      className="relative flex h-full w-full flex-col"
      style={{
        paddingTop: margin.top || 0,
        paddingRight: margin.right,
        paddingBottom: margin.bottom,
        paddingLeft: margin.left,
      }}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        className="w-full flex-1"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Line chart"
        onMouseMove={handleMouseMove}
      >
        <foreignObject x="0" y="0" width="100" height="100">
          <div className="pointer-events-none absolute inset-0 z-0 flex h-full w-full flex-col" aria-hidden>
            {referenceLines
              .map((line, index) => {
                const value = Number(line?.y);
                if (!Number.isFinite(value)) return null;

                const clamped = Math.max(0, Math.min(value, maxValue));
                const ratio = maxValue === 0 ? 0 : clamped / maxValue;
                const top = 100 - ratio * 100;
                const strokeColor = line?.stroke || "var(--border)";
                const strokeWidth = Number(line?.strokeWidth) || 1;
                const strokeOpacity = typeof line?.strokeOpacity === "number" ? line.strokeOpacity : 0.2;

                return (
                  <div
                    key={line?.__stubKey ?? `reference-${index}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: `${top}%`,
                      borderTop: `${strokeWidth}px solid ${strokeColor}`,
                      opacity: strokeOpacity,
                    }}
                  />
                );
              })}
          </div>
        </foreignObject>
        {points.map((linePoints, index) => (
          <path
            key={keys[index]}
            d={getPath(linePoints, 0.2)}
            fill="none"
            stroke={colors[index]}
            strokeWidth={0.2}
          />
        ))}
        <line x1="0" y1="100" x2="100" y2="100" stroke="var(--muted-foreground)" strokeWidth={0.5} />
      </svg>
      {data.length > 0 && (
        <div
          className="grid gap-2 pt-2 text-xs text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${data.length || 1}, minmax(0, 1fr))` }}
        >
          {data.map((row, index) => (
            <span key={index} className="text-center">
              {row.month || row.name || `#${index + 1}`}
            </span>
          ))}
        </div>
      )}
      {tooltipElement ? <div className="pointer-events-none z-10" style={tooltipStyle}>{tooltipElement}</div> : null}
    </div>
  );
}
LineChart.chartType = "LineChart";

export function Line() {
  return null;
}
Line.chartType = "Line";
