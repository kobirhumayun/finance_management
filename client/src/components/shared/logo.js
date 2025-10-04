// File: src/components/shared/logo.js
"use client";

import { useId } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// Enhanced brand mark featuring an upward growth glyph to emphasize the app's financial focus.
export default function Logo({ className, withText = true }) {
  const gradientId = useId();

  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold", className)}>
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-full bg-background shadow-sm ring-1 ring-border"
      >
        <svg className="h-7 w-7" viewBox="0 0 32 32" role="presentation">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--chart-4))" />
              <stop offset="50%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--chart-2))" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill={`url(#${gradientId})`} opacity="0.9" />
          <path
            d="M10 19.5l4.5-5 3.5 3L24 12"
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 11h4v4"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {withText && <span className="text-lg tracking-tight">FinTrack</span>}
      <span className="sr-only">FinTrack home</span>
    </Link>
  );
}
