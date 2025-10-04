// File: src/components/ui/sonner.jsx
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

// Wrapper around the Sonner toaster so we can keep theme awareness centralized.
const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
