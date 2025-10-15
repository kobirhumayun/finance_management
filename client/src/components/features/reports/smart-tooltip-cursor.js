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
  x,
  y,
}) {
  const pointList = Array.isArray(points) ? points.filter(Boolean) : [];
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

  let resolvedWidth = Number.isFinite(width) && width > 0 ? width : null;
  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    if (Number.isFinite(plotWidth) && plotWidth > 0) {
      resolvedWidth = plotWidth / segments;
    } else if (Number.isFinite(bandSize) && bandSize > 0) {
      resolvedWidth = bandSize;
    }

    if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
      const sortedPoints = pointList
        .map((point) => point?.x)
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

      if (sortedPoints.length > 1) {
        const minGap = sortedPoints
          .slice(1)
          .reduce((min, value, index) => Math.min(min, value - sortedPoints[index]), Infinity);

        if (Number.isFinite(minGap) && minGap > 0) {
          resolvedWidth = minGap;
        }
      }
    }
  }

  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    return null;
  }

  const plotLeft = Number.isFinite(left)
    ? left
    : Number.isFinite(viewBox?.x)
      ? viewBox.x
      : 0;

  const plotTop = Number.isFinite(y)
    ? y
    : Number.isFinite(top)
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

  const averageX =
    pointList.length > 0
      ? pointList.reduce((sum, point) => sum + (point?.x ?? 0), 0) / pointList.length
      : null;

  const coordinateX = Number.isFinite(x)
    ? x
    : Number.isFinite(activeCoordinate?.x)
      ? activeCoordinate.x
      : Number.isFinite(averageX)
        ? averageX
        : plotLeft;

  const rawX = Number.isFinite(x) ? coordinateX : coordinateX - resolvedWidth / 2;
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

