// File: src/lib/utils.js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind utility classes intelligently while supporting conditional classNames.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const normalizeVersionToken = (value) => {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.trunc(value)) : "";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? String(timestamp) : "";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return String(Math.trunc(numeric));
    }
    const parsedDate = Date.parse(trimmed);
    if (!Number.isNaN(parsedDate)) {
      return String(parsedDate);
    }
    return trimmed;
  }
  if (typeof value === "object") {
    const primitiveValue = typeof value.valueOf === "function" ? value.valueOf() : null;
    if (primitiveValue !== value) {
      return normalizeVersionToken(primitiveValue);
    }
  }
  return "";
};

export function resolveAssetUrl(pathname, version) {
  if (!pathname) return "";
  const value = String(pathname).trim();
  if (!value) return "";
  let resolved = value;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    resolved = value;
  } else if (value.startsWith("/api/proxy/")) {
    resolved = value;
  } else if (value.startsWith("/api/")) {
    resolved = `/api/proxy${value}`;
  } else if (value.startsWith("/")) {
    resolved = value;
  } else if (value.startsWith("./")) {
    resolved = value.slice(1);
  } else {
    resolved = `/${value}`;
  }

  if (!resolved) return "";
  const token = normalizeVersionToken(version);
  if (!token) return resolved;
  if (/^(?:data|blob):/i.test(resolved)) {
    return resolved;
  }
  const separator = resolved.includes("?") ? "&" : "?";
  return `${resolved}${separator}v=${encodeURIComponent(token)}`;
}

export function formatFileSize(bytes, { fallback = "" } = {}) {
  const numeric = typeof bytes === "number" ? bytes : Number(bytes);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = numeric;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const precision = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[index]}`;
}
