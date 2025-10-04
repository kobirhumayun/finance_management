// components/PrefetchLink.jsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrefetchQuery } from "@tanstack/react-query";
import { ordersListOptions } from "@/lib/queries/orders";

export default function PrefetchLink({ href, children }) {
  const router = useRouter();
  const prefetchOrders = usePrefetchQuery(ordersListOptions({ limit: 5 }));

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => {
        prefetchOrders();   // warm TanStack cache for target route
        router.prefetch(href); // warm the route (optional - Link also does prefetch)
      }}
    >
      {children}
    </Link>
  );
}