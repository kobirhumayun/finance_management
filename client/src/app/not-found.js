// File: src/app/not-found.js
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Custom 404 page guiding users back to safety.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          We searched every ledger but could not find the page you were looking for.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </div>
  );
}
