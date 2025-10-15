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
  viewBox,
  bandSize,
  activeCoordinate,
}) {
  if (!points || points.length === 0) {
    return null;
  }

  const color = fill || "var(--ring)";

  const segments = Math.max(Number(itemCount) || 0, 1);

  const plotWidth = Number.isFinite(width) && width > 0
    ? width
    : Number.isFinite(viewBox?.width) && viewBox.width > 0
      ? viewBox.width
      : null;

  const plotHeight = Number.isFinite(height) && height > 0
    ? height
    : Number.isFinite(viewBox?.height) && viewBox.height > 0
      ? viewBox.height
      : null;

  if (!Number.isFinite(plotHeight) || plotHeight <= 0) {
    return null;
  }

  let segmentWidth = null;
  if (Number.isFinite(plotWidth) && plotWidth > 0) {
    segmentWidth = plotWidth / segments;
  } else if (Number.isFinite(bandSize) && bandSize > 0) {
    segmentWidth = bandSize;
  }

  if (!Number.isFinite(segmentWidth) || segmentWidth <= 0) {
    const sortedPoints = points
      .map((point) => point?.x)
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);

    if (sortedPoints.length > 1) {
      const minGap = sortedPoints
        .slice(1)
        .reduce((min, value, index) => Math.min(min, value - sortedPoints[index]), Infinity);

      if (Number.isFinite(minGap) && minGap > 0) {
        segmentWidth = minGap;
      }
    }
  }

  if (!Number.isFinite(segmentWidth) || segmentWidth <= 0) {
    return null;
  }

  const resolvedWidth = segmentWidth;

  const plotLeft = Number.isFinite(left)
    ? left
    : Number.isFinite(viewBox?.x)
      ? viewBox.x
      : 0;

  const plotTop = Number.isFinite(top)
    ? top
    : Number.isFinite(viewBox?.y)
      ? viewBox.y
      : 0;

  const totalWidth = Number.isFinite(plotWidth) && plotWidth > 0
    ? plotWidth
    : Number.isFinite(viewBox?.width) && viewBox.width > 0
      ? viewBox.width
      : resolvedWidth * segments;

  const plotRight = plotLeft + totalWidth - resolvedWidth;

  const averageX = points.reduce((sum, point) => sum + (point?.x ?? 0), 0) / points.length;
  const coordinateX = Number.isFinite(activeCoordinate?.x)
    ? activeCoordinate.x
    : Number.isFinite(averageX)
      ? averageX
      : plotLeft;

  const rawX = coordinateX - resolvedWidth / 2;
  const boundedX = Math.min(Math.max(rawX, plotLeft), plotRight);

  return (
    <Rectangle
      x={boundedX}
      y={plotTop}
      width={resolvedWidth}
      height={plotHeight}
      fill={color}
      fillOpacity={fillOpacity}
      pointerEvents="none"
    />
  );
}

