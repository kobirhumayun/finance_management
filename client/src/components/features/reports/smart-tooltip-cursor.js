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
  const color = fill || "var(--ring)";
  const pointList = Array.isArray(points) ? points.filter(Boolean) : [];
  const pointXs = pointList
    .map((point) => point?.x)
    .filter((value) => Number.isFinite(value));

  const resolvedHeight = Number.isFinite(height) && height > 0
    ? height
    : Number.isFinite(viewBox?.height) && viewBox.height > 0
      ? viewBox.height
      : Number.isFinite(top)
        ? top
        : null;

  if (!Number.isFinite(resolvedHeight) || resolvedHeight <= 0) {
    return null;
  }

  const segments = Math.max(Number(itemCount) || 0, 1);
  const viewBoxWidth = Number.isFinite(viewBox?.width) && viewBox.width > 0 ? viewBox.width : null;

  let resolvedWidth = Number.isFinite(width) && width > 0 ? width : null;

  if (Number.isFinite(resolvedWidth) && Number.isFinite(viewBoxWidth) && viewBoxWidth > 0) {
    const expectedBand = viewBoxWidth / segments;

    if (resolvedWidth >= viewBoxWidth || (expectedBand > 0 && resolvedWidth > expectedBand * 1.5)) {
      resolvedWidth = null;
    }
  }

  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    if (Number.isFinite(bandSize) && bandSize > 0) {
      resolvedWidth = bandSize;
    }
  }

  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    if (pointXs.length > 1) {
      const minGap = pointXs
        .slice(1)
        .reduce((min, value, index) => Math.min(min, value - pointXs[index]), Infinity);

      if (Number.isFinite(minGap) && minGap > 0 && minGap < Infinity) {
        resolvedWidth = minGap;
      }
    }
  }

  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0) {
      resolvedWidth = viewBoxWidth / segments;
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
    : Number.isFinite(viewBox?.y)
      ? viewBox.y
      : Number.isFinite(top)
        ? top
        : 0;

  const rightBoundary = Number.isFinite(viewBoxWidth)
    ? plotLeft + viewBoxWidth - resolvedWidth
    : null;

  const averageX = pointXs.length > 0
    ? pointXs.reduce((sum, value) => sum + value, 0) / pointXs.length
    : null;

  const fallbackX = Number.isFinite(averageX)
    ? averageX - resolvedWidth / 2
    : plotLeft;

  const derivedX = Number.isFinite(x)
    ? x
    : Number.isFinite(activeCoordinate?.x)
      ? activeCoordinate.x - resolvedWidth / 2
      : fallbackX;

  const boundedX = Number.isFinite(rightBoundary)
    ? Math.min(Math.max(derivedX, plotLeft), rightBoundary)
    : Math.max(derivedX, plotLeft);

  return (
    <Rectangle
      x={boundedX}
      y={plotTop}
      width={resolvedWidth}
      height={resolvedHeight}
      fill={color}
      fillOpacity={fillOpacity}
      pointerEvents="none"
    />
  );
}

