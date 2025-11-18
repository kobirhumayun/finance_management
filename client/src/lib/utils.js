// File: src/lib/utils.js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind utility classes intelligently while supporting conditional classNames.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function resolveAssetUrl(pathname) {
  if (!pathname) return "";
  const value = String(pathname).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  if (value.startsWith("/api/proxy/")) return value;
  if (value.startsWith("/api/")) {
    return `/api/proxy${value}`;
  }
  if (value.startsWith("/")) {
    return value;
  }
  if (value.startsWith("./")) {
    return value.slice(1);
  }
  return `/${value}`;
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
