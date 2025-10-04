// File: src/lib/utils.js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind utility classes intelligently while supporting conditional classNames.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
