// File: src/components/shared/session-refresher.js
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

// Periodically refreshes the Auth.js session to keep tokens synchronized with the backend.
export default function SessionRefresher({ intervalMs = 4 * 60 * 1000 }) {
  const { update } = useSession();

  useEffect(() => {
    if (!intervalMs) return undefined;

    const id = setInterval(() => {
      // Trigger a background session refresh. Errors are intentionally ignored to avoid noisy UI.
      update().catch(() => {});
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, update]);

  return null;
}
