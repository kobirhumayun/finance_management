"use client";

import { Rectangle } from "recharts";

export function SmartTooltipCursor({
  points,
  itemCount = 1,
  fill,
  fillOpacity = 0.16,
  width,
  height,
  left,
  top,
}) {
  if (!points || points.length === 0) {
    return null;
  }

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  const segments = Math.max(Number(itemCount) || 0, 1);
  const segmentWidth = width / segments;

  if (!Number.isFinite(segmentWidth) || segmentWidth <= 0) {
    return null;
  }

  const plotLeft = Number.isFinite(left) ? left : 0;
  const plotTop = Number.isFinite(top) ? top : 0;
  const plotRight = plotLeft + width - segmentWidth;

  const cursorX = points[0]?.x ?? plotLeft;
  const rawX = cursorX - segmentWidth / 2;
  const boundedX = Math.min(Math.max(rawX, plotLeft), plotRight);
  const color = fill || "var(--ring)";

  return (
    <Rectangle
      x={boundedX}
      y={plotTop}
      width={segmentWidth}
      height={height}
      fill={color}
      fillOpacity={fillOpacity}
      pointerEvents="none"
    />
  );
}

