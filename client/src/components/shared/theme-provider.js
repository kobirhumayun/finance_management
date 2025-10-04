// File: src/components/shared/theme-provider.js
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Lightweight wrapper around next-themes to centralize configuration.
export default function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
