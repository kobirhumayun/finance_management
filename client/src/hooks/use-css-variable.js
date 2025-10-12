// File: src/hooks/use-css-variable.js
"use client";

import { useEffect, useState } from "react";

export function useCSSVariable(variableName) {
  // Start with the CSS variable string itself for the initial render on both server and client.
  const [value, setValue] = useState(`var(${variableName})`);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const getValue = () => {
      return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    };

    const updateValue = () => {
      const resolvedValue = getValue();
      if (resolvedValue) {
        setValue(resolvedValue);
      }
    };

    updateValue();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateValue);
    return () => mediaQuery.removeEventListener("change", updateValue);
  }, [variableName]);

  return value;
}