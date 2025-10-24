// File: src/components/shared/theme-toggle.js
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { qk } from "@/lib/query-keys";
import { updateSelfPreferences } from "@/lib/queries/self";

// Accessible toggle button allowing users to switch between light and dark themes.
export default function ThemeToggle({ size = "icon" }) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const isAuthenticated = Boolean(session?.user);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { mutate: updateThemePreference, isPending } = useMutation({
    mutationFn: ({ nextTheme }) => updateSelfPreferences({ theme: nextTheme }),
    onMutate: async ({ nextTheme, initialTheme }) => {
      const queryKey = qk.self.preferences();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimistic = {
        ...(previous || { theme: "system", notifications: {} }),
        theme: nextTheme,
      };
      queryClient.setQueryData(queryKey, optimistic);
      return {
        previous,
        queryKey,
        previousTheme: previous?.theme ?? initialTheme ?? "system",
      };
    },
    onError: (_error, _value, context) => {
      if (context?.queryKey && context.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      if (context?.previousTheme) {
        setTheme(context.previousTheme);
      }
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(qk.self.preferences(), data);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.self.preferences() });
    },
  });

  const handleToggle = useCallback(() => {
    const effectiveTheme = theme === "system" ? resolvedTheme : theme;
    const nextTheme = effectiveTheme === "dark" ? "light" : "dark";
    const initialTheme = theme ?? "system";
    setTheme(nextTheme);

    if (isAuthenticated) {
      updateThemePreference({ nextTheme, initialTheme });
    }
  }, [isAuthenticated, resolvedTheme, setTheme, theme, updateThemePreference]);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size}
        aria-label="Toggle theme"
        className="rounded-full"
        disabled
      >
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = effectiveTheme === "dark";
  const ariaLabel = !effectiveTheme
    ? "Toggle theme"
    : isDark
      ? "Switch to light theme"
      : "Switch to dark theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={handleToggle}
      disabled={isAuthenticated && isPending}
      aria-label={ariaLabel}
      className="rounded-full"
    >
      <Sun
        className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        aria-hidden="true"
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
