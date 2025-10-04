// File: src/components/shared/page-header.js
"use client";

import { cn } from "@/lib/utils";

// Consistent page heading used inside dashboard layouts.
export default function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn("flex flex-col gap-2 pb-6", className)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
