// File: src/components/shared/footer.js
"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/config/site";

// Marketing footer displayed on all public pages.
export default function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            © 2025 FinTrack. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            {siteConfig.socialLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  aria-label={link.name}
                  className="hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
          </div>
        </div>
        <Separator className="my-6" />
        <p className="text-sm text-muted-foreground">
          FinTrack empowers teams to master budgeting, track spending, and uncover financial insights with ease.
        </p>
      </div>
    </footer>
  );
}
