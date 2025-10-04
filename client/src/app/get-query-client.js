// File: src/app/get-query-client.js
import { isServer, QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";

// Factory that creates a configured QueryClient instance for SSR/CSR parity.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (fails, err) => (err?.status === 401 ? false : fails < 2),
        retryDelay: (n) => Math.min(1000 * 2 ** n, 5000),
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
    },
  });
}

let browserQueryClient;

// Reuse the same client on the browser to preserve cache between renders.
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
