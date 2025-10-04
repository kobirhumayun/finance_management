// File: src/app/providers.jsx
"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "./get-query-client";

// Centralized provider stack for React Query and Auth.js session context.
export default function Providers({ children }) {
  const queryClient = getQueryClient();

  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={60}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
